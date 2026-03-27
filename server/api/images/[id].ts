import { db, schema } from '~/server/database'
import { eq, and } from 'drizzle-orm'
import { getRouterParam } from 'h3'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  // Try to get auth - make it optional to not break existing references
  let currentUser = null
  try {
    currentUser = await requireAuth(event)
  } catch {
    // Allow unauthenticated access for now
  }
  
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Image ID is required',
    })
  }

  // Get image from database
  let query = db
    .select({
      id: schema.images.id,
      mimeType: schema.images.mimeType,
      data: schema.images.data,
      originalUrl: schema.images.originalUrl,
    })
    .from(schema.images)
    .where(eq(schema.images.id, id))
    .limit(1)

  // If authenticated, verify ownership via bookmark
  if (currentUser) {
    query = db
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
  }

  const [image] = await query

  if (!image) {
    throw createError({
      statusCode: 404,
      message: 'Image not found',
    })
  }

  // Decode base64 and return as binary
  const buffer = Buffer.from(image.data, 'base64')

  // Set headers
  setHeader(event, 'Content-Type', image.mimeType)
  setHeader(event, 'Cache-Control', 'public, max-age=31536000') // 1 year cache
  setHeader(event, 'Content-Length', buffer.length.toString())

  return buffer
})
