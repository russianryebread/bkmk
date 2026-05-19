import { db, schema } from '~/server/database'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '~/server/utils/auth'

// Serve images from database - can use either [id].ts or [filename].ts
export default defineEventHandler(async (event) => {
  // Authentication is mandatory. Browsers send the auth cookie automatically
  // on <img> requests, so this does not break image rendering.
  const currentUser = await requireAuth(event)

  // Support both filename and id parameters
  const filename = getRouterParam(event, 'filename')
  const id = getRouterParam(event, 'id')

  // Use id if available, otherwise use filename (strip extension if present)
  const imageId = id || (filename ? filename.replace(/\.[^.]+$/, '') : null)

  if (!imageId) {
    throw createError({ statusCode: 400, message: 'Image ID is required' })
  }

  // Get image from database, verifying ownership via the parent bookmark.
  const [image] = await db
    .select({
      id: schema.images.id,
      mimeType: schema.images.mimeType,
      data: schema.images.data,
      originalUrl: schema.images.originalUrl,
    })
    .from(schema.images)
    .innerJoin(schema.bookmarks, eq(schema.images.bookmarkId, schema.bookmarks.id))
    .where(
      and(
        eq(schema.images.id, imageId),
        eq(schema.bookmarks.userId, currentUser.id)
      )
    )
    .limit(1)

  if (!image) {
    throw createError({ statusCode: 404, message: 'Image not found' })
  }

  // Decode base64 and return as binary
  const buffer = Buffer.from(image.data, 'base64')

  // Set headers
  setHeader(event, 'Content-Type', image.mimeType)
  setHeader(event, 'Cache-Control', 'public, max-age=31536000') // 1 year cache
  setHeader(event, 'Content-Length', buffer.length.toString())

  return buffer
})
