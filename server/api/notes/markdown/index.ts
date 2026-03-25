import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const method = event.method

  if (method === 'GET') {
    const query = getQuery(event)
    const { page = '1', limit = '20', sort = 'updated_at' } = query

    const pageNum = parseInt(page as string)
    const limitNum = parseInt(limit as string)
    const offset = (pageNum - 1) * limitNum

    // Validate sort column
    const validSorts = ['created_at', 'title', 'updated_at', 'is_favorite']
    const sortColumn = validSorts.includes(sort as string) ? sort : 'updated_at'

    const notes = db.prepare(`
      SELECT * FROM markdown_notes
      ORDER BY ${sortColumn} DESC
      LIMIT ? OFFSET ?
    `).all(limitNum, offset) as any[]

    const { total } = db.prepare('SELECT COUNT(*) as total FROM markdown_notes').get() as { total: number }

    return {
      notes: notes.map(n => ({
        ...n,
        is_favorite: Boolean(n.is_favorite),
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
    const { title, content, is_favorite } = body

    if (!title || typeof title !== 'string') {
      throw createError({
        statusCode: 400,
        message: 'Title is required',
      })
    }

    const id = Array.from({ length: 16 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('')

    db.prepare(`
      INSERT INTO markdown_notes (id, title, content, is_favorite)
      VALUES (?, ?, ?, ?)
    `).run(id, title, content || '', is_favorite ? 1 : 0)

    const note = db.prepare('SELECT * FROM markdown_notes WHERE id = ?').get(id) as any

    return {
      ...note,
      is_favorite: Boolean(note.is_favorite),
    }
  }

  throw createError({
    statusCode: 405,
    message: 'Method not allowed',
  })
})
