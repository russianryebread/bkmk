import { db, schema } from '~/server/database'
import { eq, sql, and } from 'drizzle-orm'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  // Require authentication
  const currentUser = await requireAuth(event)
  
  const [{ count: totalBookmarks }] = await db.select({ count: sql<number>`count(*)` }).from(schema.bookmarks).where(eq(schema.bookmarks.userId, currentUser.id))
  const [{ count: unreadBookmarks }] = await db.select({ count: sql<number>`count(*)` }).from(schema.bookmarks).where(and(eq(schema.bookmarks.userId, currentUser.id), eq(schema.bookmarks.isRead, 0)))
  const [{ count: totalNotes }] = await db.select({ count: sql<number>`count(*)` }).from(schema.notes).where(eq(schema.notes.userId, currentUser.id))
  const [{ count: totalSecretNotes }] = await db.select({ count: sql<number>`count(*)` }).from(schema.secrets).where(eq(schema.secrets.userId, currentUser.id))
  const [{ count: totalTags }] = await db.select({ count: sql<number>`count(*)` }).from(schema.tags).where(eq(schema.tags.userId, currentUser.id))

  return { totalBookmarks, unreadBookmarks, totalNotes, totalSecretNotes, totalTags }
})
