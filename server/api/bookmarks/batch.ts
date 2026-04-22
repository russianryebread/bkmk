import { db } from '~/server/database'
import { bookmarks } from '~/server/database/schema'
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

  // Batch create
  if (create.length > 0) {
    const now = new Date().toISOString()
    const newBookmarks = create.map((b: any) => {
      let domain = b.source_domain
      if (!domain && b.url) {
        try { domain = new URL(b.url).hostname } catch {}
      }
      return {
        id: b.id || crypto.randomUUID(),
        userId: currentUser.id,
        title: b.title,
        url: b.url,
        description: b.description || null,
        cleanedMarkdown: b.cleaned_markdown || null,
        originalHtml: b.original_html || null,
        readingTimeMinutes: b.reading_time_minutes || null,
        savedAt: b.saved_at || now,
        lastAccessedAt: null,
        isFavorite: b.is_favorite ? 1 : 0,
        sortOrder: b.sort_order || null,
        thumbnailImagePath: b.thumbnail_image_path || null,
        isRead: b.is_read ? 1 : 0,
        readAt: b.is_read ? now : null,
        sourceDomain: domain || null,
        wordCount: b.word_count || null,
        createdAt: now,
        updatedAt: now,
      }
    })

    const inserted = await db.insert(bookmarks).values(newBookmarks).returning()
    results.created = inserted.map(b => ({
      ...b,
      is_favorite: Boolean(b.isFavorite),
      is_read: Boolean(b.isRead),
    }))
  }

  // Batch update
  if (update.length > 0) {
    for (const u of update) {
      if (!u.id) continue
      const existing = await db.select().from(bookmarks).where((b) => b.id.eq(u.id)).limit(1)
      if (!existing[0]) continue

      const updated = {
        title: u.title ?? existing[0].title,
        url: u.url ?? existing[0].url,
        description: u.description ?? existing[0].description,
        cleanedMarkdown: u.cleaned_markdown ?? existing[0].cleanedMarkdown,
        readingTimeMinutes: u.reading_time_minutes ?? existing[0].readingTimeMinutes,
        savedAt: u.saved_at ?? existing[0].savedAt,
        isFavorite: u.is_favorite !== undefined ? (u.is_favorite ? 1 : 0) : existing[0].isFavorite,
        sortOrder: u.sort_order ?? existing[0].sortOrder,
        thumbnailImagePath: u.thumbnail_image_path ?? existing[0].thumbnailImagePath,
        isRead: u.is_read !== undefined ? (u.is_read ? 1 : 0) : existing[0].isRead,
        readAt: u.is_read !== undefined ? (u.is_read ? new Date().toISOString() : null) : existing[0].readAt,
        sourceDomain: u.source_domain ?? existing[0].sourceDomain,
        wordCount: u.word_count ?? existing[0].wordCount,
        updatedAt: new Date().toISOString(),
      }

      const [result] = await db.update(bookmarks).set(updated).where((b) => b.id.eq(u.id)).returning()
      results.updated.push({
        ...result,
        is_favorite: Boolean(result.isFavorite),
        is_read: Boolean(result.isRead),
      })
    }
  }

  // Batch delete
  if (del.length > 0) {
    for (const id of del) {
      await db.delete(bookmarks).where((b) => b.id.eq(id))
      results.deleted.push(id)
    }
  }

  return results
})