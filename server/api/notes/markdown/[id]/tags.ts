import { getDb } from '../../../../utils/db'

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

  // Check if note exists
  const note = db.prepare('SELECT * FROM markdown_notes WHERE id = ?').get(id) as any
  
  if (!note) {
    throw createError({
      statusCode: 404,
      message: 'Note not found',
    })
  }

  // Get current tags
  const currentTags = note.tags ? note.tags.split(',').filter(Boolean) : []

  if (method === 'GET') {
    return {
      tags: currentTags,
    }
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const { tag } = body

    if (!tag || typeof tag !== 'string') {
      throw createError({
        statusCode: 400,
        message: 'Tag is required',
      })
    }

    // Normalize tag (trim whitespace)
    const normalizedTag = tag.trim()
    
    if (!normalizedTag) {
      throw createError({
        statusCode: 400,
        message: 'Tag cannot be empty',
      })
    }

    // Check if tag already exists
    if (currentTags.includes(normalizedTag)) {
      throw createError({
        statusCode: 409,
        message: 'Tag already exists',
      })
    }

    // Add tag
    const newTags = [...currentTags, normalizedTag]
    
    db.prepare(`
      UPDATE markdown_notes SET tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(newTags.join(','), id)

    return {
      tags: newTags,
    }
  }

  if (method === 'PUT') {
    const body = await readBody(event)
    const { tags } = body

    if (!Array.isArray(tags)) {
      throw createError({
        statusCode: 400,
        message: 'Tags must be an array',
      })
    }

    // Normalize and deduplicate tags
    const newTags = [...new Set(tags.map(t => t.trim()).filter(Boolean))]

    db.prepare(`
      UPDATE markdown_notes SET tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(newTags.join(','), id)

    return {
      tags: newTags,
    }
  }

  if (method === 'DELETE') {
    const query = getQuery(event)
    const { tag } = query

    if (!tag || typeof tag !== 'string') {
      throw createError({
        statusCode: 400,
        message: 'Tag query parameter is required',
      })
    }

    // Remove tag
    const newTags = currentTags.filter(t => t !== tag.trim())

    db.prepare(`
      UPDATE markdown_notes SET tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(newTags.join(','), id)

    return {
      tags: newTags,
    }
  }

  throw createError({
    statusCode: 405,
    message: 'Method not allowed',
  })
})
