import { db, schema } from '~/server/database'
import { eq, sql } from 'drizzle-orm'

export default defineEventHandler(async () => {
  const [{ count: totalBookmarks }] = await db.select({ count: sql<number>`count(*)` }).from(schema.bookmarks)
  const [{ count: unreadBookmarks }] = await db.select({ count: sql<number>`count(*)` }).from(schema.bookmarks).where(eq(schema.bookmarks.isRead, 0))
  const [{ count: totalNotes }] = await db.select({ count: sql<number>`count(*)` }).from(schema.markdownNotes)
  const [{ count: totalSecretNotes }] = await db.select({ count: sql<number>`count(*)` }).from(schema.secretNotes)
  const [{ count: totalTags }] = await db.select({ count: sql<number>`count(*)` }).from(schema.tags)

  return { totalBookmarks, unreadBookmarks, totalNotes, totalSecretNotes, totalTags }
})
