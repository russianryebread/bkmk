import { db, schema } from '~/server/database'
import { scrapeUrl, extractDomain } from '~/server/utils/scraper'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  // Require authentication
  const currentUser = await requireAuth(event)
  
  const body = await readBody(event)
  
  const { url } = body

  if (!url || typeof url !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'URL is required',
    })
  }

  // Validate URL
  try {
    new URL(url)
  } catch {
    throw createError({
      statusCode: 400,
      message: 'Invalid URL format',
    })
  }

  // Check if bookmark already exists for this user
  const [existing] = await db
    .select({ id: schema.bookmarks.id })
    .from(schema.bookmarks)
    .where(and(
      eq(schema.bookmarks.url, url),
      eq(schema.bookmarks.userId, currentUser.id)
    ))
    .limit(1)

  if (existing) {
    throw createError({
      statusCode: 409,
      message: 'Bookmark already exists',
    })
  }

  // Scrape the URL
  const scraped = await scrapeUrl(url)

  // Extract domain
  const sourceDomain = extractDomain(url)

  const now = new Date().toISOString()

  // Insert bookmark with userId
  const [bookmark] = await db
    .insert(schema.bookmarks)
    .values({
      id: crypto.randomUUID(),
      userId: currentUser.id,
      title: scraped.title,
      url: url,
      description: scraped.description,
      originalHtml: scraped.html,
      cleanedMarkdown: scraped.markdown,
      readingTimeMinutes: scraped.readingTimeMinutes,
      sourceDomain: sourceDomain,
      wordCount: scraped.wordCount,
      savedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  // Update sync metadata
  await db
    .insert(schema.syncMetadata)
    .values({
      id: crypto.randomUUID(),
      entityType: 'bookmark',
      entityId: bookmark.id,
      syncStatus: 'pending',
    })

  // Get the created bookmark with tags
  const [fullBookmark] = await db
    .select({
      id: schema.bookmarks.id,
      title: schema.bookmarks.title,
      url: schema.bookmarks.url,
      description: schema.bookmarks.description,
      originalHtml: schema.bookmarks.originalHtml,
      cleanedMarkdown: schema.bookmarks.cleanedMarkdown,
      readingTimeMinutes: schema.bookmarks.readingTimeMinutes,
      savedAt: schema.bookmarks.savedAt,
      lastAccessedAt: schema.bookmarks.lastAccessedAt,
      isFavorite: schema.bookmarks.isFavorite,
      sortOrder: schema.bookmarks.sortOrder,
      thumbnailImagePath: schema.bookmarks.thumbnailImagePath,
      isRead: schema.bookmarks.isRead,
      readAt: schema.bookmarks.readAt,
      sourceDomain: schema.bookmarks.sourceDomain,
      wordCount: schema.bookmarks.wordCount,
      createdAt: schema.bookmarks.createdAt,
      updatedAt: schema.bookmarks.updatedAt,
    })
    .from(schema.bookmarks)
    .where(eq(schema.bookmarks.id, bookmark.id))

  // Get tags for this bookmark
  const bookmarkTags = await db
    .select({
      tagName: schema.tags.name,
      tagId: schema.tags.id,
    })
    .from(schema.bookmarkTags)
    .innerJoin(schema.tags, eq(schema.bookmarkTags.tagId, schema.tags.id))
    .where(eq(schema.bookmarkTags.bookmarkId, bookmark.id))

  return {
    ...fullBookmark,
    isFavorite: Boolean(fullBookmark.isFavorite),
    isRead: Boolean(fullBookmark.isRead),
    tags: bookmarkTags.map(bt => bt.tagName),
    tagIds: bookmarkTags.map(bt => bt.tagId),
  }
})
