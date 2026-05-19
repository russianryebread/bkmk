import { db } from '~/server/database'
import { bookmarks, bookmarkTags, tags, syncMetadata } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getRouterParam } from 'h3'
import { requireAuth } from '~/server/utils/auth'
import { deleteImagesForBookmark } from '~/server/utils/images'

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

  // Verify bookmark belongs to user and fetch its url
  const [existing] = await db
    .select({ id: bookmarks.id, url: bookmarks.url })
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

  const now = new Date().toISOString()

  // Downgrade the bookmark to a plain link with metadata
  await db
    .update(bookmarks)
    .set({
      cleanedMarkdown: `[${existing.url}](${existing.url})`,
      originalHtml: null,
      readingTimeMinutes: null,
      wordCount: null,
      thumbnailImagePath: null,
      updatedAt: now,
    })
    .where(eq(bookmarks.id, id))

  // Delete every stored image for this bookmark
  await deleteImagesForBookmark(id)

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

  // Re-query the updated bookmark in the same shape the GET handler returns
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

  const bm = rows[0]

  if (!bm) {
    throw createError({ statusCode: 404, message: 'Bookmark not found' })
  }

  return {
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
})
