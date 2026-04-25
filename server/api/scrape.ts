import { db, schema } from '~/server/database'
import { scrapeUrl, extractDomain } from '~/server/utils/scraper'
import { eq, and, isNull } from 'drizzle-orm'
import { requireAuth } from '~/server/utils/auth'
import { UrlCleaner } from '~/server/utils/url-cleaner'
import {
  processAndStoreImage,
  extractImageUrls,
  replaceImageUrlsInHtml,
  replaceImageUrlsInMarkdown,
} from '~/server/utils/images'

// Video platform detection patterns
const VIDEO_PATTERNS = [
  // YouTube
  /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)/,
  // YouTube Shorts
  /youtube\.com\/shorts\//,
  // Vimeo
  /vimeo\.com\//,
  // Facebook videos
  /facebook\.com\/.*\/videos\//,
  /facebook\.com\/watch\/?\?v=/,
  // Instagram
  /instagram\.com\/(?:p|reel|tv)\//,
  // TikTok
  /tiktok\.com\//,
  // Twitter/X videos
  /twitter\.com\//,
  /x\.com\//,
  // Dailymotion
  /dailymotion\.com\//,
]

function isVideoUrl(url: string): boolean {
  return VIDEO_PATTERNS.some(pattern => pattern.test(url))
}

function getVideoPlatform(url: string): string | null {
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube'
  if (/vimeo\.com/.test(url)) return 'vimeo'
  if (/facebook\.com/.test(url)) return 'facebook'
  if (/instagram\.com/.test(url)) return 'instagram'
  if (/tiktok\.com/.test(url)) return 'tiktok'
  if (/twitter\.com|x\.com/.test(url)) return 'twitter'
  if (/dailymotion\.com/.test(url)) return 'dailymotion'
  return null
}

// Helper function to extract YouTube video ID
function extractYouTubeId(videoUrl: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const pattern of patterns) {
    const match = videoUrl.match(pattern)
    if (match) return match[1]
  }
  return null
}

// Helper function to extract Vimeo video ID
function extractVimeoId(videoUrl: string): string | null {
  const match = videoUrl.match(/vimeo\.com\/(\d+)/)
  return match ? match[1] : null
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

  // For video URLs, create a bookmark with video metadata
  if (isVideoUrl(url)) {
    const sourceDomain = extractDomain(url)
    const platform = getVideoPlatform(url)
    const now = new Date().toISOString()

    // Try to fetch video metadata from oEmbed APIs
    let videoTitle = `${platform?.charAt(0).toUpperCase()}${platform?.slice(1)} Video`
    let videoDescription = `Saved from ${platform}`

    try {
      if (platform === 'youtube') {
        // Extract video ID and fetch oEmbed data
        const youtubeId = extractYouTubeId(url)
        if (youtubeId) {
          const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${youtubeId}&format=json`
          const oembedResponse = await fetch(oembedUrl)
          if (oembedResponse.ok) {
            const oembedData = await oembedResponse.json() as { title?: string; author_name?: string }
            if (oembedData.title) {
              videoTitle = oembedData.title
              videoDescription = oembedData.author_name ? `by ${oembedData.author_name}` : ''
            }
          }
        }
      } else if (platform === 'vimeo') {
        const vimeoId = extractVimeoId(url)
        if (vimeoId) {
          const oembedUrl = `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${vimeoId}`
          const oembedResponse = await fetch(oembedUrl)
          if (oembedResponse.ok) {
            const oembedData = await oembedResponse.json() as { title?: string; author_name?: string }
            if (oembedData.title) {
              videoTitle = oembedData.title
              videoDescription = oembedData.author_name ? `by ${oembedData.author_name}` : ''
            }
          }
        }
      }
    } catch (e) {
      console.log('[Scrape] Could not fetch video metadata, using defaults:', e)
    }

    // For video bookmarks, set content as a markdown link that can be edited
    const videoContent = `[Add content for ${platform} video](${cleanUrl})`

    const [bookmark] = await db
      .insert(schema.bookmarks)
      .values({
        id: crypto.randomUUID(),
        userId: currentUser.id,
        title: videoTitle,
        url: cleanUrl,
        description: videoDescription || `Saved from ${platform}`,
        cleanedMarkdown: videoContent,
        sourceDomain: sourceDomain,
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

    return {
      ...bookmark,
      isFavorite: Boolean(bookmark.isFavorite),
      isRead: Boolean(bookmark.isRead),
      tags: [],
      isVideo: true,
      platform,
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
