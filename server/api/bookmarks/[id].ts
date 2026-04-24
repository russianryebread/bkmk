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
    // Get single bookmark with tags
    const result = await db
      .select()
      .from(bookmarks)
      .leftJoin(bookmarkTags, eq(bookmarks.id, bookmarkTags.bookmarkId))
      .leftJoin(tags, eq(bookmarkTags.tagId, tags.id))
      .where(and(
        eq(bookmarks.id, id),
        eq(bookmarks.userId, currentUser.id)
      ))

    if (result.length === 0 || !result[0].id) {
      throw createError({
        statusCode: 404,
        message: 'Bookmark not found',
      })
    }

    // Update last accessed time
    await db
      .update(bookmarks)
      .set({ lastAccessedAt: new Date().toISOString() })
      .where(eq(bookmarks.id, id))

    return result[0]
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
      cleanedMarkdown,
      isFavorite,
      isRead,
      sortOrder,
    } = body

    const updates: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    }

    if (title !== undefined) updates.title = title
    if (url !== undefined) updates.url = url
    if (description !== undefined) updates.description = description
    if (cleanedMarkdown !== undefined) updates.cleanedMarkdown = cleanedMarkdown
    if (isFavorite !== undefined) updates.isFavorite = isFavorite ? 1 : 0
    if (isRead !== undefined) {
      updates.isRead = isRead ? 1 : 0
      if (isRead) {
        updates.readAt = new Date().toISOString()
      }
    }
    if (sortOrder !== undefined) updates.sortOrder = sortOrder

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

    // Soft delete bookmark
    await db.update(bookmarks)
      .set({
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(bookmarks.id, id))

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
