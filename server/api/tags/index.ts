import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const method = event.method

  if (method === 'GET') {
    // Get all tags with bookmark counts
    const tags = db.prepare(`
      SELECT t.*, COUNT(bt.bookmark_id) as bookmark_count
      FROM tags t
      LEFT JOIN bookmark_tags bt ON t.id = bt.tag_id
      GROUP BY t.id
      ORDER BY t.name
    `).all()

    return { tags }
  }

  if (method === 'POST') {
    // Create new tag
    const body = await readBody(event)
    const { name, parent_tag_id, color } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw createError({
        statusCode: 400,
        message: 'Tag name is required',
      })
    }

    const id = Array.from({ length: 16 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('')

    try {
      db.prepare(`
        INSERT INTO tags (id, name, parent_tag_id, color)
        VALUES (?, ?, ?, ?)
      `).run(id, name.trim(), parent_tag_id || null, color || null)

      const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id)
      
      return { tag }
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw createError({
          statusCode: 409,
          message: 'Tag already exists',
        })
      }
      throw error
    }
  }

  throw createError({
    statusCode: 405,
    message: 'Method not allowed',
  })
})
