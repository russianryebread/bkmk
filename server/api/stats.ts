import { db, schema } from '~/server/database'
import { eq, sql, and } from 'drizzle-orm'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  // Require authentication
  const currentUser = await requireAuth(event)
  
  try {
    const totalBookmarksResult = await db.select({ count: sql<number>`count(*)` }).from(schema.bookmarks).where(eq(schema.bookmarks.userId, currentUser.id))
    const unreadBookmarksResult = await db.select({ count: sql<number>`count(*)` }).from(schema.bookmarks).where(and(eq(schema.bookmarks.userId, currentUser.id), eq(schema.bookmarks.isRead, 0)))
    const totalNotesResult = await db.select({ count: sql<number>`count(*)` }).from(schema.notes).where(eq(schema.notes.userId, currentUser.id))
    const totalTagsResult = await db.select({ count: sql<number>`count(*)` }).from(schema.tags).where(eq(schema.tags.userId, currentUser.id))

    return {
      totalBookmarks: Number(totalBookmarksResult[0]?.count ?? 0),
      unreadBookmarks: Number(unreadBookmarksResult[0]?.count ?? 0),
      totalNotes: Number(totalNotesResult[0]?.count ?? 0),
      totalTags: Number(totalTagsResult[0]?.count ?? 0),
    }
  } catch (error: any) {
    // Always log the real error server-side; only expose detail in dev.
    console.error('Stats API error:', error)
    const isProd = process.env.NODE_ENV === 'production'
    throw createError({
      statusCode: 500,
      message: isProd
        ? 'Failed to fetch stats'
        : 'Failed to fetch stats: ' + (error?.message || 'Unknown error'),
    })
  }
})
