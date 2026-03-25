import { getDb } from '../../../utils/db'

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
    const note = db.prepare('SELECT * FROM markdown_notes WHERE id = ?').get(id) as any
    
    if (!note) {
      throw createError({
        statusCode: 404,
        message: 'Note not found',
      })
    }

    return {
      ...note,
      is_favorite: Boolean(note.is_favorite),
    }
  }

  if (method === 'PUT') {
    const body = await readBody(event)
    const { title, content, is_favorite, sort_order } = body

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
    if (is_favorite !== undefined) {
      updates.push('is_favorite = ?')
      params.push(is_favorite ? 1 : 0)
    }
    if (sort_order !== undefined) {
      updates.push('sort_order = ?')
      params.push(sort_order)
    }

    params.push(id)

    db.prepare(`
      UPDATE markdown_notes SET ${updates.join(', ')} WHERE id = ?
    `).run(...params)

    const note = db.prepare('SELECT * FROM markdown_notes WHERE id = ?').get(id) as any

    return {
      ...note,
      is_favorite: Boolean(note.is_favorite),
    }
  }

  if (method === 'DELETE') {
    db.prepare('DELETE FROM markdown_notes WHERE id = ?').run(id)
    return { success: true }
  }

  throw createError({
    statusCode: 405,
    message: 'Method not allowed',
  })
})
