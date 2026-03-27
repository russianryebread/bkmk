import { db } from '~/server/database'
import { bookmarks, bookmarkTags, tags, syncMetadata } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getRouterParam } from 'h3'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  // Require authentication
  const currentUser = await requireAuth(event)
  
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Bookmark ID is required',
    })
  }

  const method = event.method

  if (method === 'GET') {
    // Verify bookmark belongs to user
    const [bookmark] = await db
      .select({ id: bookmarks.id })
      .from(bookmarks)
      .where(and(
        eq(bookmarks.id, id),
        eq(bookmarks.userId, currentUser.id)
      ))
      .limit(1)

    if (!bookmark) {
      throw createError({
        statusCode: 404,
        message: 'Bookmark not found',
      })
    }
    // Get single bookmark with tags
    const result = await db
      .select({
        id: bookmarks.id,
        title: bookmarks.title,
        url: bookmarks.url,
        description: bookmarks.description,
        cleaned_markdown: bookmarks.cleanedMarkdown,
        original_html: bookmarks.originalHtml,
        reading_time_minutes: bookmarks.readingTimeMinutes,
        saved_at: bookmarks.savedAt,
        last_accessed_at: bookmarks.lastAccessedAt,
        is_favorite: bookmarks.isFavorite,
        sort_order: bookmarks.sortOrder,
        thumbnail_image_path: bookmarks.thumbnailImagePath,
        is_read: bookmarks.isRead,
        read_at: bookmarks.readAt,
        source_domain: bookmarks.sourceDomain,
        word_count: bookmarks.wordCount,
        created_at: bookmarks.createdAt,
        updated_at: bookmarks.updatedAt,
        tagName: tags.name,
        tagId: tags.id,
      })
      .from(bookmarks)
      .leftJoin(bookmarkTags, eq(bookmarks.id, bookmarkTags.bookmarkId))
      .leftJoin(tags, eq(bookmarkTags.tagId, tags.id))
      .where(eq(bookmarks.id, id))

    if (result.length === 0 || !result[0].id) {
      throw createError({
        statusCode: 404,
        message: 'Bookmark not found',
      })
    }

    // Group tags
    const firstRow = result[0]
    const bookmarkData = {
      id: firstRow.id,
      title: firstRow.title,
      url: firstRow.url,
      description: firstRow.description,
      cleaned_markdown: firstRow.cleaned_markdown,
      original_html: firstRow.original_html,
      reading_time_minutes: firstRow.reading_time_minutes,
      saved_at: firstRow.saved_at,
      last_accessed_at: firstRow.last_accessed_at,
      is_favorite: Boolean(firstRow.is_favorite),
      sort_order: firstRow.sort_order,
      thumbnail_image_path: firstRow.thumbnail_image_path,
      is_read: Boolean(firstRow.is_read),
      read_at: firstRow.read_at,
      source_domain: firstRow.source_domain,
      word_count: firstRow.word_count,
      created_at: firstRow.created_at,
      updated_at: firstRow.updated_at,
      tags: [] as string[],
      tag_ids: [] as string[],
    }

    for (const row of result) {
      if (row.tagName) {
        bookmarkData.tags.push(row.tagName)
        bookmarkData.tag_ids.push(row.tagId!)
      }
    }

    // Update last accessed time
    await db
      .update(bookmarks)
      .set({ lastAccessedAt: new Date().toISOString() })
      .where(eq(bookmarks.id, id))

    return bookmarkData
  }

  if (method === 'PUT') {
    // Verify bookmark belongs to user
    const [existing] = await db
      .select({ id: bookmarks.id })
      .from(bookmarks)
      .where(and(
        eq(bookmarks.id, id),
        eq(bookmarks.userId, currentUser.id)
      ))
      .limit(1)

    if (!existing) {
      throw createError({
        statusCode: 404,
        message: 'Bookmark not found',
      })
    }

    // Update bookmark
    const body = await readBody(event)
    const {
      title,
      url,
      description,
      cleaned_markdown,
      is_favorite,
      is_read,
      sort_order,
    } = body

    const updates: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    }

    if (title !== undefined) updates.title = title
    if (url !== undefined) updates.url = url
    if (description !== undefined) updates.description = description
    if (cleaned_markdown !== undefined) updates.cleanedMarkdown = cleaned_markdown
    if (is_favorite !== undefined) updates.isFavorite = is_favorite ? 1 : 0
    if (is_read !== undefined) {
      updates.isRead = is_read ? 1 : 0
      if (is_read) {
        updates.readAt = new Date().toISOString()
      }
    }
    if (sort_order !== undefined) updates.sortOrder = sort_order

    await db.update(bookmarks).set(updates).where(eq(bookmarks.id, id))

    // Update sync metadata
    await db
      .insert(syncMetadata)
      .values({
        id: crypto.randomUUID(),
        entityType: 'bookmark',
        entityId: id,
        lastModifiedAt: new Date().toISOString(),
        syncStatus: 'pending',
      })
      .onConflictDoUpdate({
        target: [syncMetadata.entityType, syncMetadata.entityId],
        set: {
          lastModifiedAt: new Date().toISOString(),
          syncStatus: 'pending',
        },
      })

    return { success: true }
  }

  if (method === 'DELETE') {
    // Verify bookmark belongs to user
    const [existing] = await db
      .select({ id: bookmarks.id })
      .from(bookmarks)
      .where(and(
        eq(bookmarks.id, id),
        eq(bookmarks.userId, currentUser.id)
      ))
      .limit(1)

    if (!existing) {
      throw createError({
        statusCode: 404,
        message: 'Bookmark not found',
      })
    }

    // Delete bookmark (cascade will handle bookmark_tags)
    await db.delete(bookmarks).where(eq(bookmarks.id, id))

    // Update sync metadata
    await db
      .insert(syncMetadata)
      .values({
        id: crypto.randomUUID(),
        entityType: 'bookmark',
        entityId: id,
        lastModifiedAt: new Date().toISOString(),
        isDeleted: 1,
        syncStatus: 'pending',
      })
      .onConflictDoUpdate({
        target: [syncMetadata.entityType, syncMetadata.entityId],
        set: {
          lastModifiedAt: new Date().toISOString(),
          isDeleted: 1,
          syncStatus: 'pending',
        },
      })

    return { success: true }
  }

  throw createError({
    statusCode: 405,
    message: 'Method not allowed',
  })
})
