import { getDb } from '../../../utils/db'
import { verifyPassword } from '../../../utils/crypto'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')
  const method = event.method

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Note ID is required',
    })
  }

  if (method === 'GET') {
    // Check for password in query or header
    const query = getQuery(event)
    const password = query.password as string

    const note = db.prepare('SELECT * FROM secret_notes WHERE id = ?').get(id) as any
    
    if (!note) {
      throw createError({
        statusCode: 404,
        message: 'Note not found',
      })
    }

    if (!password) {
      // Return metadata without content
      return {
        id: note.id,
        title: note.title,
        created_at: note.created_at,
        updated_at: note.updated_at,
        last_accessed_at: note.last_accessed_at,
        requires_password: true,
      }
    }

    // Verify password
    const isValid = await verifyPassword(password, note.password_hash)
    
    if (!isValid) {
      throw createError({
        statusCode: 401,
        message: 'Invalid password',
      })
    }

    // Update last accessed
    db.prepare(`
      UPDATE secret_notes SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(id)

    return {
      ...note,
      requires_password: false,
    }
  }

  if (method === 'PUT') {
    const body = await readBody(event)
    const { title, content, password, current_password } = body

    const note = db.prepare('SELECT * FROM secret_notes WHERE id = ?').get(id) as any
    
    if (!note) {
      throw createError({
        statusCode: 404,
        message: 'Note not found',
      })
    }

    // Verify current password if changing password or content
    if (password || content) {
      if (!current_password) {
        throw createError({
          statusCode: 400,
          message: 'Current password is required',
        })
      }

      const isValid = await verifyPassword(current_password, note.password_hash)
      if (!isValid) {
        throw createError({
          statusCode: 401,
          message: 'Invalid password',
        })
      }
    }

    const updates: string[] = ['updated_at = CURRENT_TIMESTAMP']
    const params: any[] = []

    if (title !== undefined) {
      updates.push('title = ?')
      params.push(title)
    }
    if (content !== undefined) {
      updates.push('content = ?')
      params.push(content)
    }
    if (password !== undefined) {
      updates.push('password_hash = ?')
      params.push(await hashPassword(password))
    }

    params.push(id)

    db.prepare(`
      UPDATE secret_notes SET ${updates.join(', ')} WHERE id = ?
    `).run(...params)

    const updatedNote = db.prepare(`
      SELECT id, title, created_at, updated_at, last_accessed_at 
      FROM secret_notes WHERE id = ?
    `).get(id)

    return { note: updatedNote }
  }

  if (method === 'DELETE') {
    const body = await readBody(event)
    const { password } = body

    const note = db.prepare('SELECT * FROM secret_notes WHERE id = ?').get(id) as any
    
    if (!note) {
      throw createError({
        statusCode: 404,
        message: 'Note not found',
      })
    }

    if (!password) {
      throw createError({
        statusCode: 400,
        message: 'Password is required to delete',
      })
    }

    const isValid = await verifyPassword(password, note.password_hash)
    if (!isValid) {
      throw createError({
        statusCode: 401,
        message: 'Invalid password',
      })
    }

    db.prepare('DELETE FROM secret_notes WHERE id = ?').run(id)
    return { success: true }
  }

  throw createError({
    statusCode: 405,
    message: 'Method not allowed',
  })
})
