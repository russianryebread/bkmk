import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const method = event.method

  if (method === 'GET') {
    const query = getQuery(event)
    const { page = '1', limit = '20', sort = 'updated_at', tag } = query

    const pageNum = parseInt(page as string)
    const limitNum = parseInt(limit as string)
    const offset = (pageNum - 1) * limitNum

    // Validate sort column
    const validSorts = ['created_at', 'title', 'updated_at', 'is_favorite']
    const sortColumn = validSorts.includes(sort as string) ? sort : 'updated_at'

    let notes: any[]
    
    // Filter by tag if provided
    if (tag) {
      notes = db.prepare(`
        SELECT * FROM markdown_notes
        WHERE tags LIKE ?
        ORDER BY ${sortColumn} DESC
        LIMIT ? OFFSET ?
      `).all(`%${tag}%`, limitNum, offset)

      const { total } = db.prepare(`
        SELECT COUNT(*) as total FROM markdown_notes
        WHERE tags LIKE ?
      `).get(`%${tag}%`) as { total: number }

      return {
        notes: notes.map(n => ({
          ...n,
          is_favorite: Boolean(n.is_favorite),
          tags: n.tags ? n.tags.split(',').filter(Boolean) : [],
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      }
    }

    notes = db.prepare(`
      SELECT * FROM markdown_notes
      ORDER BY ${sortColumn} DESC
      LIMIT ? OFFSET ?
    `).all(limitNum, offset) as any[]

    const { total } = db.prepare('SELECT COUNT(*) as total FROM markdown_notes').get() as { total: number }

    return {
      notes: notes.map(n => ({
        ...n,
        is_favorite: Boolean(n.is_favorite),
        tags: n.tags ? n.tags.split(',').filter(Boolean) : [],
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    }
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const { title, content, is_favorite, tags } = body

    if (!title || typeof title !== 'string') {
      throw createError({
        statusCode: 400,
        message: 'Title is required',
      })
    }

    const id = Array.from({ length: 16 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('')

    // Handle tags as array or comma-separated string
    const tagsString = Array.isArray(tags) 
      ? tags.join(',') 
      : (typeof tags === 'string' ? tags : '')

    db.prepare(`
      INSERT INTO markdown_notes (id, title, content, is_favorite, tags)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, title, content || '', is_favorite ? 1 : 0, tagsString)

    const note = db.prepare('SELECT * FROM markdown_notes WHERE id = ?').get(id) as any

    return {
      ...note,
      is_favorite: Boolean(note.is_favorite),
      tags: note.tags ? note.tags.split(',').filter(Boolean) : [],
    }
  }

  throw createError({
    statusCode: 405,
    message: 'Method not allowed',
  })
})
