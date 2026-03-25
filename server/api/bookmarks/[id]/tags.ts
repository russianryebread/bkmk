import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')
  const method = event.method

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Bookmark ID is required',
    })
  }

  if (method === 'GET') {
    // Get tags for bookmark
    const tags = db.prepare(`
      SELECT t.*
      FROM tags t
      JOIN bookmark_tags bt ON t.id = bt.tag_id
      WHERE bt.bookmark_id = ?
      ORDER BY t.name
    `).all(id)

    return { tags }
  }

  if (method === 'POST') {
    // Add tags to bookmark
    const body = await readBody(event)
    const { tag_ids } = body

    if (!Array.isArray(tag_ids)) {
      throw createError({
        statusCode: 400,
        message: 'tag_ids must be an array',
      })
    }

    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id)
      VALUES (?, ?)
    `)

    for (const tagId of tag_ids) {
      insertStmt.run(id, tagId)
    }

    // Update sync metadata
    db.prepare(`
      INSERT OR REPLACE INTO sync_metadata (entity_type, entity_id, last_modified_at, sync_status)
      VALUES ('bookmark', ?, CURRENT_TIMESTAMP, 'pending')
    `).run(id)

    return { success: true }
  }

  if (method === 'DELETE') {
    // Remove specific tags from bookmark
    const body = await readBody(event)
    const { tag_ids } = body

    if (!Array.isArray(tag_ids)) {
      throw createError({
        statusCode: 400,
        message: 'tag_ids must be an array',
      })
    }

    const deleteStmt = db.prepare(`
      DELETE FROM bookmark_tags 
      WHERE bookmark_id = ? AND tag_id = ?
    `)

    for (const tagId of tag_ids) {
      deleteStmt.run(id, tagId)
    }

    // Update sync metadata
    db.prepare(`
      INSERT OR REPLACE INTO sync_metadata (entity_type, entity_id, last_modified_at, sync_status)
      VALUES ('bookmark', ?, CURRENT_TIMESTAMP, 'pending')
    `).run(id)

    return { success: true }
  }

  throw createError({
    statusCode: 405,
    message: 'Method not allowed',
  })
})
