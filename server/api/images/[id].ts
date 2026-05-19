import { db, schema } from '~/server/database'
import { eq, and } from 'drizzle-orm'
import { getRouterParam } from 'h3'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  // Authentication is mandatory. Browsers send the auth cookie automatically
  // on <img> requests, so this does not break image rendering.
  const currentUser = await requireAuth(event)

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Image ID is required',
    })
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
        eq(schema.images.id, id),
        eq(schema.bookmarks.userId, currentUser.id)
      )
    )
    .limit(1)

  if (!image) {
    throw createError({
      statusCode: 404,
      message: 'Image not found',
    })
  }

  // Image content is immutable per id, so it can be cached aggressively.
  const etag = `"${image.id}"`
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  setHeader(event, 'ETag', etag)

  // Honor conditional requests: if the client already has this image, 304.
  if (getHeader(event, 'if-none-match') === etag) {
    setResponseStatus(event, 304)
    return null
  }

  // `data` is a bytea column — already raw binary.
  const buffer = Buffer.from(image.data)

  // Set headers
  setHeader(event, 'Content-Type', image.mimeType)
  setHeader(event, 'Content-Length', buffer.length.toString())

  return buffer
})
