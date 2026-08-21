import { db, schema } from '~/server/database'
import { scrapeUrl, extractDomain } from '~/server/utils/scraper'
import { eq, and, isNull } from 'drizzle-orm'
import { requireAuth } from '~/server/utils/auth'
import { UrlCleaner } from '~/server/utils/url-cleaner'
import { assertSafeUrl } from '~/server/utils/ssrf'
import {
  processAndStoreImage,
  extractImageUrls,
  replaceImageUrlsInHtml,
  replaceImageUrlsInMarkdown,
} from '~/server/utils/images'
import { parseVideoUrl, type VideoRef } from '~/utils/video'

// Video handling. Detection, ID extraction, and the embeddable-platform list
// all live in utils/video.ts so the scraper and the markdown renderer can never
// disagree about what counts as a video.
//
// Deliberately narrow: only platforms we can actually embed take this branch.
// Tweets, Instagram posts, and TikToks fall through to the normal scraper,
// which produces a real reader view where it can and a plain link bookmark
// where it can't — both better than the placeholder this branch used to write.

interface VideoMeta {
  title: string | null
  author: string | null
  thumbnailUrl: string | null
}

// Fetch title / author / thumbnail from the platform's oEmbed endpoint.
// Best-effort: a failure here still produces a usable bookmark.
async function fetchVideoMeta(video: VideoRef): Promise<VideoMeta> {
  const empty: VideoMeta = { title: null, author: null, thumbnailUrl: null }
  try {
    const response = await fetch(video.oembedUrl, {
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) return empty
    const data = (await response.json()) as {
      title?: string
      author_name?: string
      thumbnail_url?: string
    }
    return {
      title: data.title ?? null,
      author: data.author_name ?? null,
      thumbnailUrl: data.thumbnail_url ?? null,
    }
  } catch (e) {
    console.log('[Scrape] oEmbed lookup failed for', video.watchUrl, e)
    return empty
  }
}

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

  // Reject absurdly long URLs before doing any further work.
  if (url.length > 2048) {
    throw createError({
      statusCode: 400,
      message: 'URL is too long',
    })
  }

  // Reject non-http(s) URLs early (complements the SSRF guard in the
  // scraper/image utils).
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('bad scheme')
    }
  } catch {
    throw createError({
      statusCode: 400,
      message: 'URL must be a valid http(s) URL',
    })
  }

  // Validate URL
  let cleanUrl: string
  try {
    cleanUrl = UrlCleaner.clean(url)
  } catch {
    throw createError({
      statusCode: 400,
      message: 'Invalid URL format',
    })
  }

  // SSRF guard: reject URLs that resolve to internal/private addresses up
  // front, so a blocked URL returns an explicit error instead of being
  // swallowed into a plain-link fallback bookmark.
  try {
    await assertSafeUrl(cleanUrl)
  } catch {
    throw createError({
      statusCode: 400,
      message: 'This URL cannot be fetched',
    })
  }

  // Check if bookmark already exists for this user (use cleaned URL)
  const [existing] = await db
    .select({
      id: schema.bookmarks.id,
      url: schema.bookmarks.url,
    })
    .from(schema.bookmarks)
    .where(and(
      eq(schema.bookmarks.url, cleanUrl),
      eq(schema.bookmarks.userId, currentUser.id),
      isNull(schema.bookmarks.deletedAt),
    ))
    .limit(1)

  if (existing) {
    throw createError({
      statusCode: 409,
      message: 'Bookmark already exists',
      data: {
        existingUrl: `/bookmarks/${existing.id}`,
        bookmarkId: existing.id,
      },
    })
  }

  // Video URLs get an embeddable bookmark: oEmbed metadata plus a locally
  // stored thumbnail. The content is a thumbnail-wrapped-in-a-link, which the
  // markdown renderer recognizes and upgrades into a click-to-play player.
  const video = parseVideoUrl(cleanUrl)
  if (video) {
    const sourceDomain = extractDomain(cleanUrl)
    const now = new Date().toISOString()

    const meta = await fetchVideoMeta(video)
    const title = meta.title || `${video.platform.charAt(0).toUpperCase()}${video.platform.slice(1)} video`
    const description = meta.author ? `by ${meta.author}` : `Saved from ${video.platform}`

    const [bookmark] = await db
      .insert(schema.bookmarks)
      .values({
        id: crypto.randomUUID(),
        userId: currentUser.id,
        title,
        url: cleanUrl,
        description,
        // Placeholder content until the thumbnail lands below. A bare video URL
        // on its own line is enough for the renderer to build a player.
        cleanedMarkdown: video.watchUrl,
        sourceDomain,
        savedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    if (!bookmark) {
      throw createError({ statusCode: 500, message: 'Failed to create bookmark' })
    }

    // Store the poster locally so it survives the platform rotating its CDN,
    // keeps img-src at 'self', and is available offline. A failure here just
    // means the player renders without a poster.
    let thumbnailImagePath: string | null = null
    let cleanedMarkdown = video.watchUrl
    if (meta.thumbnailUrl) {
      const stored = await processAndStoreImage(meta.thumbnailUrl, bookmark.id)
      if (stored) {
        thumbnailImagePath = `/api/images/${stored.id}`
        // Square brackets would terminate the link label early.
        cleanedMarkdown = `[![${title.replace(/[[\]]/g, '')}](${thumbnailImagePath})](${video.watchUrl})`
        await db
          .update(schema.bookmarks)
          .set({ thumbnailImagePath, cleanedMarkdown })
          .where(eq(schema.bookmarks.id, bookmark.id))
      }
    }

    // Update sync metadata
    await db
      .insert(schema.syncMetadata)
      .values({
        id: crypto.randomUUID(),
        entityType: 'bookmark',
        entityId: bookmark.id,
        syncStatus: 'pending',
      })

    return {
      ...bookmark,
      thumbnailImagePath,
      cleanedMarkdown,
      isFavorite: Boolean(bookmark.isFavorite),
      isRead: Boolean(bookmark.isRead),
      tags: [],
      isVideo: true,
      platform: video.platform,
    }
  }

  // Try to scrape the URL, but handle failures gracefully
  let scraped = null
  let scrapeError: string | null = null

  try {
    scraped = await scrapeUrl(url)
  } catch (e: any) {
    scrapeError = e.message
    console.log('[Scrape] Failed to scrape URL, creating text bookmark:', scrapeError)
  }

  // If scraping failed, create a text URL bookmark
  if (!scraped) {
    const sourceDomain = extractDomain(url)
    const now = new Date().toISOString()

    // Extract a readable domain for the title
    let title = sourceDomain
    if (title.includes('www.')) {
      title = title.replace('www.', '')
    }
    // Capitalize first letter of domain name
    if (title) {
      title = title.charAt(0).toUpperCase() + title.slice(1)
    }

    // Create a markdown link as the content
    const markdownContent = `[${cleanUrl}](${cleanUrl})`

    const [bookmark] = await db
      .insert(schema.bookmarks)
      .values({
        id: crypto.randomUUID(),
        userId: currentUser.id,
        title: title || 'Bookmark',
        url: cleanUrl,
        description: `Saved from ${sourceDomain || 'unknown source'}`,
        cleanedMarkdown: markdownContent,
        sourceDomain: sourceDomain,
        savedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    if (!bookmark) {
      throw createError({ statusCode: 500, message: 'Failed to create bookmark' })
    }

    // Update sync metadata
    await db
      .insert(schema.syncMetadata)
      .values({
        id: crypto.randomUUID(),
        entityType: 'bookmark',
        entityId: bookmark.id,
        syncStatus: 'pending',
      })

    return {
      ...bookmark,
      isFavorite: Boolean(bookmark.isFavorite),
      isRead: Boolean(bookmark.isRead),
      tags: [],
      scrapeError,
      fallbackBookmark: true,
    }
  }

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
      url: cleanUrl,
      description: scraped.description,
      // originalHtml: scraped.html, // Let's not store the original HTML.
      cleanedMarkdown: scraped.markdown,
      readingTimeMinutes: scraped.readingTimeMinutes,
      sourceDomain: sourceDomain,
      wordCount: scraped.wordCount,
      savedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
  if (!bookmark) {
    throw createError({ statusCode: 500, message: 'Failed to create bookmark' })
  }

  // Process images - use originalHtml which has the real image URLs (before cheerio modified them)
  const imageUrls = extractImageUrls(scraped.originalHtml || '', url)
  const imageMap = new Map<string, string>() // originalUrl -> localId

  console.log('[Scrape] Found', imageUrls.length, 'images to process')

  // Process images with a bounded concurrency pool so one slow host cannot
  // stall the whole request. Individual failures/timeouts are tolerated
  // (Promise.allSettled semantics) — the bookmark is still saved if images
  // fail to download.
  const IMAGE_CONCURRENCY = 3
  const imagesToProcess = imageUrls.slice(0, 20)
  const processedImages: (Awaited<ReturnType<typeof processAndStoreImage>>)[] = []
  let nextImageIndex = 0

  const bookmarkId = bookmark.id
  async function imageWorker() {
    while (true) {
      const index = nextImageIndex++
      if (index >= imagesToProcess.length) return
      const imgUrl = imagesToProcess[index]
      if (!imgUrl) continue
      try {
        processedImages[index] = await processAndStoreImage(imgUrl, bookmarkId)
      } catch (e) {
        // A failed image must never abort the scrape.
        console.error('[Scrape] Image processing failed:', imgUrl, e)
        processedImages[index] = null
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(IMAGE_CONCURRENCY, imagesToProcess.length) }, () => imageWorker())
  )

  // Build image map
  for (const processed of processedImages) {
    if (processed) {
      imageMap.set(processed.originalUrl, processed.id)
    }
  }

  console.log('[Scrape] Processed', imageMap.size, 'images')

  // Update bookmark with processed content (images replaced with API URLs)
  // let processedHtml = scraped.originalHtml || scraped.html
  let processedMarkdown = scraped.markdown

  if (imageMap.size > 0) {
    // processedHtml = replaceImageUrlsInHtml(scraped.originalHtml || scraped.html || '', imageMap)
    processedMarkdown = replaceImageUrlsInMarkdown(scraped.markdown || '', imageMap)
  }

  // Update bookmark with processed content
  await db
    .update(schema.bookmarks)
    .set({
      // originalHtml: processedHtml,
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

  if (!fullBookmark) {
    throw createError({ statusCode: 500, message: 'Failed to load bookmark' })
  }

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
    imagesProcessed: imageMap.size,
  }
})
