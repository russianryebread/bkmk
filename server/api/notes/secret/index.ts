import { getDb } from '../../../utils/db'
import { hashPassword } from '../../../utils/crypto'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const method = event.method

  if (method === 'GET') {
    // Return list without content (for security)
    const notes = db.prepare(`
      SELECT id, title, created_at, updated_at, last_accessed_at 
      FROM secret_notes
      ORDER BY updated_at DESC
    `).all()

    return { notes }
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const { title, content, password } = body

    if (!title || typeof title !== 'string') {
      throw createError({
        statusCode: 400,
        message: 'Title is required',
      })
    }

    if (!password || typeof password !== 'string' || password.length < 4) {
      throw createError({
        statusCode: 400,
        message: 'Password must be at least 4 characters',
      })
    }

    const id = Array.from({ length: 16 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('')

    const passwordHash = await hashPassword(password)

    db.prepare(`
      INSERT INTO secret_notes (id, title, content, password_hash)
      VALUES (?, ?, ?, ?)
    `).run(id, title, content || '', passwordHash)

    const note = db.prepare(`
      SELECT id, title, created_at, updated_at, last_accessed_at 
      FROM secret_notes WHERE id = ?
    `).get(id)

    return { note }
  }

  throw createError({
    statusCode: 405,
    message: 'Method not allowed',
  })
})
