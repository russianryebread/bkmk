import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const query = getQuery(event)
  
  const { q, limit = '10' } = query
  const limitNum = Math.min(parseInt(limit as string), 50)

  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    return { notes: [] }
  }

  const searchTerm = `%${q.trim().toLowerCase()}%`

  const notes = db.prepare(`
    SELECT id, title, content, is_favorite, created_at, updated_at
    FROM markdown_notes
    WHERE LOWER(title) LIKE ? OR LOWER(content) LIKE ?
    ORDER BY updated_at DESC
    LIMIT ?
  `).all(searchTerm, searchTerm, limitNum) as any[]

  return {
    notes: notes.map(n => ({
      ...n,
      is_favorite: Boolean(n.is_favorite),
    })),
  }
})
