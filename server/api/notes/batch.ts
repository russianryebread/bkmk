import { db } from '~/server/database'
import { notes, notesTags, tags } from '~/server/database/schema'
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
    for (const c of create) {
      const now = new Date().toISOString()
      const tagIds: string[] = []

      // Auto-create or find tags
      for (const tagName of c.tags || []) {
        const trimmedName = tagName.trim()
        if (!trimmedName) continue

        let [existingTag] = await db
          .select()
          .from(tags)
          .where((t) => t.name.eq(trimmedName).and(t.userId.eq(currentUser.id)))
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

      const [inserted] = await db
        .insert(notes)
        .values({
          id: c.id || crypto.randomUUID(),
          userId: currentUser.id,
          content: c.content,
          isFavorite: c.isFavorite ? 1 : 0,
          deletedAt: null,
        })
        .returning()

      for (const tagId of tagIds) {
        await db
          .insert(notesTags)
          .values({
            id: crypto.randomUUID(),
            noteId: inserted.id,
            tagId,
          })
          .onConflictDoNothing()
      }

      results.created.push({
        ...inserted,
        isFavorite: Boolean(inserted.isFavorite),
        tags: c.tags || [],
      })
    }
  }

  // Batch update
  if (update.length > 0) {
    for (const u of update) {
      if (!u.id) continue

      const existing = await db.select().from(notes).where((n) => n.id.eq(u.id).and(n.userId.eq(currentUser.id))).limit(1)
      if (!existing[0]) continue

      const updated = {
        content: u.content ?? existing[0].content,
        isFavorite: u.isFavorite !== undefined ? (u.isFavorite ? 1 : 0) : existing[0].isFavorite,
      }

      const [result] = await db
        .update(notes)
        .set(updated)
        .where((n) => n.id.eq(u.id))
        .returning()

      results.updated.push({
        ...result,
        isFavorite: Boolean(result.isFavorite),
      })
    }
  }

  // Batch delete
  if (del.length > 0) {
    for (const id of del) {
      await db.delete(notes).where((n) => n.id.eq(id).and(n.userId.eq(currentUser.id)))
      results.deleted.push(id)
    }
  }

  return results
})