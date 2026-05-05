import { db } from '~/server/database'
import { bookmarks, bookmarkTags, tags, syncMetadata } from '~/server/database/schema'
import { eq, and, inArray } from 'drizzle-orm'
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
    const rows = await db
      .select({
        id: bookmarks.id,
        title: bookmarks.title,
        url: bookmarks.url,
        description: bookmarks.description,
        cleanedMarkdown: bookmarks.cleanedMarkdown,
        readingTimeMinutes: bookmarks.readingTimeMinutes,
        savedAt: bookmarks.savedAt,
        lastAccessedAt: bookmarks.lastAccessedAt,
        isFavorite: bookmarks.isFavorite,
        sortOrder: bookmarks.sortOrder,
        thumbnailImagePath: bookmarks.thumbnailImagePath,
        isRead: bookmarks.isRead,
        readAt: bookmarks.readAt,
        sourceDomain: bookmarks.sourceDomain,
        wordCount: bookmarks.wordCount,
        createdAt: bookmarks.createdAt,
        updatedAt: bookmarks.updatedAt,
        tagName: tags.name,
      })
      .from(bookmarks)
      .leftJoin(bookmarkTags, eq(bookmarks.id, bookmarkTags.bookmarkId))
      .leftJoin(tags, eq(bookmarkTags.tagId, tags.id))
      .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, currentUser.id)))

    if (rows.length === 0) {
      throw createError({ statusCode: 404, message: 'Bookmark not found' })
    }

    const bm = rows[0]
    const result = {
      id: bm.id,
      title: bm.title,
      url: bm.url,
      description: bm.description,
      cleanedMarkdown: bm.cleanedMarkdown,
      readingTimeMinutes: bm.readingTimeMinutes,
      savedAt: bm.savedAt,
      lastAccessedAt: bm.lastAccessedAt,
      isFavorite: Boolean(bm.isFavorite),
      sortOrder: bm.sortOrder,
      thumbnailImagePath: bm.thumbnailImagePath,
      isRead: Boolean(bm.isRead),
      readAt: bm.readAt,
      sourceDomain: bm.sourceDomain,
      wordCount: bm.wordCount,
      createdAt: bm.createdAt,
      updatedAt: bm.updatedAt,
      tags: rows.filter(r => r.tagName).map(r => r.tagName as string),
    }

    await db
      .update(bookmarks)
      .set({ lastAccessedAt: new Date().toISOString() })
      .where(eq(bookmarks.id, id))

    return result
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
      tags: tagNames,
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

    // Update tags if provided (replace all)
    if (Array.isArray(tagNames)) {
      // Delete existing tag associations
      await db.delete(bookmarkTags).where(eq(bookmarkTags.bookmarkId, id))

      if (tagNames.length > 0) {
        // Look up tag IDs by name, create missing ones
        const existingTags = await db
          .select({ id: tags.id, name: tags.name })
          .from(tags)
          .where(and(eq(tags.userId, currentUser.id), inArray(tags.name, tagNames)))

        const existingByName = new Map(existingTags.map(t => [t.name, t.id]))

        for (const name of tagNames) {
          let tagId = existingByName.get(name)
          if (!tagId) {
            const now = new Date().toISOString()
            const [newTag] = await db.insert(tags).values({
              id: crypto.randomUUID(),
              name,
              userId: currentUser.id,
              type: 'bookmark',
              createdAt: now,
            }).returning({ id: tags.id })
            tagId = newTag.id
          }
          await db.insert(bookmarkTags).values({
            id: crypto.randomUUID(),
            bookmarkId: id,
            tagId,
          }).onConflictDoNothing()
        }
      }
    }

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
