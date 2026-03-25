import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Bookmark ID is required',
    })
  }

  const method = event.method

  if (method === 'GET') {
    // Get single bookmark
    const bookmark = db.prepare(`
      SELECT b.*,
        GROUP_CONCAT(DISTINCT t.name) as tags,
        GROUP_CONCAT(DISTINCT t.id) as tag_ids
      FROM bookmarks b
      LEFT JOIN bookmark_tags bt ON b.id = bt.bookmark_id
      LEFT JOIN tags t ON bt.tag_id = t.id
      WHERE b.id = ?
      GROUP BY b.id
    `).get(id) as any

    if (!bookmark) {
      throw createError({
        statusCode: 404,
        message: 'Bookmark not found',
      })
    }

    // Update last accessed time
    db.prepare(`
      UPDATE bookmarks 
      SET last_accessed_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(id)

    return {
      ...bookmark,
      is_favorite: Boolean(bookmark.is_favorite),
      is_read: Boolean(bookmark.is_read),
      tags: bookmark.tags ? bookmark.tags.split(',') : [],
      tag_ids: bookmark.tag_ids ? bookmark.tag_ids.split(',') : [],
    }
  }

  if (method === 'PUT') {
    // Update bookmark
    const body = await readBody(event)
    const {
      title,
      url,
      description,
      is_favorite,
      is_read,
      sort_order,
    } = body

    const updates: string[] = []
    const params: any[] = []

    if (title !== undefined) {
      updates.push('title = ?')
      params.push(title)
    }
    if (url !== undefined) {
      updates.push('url = ?')
      params.push(url)
    }
    if (description !== undefined) {
      updates.push('description = ?')
      params.push(description)
    }
    if (is_favorite !== undefined) {
      updates.push('is_favorite = ?')
      params.push(is_favorite ? 1 : 0)
    }
    if (is_read !== undefined) {
      updates.push('is_read = ?')
      params.push(is_read ? 1 : 0)
      if (is_read) {
        updates.push('read_at = CURRENT_TIMESTAMP')
      }
    }
    if (sort_order !== undefined) {
      updates.push('sort_order = ?')
      params.push(sort_order)
    }

    updates.push('updated_at = CURRENT_TIMESTAMP')
    params.push(id)

    if (updates.length > 1) {
      db.prepare(`
        UPDATE bookmarks 
        SET ${updates.join(', ')}
        WHERE id = ?
      `).run(...params)
    }

    // Update sync metadata
    db.prepare(`
      INSERT OR REPLACE INTO sync_metadata (entity_type, entity_id, last_modified_at, sync_status)
      VALUES ('bookmark', ?, CURRENT_TIMESTAMP, 'pending')
    `).run(id)

    return { success: true }
  }

  if (method === 'DELETE') {
    db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id)
    
    // Update sync metadata
    db.prepare(`
      INSERT OR REPLACE INTO sync_metadata (entity_type, entity_id, last_modified_at, is_deleted, sync_status)
      VALUES ('bookmark', ?, CURRENT_TIMESTAMP, 1, 'pending')
    `).run(id)

    return { success: true }
  }

  throw createError({
    statusCode: 405,
    message: 'Method not allowed',
  })
})
