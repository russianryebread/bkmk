import { db, schema } from '~/server/database'
import { scrapeUrl, extractDomain } from '~/server/utils/scraper'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '~/server/utils/auth'
import {
  processAndStoreImage,
  extractImageUrls,
  replaceImageUrlsInHtml,
  replaceImageUrlsInMarkdown,
} from '~/server/utils/images'

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

  // Insert bookmark with userId first (so we have the ID for images)
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

  // Process images - use originalHtml which has the real image URLs (before cheerio modified them)
  const imageUrls = extractImageUrls(scraped.originalHtml || '', url)
  const imageMap = new Map<string, string>() // originalUrl -> localId

  console.log('[Scrape] Found', imageUrls.length, 'images to process')

  // Process images concurrently with a limit
  const processedImages = await Promise.all(
    imageUrls.slice(0, 20).map(imageUrl => processAndStoreImage(imageUrl, bookmark.id))
  )

  // Build image map
  for (const processed of processedImages) {
    if (processed) {
      imageMap.set(processed.originalUrl, processed.id)
    }
  }

  console.log('[Scrape] Processed', imageMap.size, 'images')

  // Update bookmark with processed content (images replaced with API URLs)
  let processedHtml = scraped.originalHtml || scraped.html
  let processedMarkdown = scraped.markdown

  if (imageMap.size > 0) {
    processedHtml = replaceImageUrlsInHtml(scraped.originalHtml || scraped.html || '', imageMap)
    processedMarkdown = replaceImageUrlsInMarkdown(scraped.markdown || '', imageMap)
  }

  // Update bookmark with processed content
  await db
    .update(schema.bookmarks)
    .set({
      originalHtml: processedHtml,
      cleanedMarkdown: processedMarkdown,
    })
    .where(eq(schema.bookmarks.id, bookmark.id))

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
    imagesProcessed: imageMap.size,
  }
})
