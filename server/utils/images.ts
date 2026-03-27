import sharp from 'sharp'
import { db, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

const MAX_WIDTH = 1200
const QUALITY = 80

export interface ProcessedImage {
  id: string
  originalUrl: string
  mimeType: string
  width: number | null
  height: number | null
  sizeBytes: number
}

/**
 * Download, resize, compress, and store an image
 */
export async function processAndStoreImage(
  imageUrl: string,
  bookmarkId: string
): Promise<ProcessedImage | null> {
  try {
    // Check if we already have this image for this bookmark
    const existing = await db
      .select()
      .from(schema.images)
      .where(eq(schema.images.originalUrl, imageUrl))
      .limit(1)

    if (existing.length > 0) {
      return {
        id: existing[0].id,
        originalUrl: existing[0].originalUrl,
        mimeType: existing[0].mimeType,
        width: existing[0].width,
        height: existing[0].height,
        sizeBytes: existing[0].sizeBytes,
      }
    }

    // Download the image
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Bkmk/1.0)',
      },
    })

    if (!response.ok) {
      console.error(`Failed to download image: ${imageUrl}`, response.status)
      return null
    }

    // Get content type
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    
    // Only process images
    if (!contentType.startsWith('image/')) {
      return null
    }

    const buffer = await response.arrayBuffer()
    const inputBuffer = Buffer.from(buffer)

    // Process with sharp
    const image = sharp(inputBuffer)
    const metadata = await image.metadata()

    // Resize if needed
    let processed = image
    if (metadata.width && metadata.width > MAX_WIDTH) {
      processed = processed.resize(MAX_WIDTH, null, {
        withoutEnlargement: true,
      })
    }

    // Convert to WebP and compress
    const outputBuffer = await processed
      .webp({ quality: QUALITY })
      .toBuffer()

    // Get output metadata
    const outputMeta = await sharp(outputBuffer).metadata()

    // Generate unique ID
    const id = crypto.randomUUID()

    // Store in database with base64 encoded data
    await db.insert(schema.images).values({
      id,
      bookmarkId,
      originalUrl: imageUrl,
      mimeType: 'image/webp',
      width: outputMeta.width || null,
      height: outputMeta.height || null,
      sizeBytes: outputBuffer.length,
      data: outputBuffer.toString('base64'),
    })

    return {
      id,
      originalUrl: imageUrl,
      mimeType: 'image/webp',
      width: outputMeta.width || null,
      height: outputMeta.height || null,
      sizeBytes: outputBuffer.length,
    }
  } catch (error) {
    console.error(`Error processing image: ${imageUrl}`, error)
    return null
  }
}

/**
 * Get image data from database
 */
export async function getStoredImage(imageId: string) {
  const [image] = await db
    .select()
    .from(schema.images)
    .where(eq(schema.images.id, imageId))
    .limit(1)

  if (!image) {
    return null
  }

  // Get the actual image data from a separate table or file
  // For now, we'll need to store image data separately
  return image
}

/**
 * Extract image URLs from HTML content
 */
export function extractImageUrls(html: string, baseUrl: string): string[] {
  const imageUrls: string[] = []
  
  // Match img tags with src attribute
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  let match
  
  while ((match = imgRegex.exec(html)) !== null) {
    let src = match[1]
    
    // Skip data URLs, SVG filters, etc.
    if (!src || src.startsWith('data:') || src.startsWith('//') || src.startsWith('javascript:')) {
      continue
    }
    
    // Handle relative URLs
    if (src.startsWith('/')) {
      // Absolute path on same domain
      try {
        const url = new URL(baseUrl)
        src = `${url.protocol}//${url.host}${src}`
      } catch {
        continue
      }
    } else if (!src.startsWith('http://') && !src.startsWith('https://')) {
      // Relative path - resolve against base URL
      try {
        const resolved = new URL(src, baseUrl)
        src = resolved.href
      } catch {
        continue
      }
    }
    
    // Only include http/https URLs
    if (src.startsWith('http://') || src.startsWith('https://')) {
      imageUrls.push(src)
    }
  }
  
  return [...new Set(imageUrls)] // Remove duplicates
}

/**
 * Replace image URLs in HTML with local API URLs
 */
export function replaceImageUrlsInHtml(
  html: string,
  imageMap: Map<string, string> // originalUrl -> localId
): string {
  let result = html
  
  imageMap.forEach((localId, originalUrl) => {
    // Escape special regex characters in URL
    const escapedUrl = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escapedUrl, 'g')
    result = result.replace(regex, `/api/images/${localId}`)
  })
  
  return result
}

/**
 * Replace image URLs in markdown with local API URLs
 */
export function replaceImageUrlsInMarkdown(
  markdown: string,
  imageMap: Map<string, string>
): string {
  let result = markdown
  
  imageMap.forEach((localId, originalUrl) => {
    // Match markdown image syntax: ![alt](url)
    const escapedUrl = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`!\\[([^\\]]*)\\]\\(${escapedUrl}\\)`, 'g')
    result = result.replace(regex, `![$1](/api/images/${localId})`)
  })
  
  return result
}

/**
 * Delete all images for a bookmark
 */
export async function deleteImagesForBookmark(bookmarkId: string) {
  await db
    .delete(schema.images)
    .where(eq(schema.images.bookmarkId, bookmarkId))
}
