import { db } from '~/server/database'
import { tags, bookmarkTags, syncMetadata, bookmarks } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getRouterParam } from 'h3'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  // Require authentication
  const currentUser = await requireAuth(event)
  
  const id = getRouterParam(event, 'id')
  const method = event.method

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Bookmark ID is required',
    })
  }

  // Check if bookmark exists and belongs to user
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

  if (method === 'GET') {
    // Get tags for bookmark
    const result = await db
      .select({
        id: tags.id,
        name: tags.name,
        parent_tag_id: tags.parentTagId,
        color: tags.color,
        created_at: tags.createdAt,
      })
      .from(tags)
      .innerJoin(bookmarkTags, eq(tags.id, bookmarkTags.tagId))
      .where(eq(bookmarkTags.bookmarkId, id))
      .orderBy(tags.name)

    return { tags: result }
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

    // Insert new tag associations, ignoring duplicates
    for (const tagId of tag_ids) {
      await db
        .insert(bookmarkTags)
        .values({
          id: crypto.randomUUID(),
          bookmarkId: id,
          tagId: tagId,
        })
        .onConflictDoNothing()
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
    // Remove specific tags from bookmark
    const body = await readBody(event)
    const { tag_ids } = body

    if (!Array.isArray(tag_ids)) {
      throw createError({
        statusCode: 400,
        message: 'tag_ids must be an array',
      })
    }

    for (const tagId of tag_ids) {
      await db
        .delete(bookmarkTags)
        .where(
          and(
            eq(bookmarkTags.bookmarkId, id),
            eq(bookmarkTags.tagId, tagId)
          )
        )
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

  throw createError({
    statusCode: 405,
    message: 'Method not allowed',
  })
})
