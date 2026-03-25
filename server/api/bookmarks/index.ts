import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const query = getQuery(event)
  
  const {
    page = '1',
    limit = '20',
    sort = 'created_at',
    order = 'desc',
    favorite,
    tag,
    domain,
    unread,
  } = query

  const pageNum = parseInt(page as string)
  const limitNum = parseInt(limit as string)
  const offset = (pageNum - 1) * limitNum

  let whereConditions: string[] = []
  let params: any[] = []

  // Build WHERE clause based on filters
  if (favorite === 'true') {
    whereConditions.push('b.is_favorite = 1')
  }

  if (unread === 'true') {
    whereConditions.push('b.is_read = 0')
  }

  if (domain) {
    whereConditions.push('b.source_domain = ?')
    params.push(domain)
  }

  const whereClause = whereConditions.length > 0 
    ? 'WHERE ' + whereConditions.join(' AND ')
    : ''

  // Validate sort column
  const validSorts = ['created_at', 'title', 'saved_at', 'is_favorite', 'sort_order']
  const sortColumn = validSorts.includes(sort as string) ? sort : 'created_at'
  const sortOrder = order === 'asc' ? 'ASC' : 'DESC'

  // Get total count
  const countStmt = db.prepare(`
    SELECT COUNT(DISTINCT b.id) as total 
    FROM bookmarks b
    ${whereClause}
    ${tag ? 'JOIN bookmark_tags bt ON b.id = bt.bookmark_id JOIN tags t ON bt.tag_id = t.id AND t.name = ?' : ''}
  `)
  const tagParam = tag ? [tag] : []
  const { total } = countStmt.get(...params, ...tagParam) as { total: number }

  // Get bookmarks with tags
  const bookmarksStmt = db.prepare(`
    SELECT b.*,
      GROUP_CONCAT(DISTINCT t.name) as tags,
      GROUP_CONCAT(DISTINCT t.id) as tag_ids
    FROM bookmarks b
    LEFT JOIN bookmark_tags bt ON b.id = bt.bookmark_id
    LEFT JOIN tags t ON bt.tag_id = t.id
    ${whereClause}
    ${tag ? 'AND t.name = ?' : ''}
    GROUP BY b.id
    ORDER BY ${sortColumn === 'is_favorite' ? 'b.is_favorite DESC,' : ''} 
              b.${sortColumn} ${sortOrder}
    LIMIT ? OFFSET ?
  `)

  const bookmarks = db.prepare(`
    SELECT b.*,
      GROUP_CONCAT(DISTINCT t.name) as tags,
      GROUP_CONCAT(DISTINCT t.id) as tag_ids
    FROM bookmarks b
    LEFT JOIN bookmark_tags bt ON b.id = bt.bookmark_id
    LEFT JOIN tags t ON bt.tag_id = t.id
    ${whereClause}
    GROUP BY b.id
    ORDER BY ${sortColumn === 'is_favorite' ? 'b.is_favorite DESC,' : ''} 
              b.${sortColumn} ${sortOrder}
    LIMIT ? OFFSET ?
  `).all(...params, limitNum, offset) as any[]

  // Transform results
  const transformedBookmarks = bookmarks.map(b => ({
    ...b,
    is_favorite: Boolean(b.is_favorite),
    is_read: Boolean(b.is_read),
    tags: b.tags ? b.tags.split(',') : [],
    tag_ids: b.tag_ids ? b.tag_ids.split(',') : [],
  }))

  return {
    bookmarks: transformedBookmarks,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  }
})
