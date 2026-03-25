import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')
  const method = event.method

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Tag ID is required',
    })
  }

  if (method === 'GET') {
    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id)
    
    if (!tag) {
      throw createError({
        statusCode: 404,
        message: 'Tag not found',
      })
    }

    return { tag }
  }

  if (method === 'PUT') {
    const body = await readBody(event)
    const { name, parent_tag_id, color } = body

    const updates: string[] = []
    const params: any[] = []

    if (name !== undefined) {
      updates.push('name = ?')
      params.push(name.trim())
    }
    if (parent_tag_id !== undefined) {
      updates.push('parent_tag_id = ?')
      params.push(parent_tag_id)
    }
    if (color !== undefined) {
      updates.push('color = ?')
      params.push(color)
    }

    if (updates.length === 0) {
      return { success: true }
    }

    params.push(id)

    db.prepare(`
      UPDATE tags SET ${updates.join(', ')} WHERE id = ?
    `).run(...params)

    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id)
    return { tag }
  }

  if (method === 'DELETE') {
    // Remove tag associations first
    db.prepare('DELETE FROM bookmark_tags WHERE tag_id = ?').run(id)
    
    // Delete the tag
    db.prepare('DELETE FROM tags WHERE id = ?').run(id)

    return { success: true }
  }

  throw createError({
    statusCode: 405,
    message: 'Method not allowed',
  })
})
