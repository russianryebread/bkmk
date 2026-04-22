import { db } from '~/server/database'
import { tags } from '~/server/database/schema'
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

      const [inserted] = await db
        .insert(tags)
        .values({
          id: c.id || crypto.randomUUID(),
          userId: currentUser.id,
          name: c.name,
          parentTagId: c.parentTagId || null,
          color: c.color || null,
          type: c.type || 'both',
          description: c.description || null,
          icon: c.icon || null,
          createdAt: now,
        })
        .returning()

      results.created.push(inserted)
    }
  }

  // Batch update
  if (update.length > 0) {
    for (const u of update) {
      if (!u.id) continue

      const existing = await db.select().from(tags).where((t) => t.id.eq(u.id).and(t.userId.eq(currentUser.id))).limit(1)
      if (!existing[0]) continue

      const updated = {
        name: u.name ?? existing[0].name,
        parentTagId: u.parentTagId !== undefined ? u.parentTagId : existing[0].parentTagId,
        color: u.color !== undefined ? u.color : existing[0].color,
        type: u.type ?? existing[0].type,
        description: u.description !== undefined ? u.description : existing[0].description,
        icon: u.icon !== undefined ? u.icon : existing[0].icon,
      }

      const [result] = await db
        .update(tags)
        .set(updated)
        .where((t) => t.id.eq(u.id))
        .returning()

      results.updated.push(result)
    }
  }

  // Batch delete
  if (del.length > 0) {
    for (const id of del) {
      await db.delete(tags).where((t) => t.id.eq(id).and(t.userId.eq(currentUser.id)))
      results.deleted.push(id)
    }
  }

  return results
})