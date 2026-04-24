import { and, eq } from 'drizzle-orm'
import { db } from '~/server/database'
import { bookmarks, bookmarkTags, tags } from '~/server/database/schema'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuth(event)
  const method = event.method

  if (method !== 'POST') {
    throw createError({ statusCode: 405, message: 'Method not allowed' })
  }

  const body = await readBody(event)
  const { create = [], update = [], del = [] } = body

  const results: { created: any[]; updated: any[]; deleted: string[] } = {
    created: [],
    updated: [],
    deleted: [],
  }

  const now = new Date().toISOString()

  // Batch create
  if (create.length > 0) {
    for (const b of create) {
      const tagIds: string[] = []

      // Auto-create or find tags
      for (const tagName of b.tags || []) {
        const trimmedName = tagName.trim()
        if (!trimmedName) continue

        let [existingTag] = await db
          .select()
          .from(tags)
          .where(and(eq(tags.name, trimmedName), eq(tags.userId, currentUser.id)))
          .limit(1)

        if (!existingTag) {
          ;[existingTag] = await db
            .insert(tags)
            .values({
              id: crypto.randomUUID(),
              userId: currentUser.id,
              name: trimmedName,
              parentTagId: null,
              color: null,
            })
            .returning()
        }
        tagIds.push(existingTag.id)
      }

      let domain = b.source_domain
      if (!domain && b.url) {
        try { domain = new URL(b.url).hostname } catch {}
      }

      const newBookmark = {
        id: b.id || crypto.randomUUID(),
        userId: currentUser.id,
        title: b.title,
        url: b.url,
        description: b.description || null,
        cleanedMarkdown: b.cleanedMarkdown || null,
        originalHtml: b.originalHtml || null,
        readingTimeMinutes: b.readingTimeMinutes || null,
        savedAt: b.savedAt || now,
        lastAccessedAt: null,
        isFavorite: b.isFavorite ? 1 : 0,
        sortOrder: b.sortOrder || null,
        thumbnailImagePath: b.thumbnailImagePath || null,
        isRead: b.isRead ? 1 : 0,
        readAt: b.isRead ? now : null,
        sourceDomain: domain || null,
        wordCount: b.wordCount || null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }

      const [inserted] = await db.insert(bookmarks).values(newBookmark).returning()

      for (const tagId of tagIds) {
        await db
          .insert(bookmarkTags)
          .values({
            id: crypto.randomUUID(),
            bookmarkId: inserted.id,
            tagId,
          })
          .onConflictDoNothing()
      }

      results.created.push({
        ...inserted,
        isFavorite: Boolean(inserted.isFavorite),
        tags: b.tags || [],
      })
    }
  }

  // Batch update
  if (update.length > 0) {
    for (const u of update) {
      if (!u.id) continue
      const existing = await db.select().from(bookmarks).where((b) => eq(b.id, u.id)).limit(1)
      if (!existing[0]) continue

      const updated = {
        title: u.title ?? existing[0].title,
        url: u.url ?? existing[0].url,
        description: u.description ?? existing[0].description,
        cleanedMarkdown: u.cleanedMarkdown ?? existing[0].cleanedMarkdown,
        readingTimeMinutes: u.readingTimeMinutes ?? existing[0].readingTimeMinutes,
        savedAt: u.savedAt ?? existing[0].savedAt,
        isFavorite: u.isFavorite !== undefined ? (u.isFavorite ? 1 : 0) : existing[0].isFavorite,
        sortOrder: u.sortOrder ?? existing[0].sortOrder,
        thumbnailImagePath: u.thumbnailImagePath ?? existing[0].thumbnailImagePath,
        isRead: u.isRead !== undefined ? (u.isRead ? 1 : 0) : existing[0].isRead,
        readAt: u.isRead !== undefined ? (u.isRead ? now : null) : existing[0].readAt,
        sourceDomain: u.sourceDomain ?? existing[0].sourceDomain,
        wordCount: u.wordCount ?? existing[0].wordCount,
        updatedAt: now,
      }

      const [result] = await db.update(bookmarks).set(updated).where(eq(bookmarks.id, u.id)).returning()
      results.updated.push({
        ...result,
        isFavorite: Boolean(result.isFavorite),
        isRead: Boolean(result.isRead),
        updatedAt: now,
      })
    }
  }

  // Batch delete
  if (del.length > 0) {
    try {
      for (const id of del) {
        // await db.delete(bookmarks).where(eq(bookmarks.id, id))
        await db.update(bookmarks).set({ deletedAt: new Date().toISOString() }).where(eq(bookmarks.id, id))
        results.deleted.push(id)
      }
    } catch (error) {
      console.error('[bookmarks] Batch delete error:', error)
    }
  }

  return results
})
