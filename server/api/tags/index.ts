import { db, schema } from '~/server/database'
import { eq, sql } from 'drizzle-orm'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuth(event)
  const method = event.method

  if (method === 'GET') {
    const tagList = await db
      .select({
        id: schema.tags.id,
        name: schema.tags.name,
        parentTagId: schema.tags.parentTagId,
        color: schema.tags.color,
        type: schema.tags.type,
        description: schema.tags.description,
        icon: schema.tags.icon,
        createdAt: schema.tags.createdAt,
        bookmarkCount: sql<number>`count(DISTINCT ${schema.bookmarkTags.bookmarkId})`,
        noteCount: sql<number>`count(DISTINCT ${schema.notesTags.noteId})`,
      })
      .from(schema.tags)
      .leftJoin(schema.bookmarkTags, eq(schema.tags.id, schema.bookmarkTags.tagId))
      .leftJoin(schema.notesTags, eq(schema.tags.id, schema.notesTags.tagId))
      .where(eq(schema.tags.userId, currentUser.id))
      .groupBy(schema.tags.id)
      .orderBy(schema.tags.name)

    return {
      tags: tagList.map(t => ({
        ...t,
        bookmarkCount: Number(t.bookmarkCount),
        noteCount: Number(t.noteCount),
      })),
    }
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const { id, name, parent_tag_id, parentTagId, color, type, description, icon } = body
    const parentId = parentTagId !== undefined ? parentTagId : parent_tag_id

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw createError({ statusCode: 400, message: 'Tag name is required' })
    }

    if (type && !['bookmark', 'note', 'both'].includes(type)) {
      throw createError({ statusCode: 400, message: 'Invalid tag type. Must be "bookmark", "note", or "both"' })
    }

    try {
      const [tag] = await db
        .insert(schema.tags)
        .values({
          id: id || crypto.randomUUID(),
          userId: currentUser.id,
          name: name.trim(),
          parentTagId: parentId || null,
          color: color || null,
          type: type || 'both',
          description: description || null,
          icon: icon || null,
        })
        .returning()

      return { tag }
    } catch (error: any) {
      if (error.code === '23505') {
        throw createError({ statusCode: 409, message: 'Tag already exists' })
      }
      throw error
    }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
