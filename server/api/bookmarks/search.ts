import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const query = getQuery(event)
  
  const { q, limit = '20' } = query

  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    return { bookmarks: [], total: 0 }
  }

  const searchTerm = q.trim()
  const limitNum = Math.min(parseInt(limit as string), 100)

  // Use FTS5 for full-text search
  try {
    const bookmarks = db.prepare(`
      SELECT b.*,
        GROUP_CONCAT(DISTINCT t.name) as tags,
        GROUP_CONCAT(DISTINCT t.id) as tag_ids,
        snippet(fts_bookmarks, 0, '<mark>', '</mark>', '...', 32) as title_snippet,
        snippet(fts_bookmarks, 1, '<mark>', '</mark>', '...', 32) as description_snippet
      FROM fts_bookmarks fts
      JOIN bookmarks b ON fts.rowid = b.id
      LEFT JOIN bookmark_tags bt ON b.id = bt.bookmark_id
      LEFT JOIN tags t ON bt.tag_id = t.id
      WHERE fts_bookmarks MATCH ?
      GROUP BY b.id
      ORDER BY bm25(fts_bookmarks)
      LIMIT ?
    `).all(searchTerm, limitNum) as any[]

    const transformedBookmarks = bookmarks.map(b => ({
      ...b,
      is_favorite: Boolean(b.is_favorite),
      is_read: Boolean(b.is_read),
      tags: b.tags ? b.tags.split(',') : [],
      tag_ids: b.tag_ids ? b.tag_ids.split(',') : [],
    }))

    return {
      bookmarks: transformedBookmarks,
      total: transformedBookmarks.length,
    }
  } catch (error) {
    // Fallback to LIKE search if FTS fails
    const likePattern = `%${searchTerm}%`
    const bookmarks = db.prepare(`
      SELECT b.*,
        GROUP_CONCAT(DISTINCT t.name) as tags,
        GROUP_CONCAT(DISTINCT t.id) as tag_ids
      FROM bookmarks b
      LEFT JOIN bookmark_tags bt ON b.id = bt.bookmark_id
      LEFT JOIN tags t ON bt.tag_id = t.id
      WHERE b.title LIKE ? OR b.description LIKE ? OR b.cleaned_markdown LIKE ?
      GROUP BY b.id
      ORDER BY b.created_at DESC
      LIMIT ?
    `).all(likePattern, likePattern, likePattern, limitNum) as any[]

    const transformedBookmarks = bookmarks.map(b => ({
      ...b,
      is_favorite: Boolean(b.is_favorite),
      is_read: Boolean(b.is_read),
      tags: b.tags ? b.tags.split(',') : [],
      tag_ids: b.tag_ids ? b.tag_ids.split(',') : [],
    }))

    return {
      bookmarks: transformedBookmarks,
      total: transformedBookmarks.length,
    }
  }
})
