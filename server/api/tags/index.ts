import { db, schema } from '~/server/database'
import { eq, sql } from 'drizzle-orm'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  // Require authentication
  const currentUser = await requireAuth(event)
  
  const method = event.method

  if (method === 'GET') {
    const tags = await db
      .select({
        id: schema.tags.id,
        name: schema.tags.name,
        parentTagId: schema.tags.parentTagId,
        color: schema.tags.color,
        type: schema.tags.type,
        description: schema.tags.description,
        icon: schema.tags.icon,
        createdAt: schema.tags.createdAt,
        bookmarkCount: sql<number>`count(${schema.bookmarkTags.bookmarkId})`,
      })
      .from(schema.tags)
      .leftJoin(schema.bookmarkTags, eq(schema.tags.id, schema.bookmarkTags.tagId))
      .where(eq(schema.tags.userId, currentUser.id))
      .groupBy(schema.tags.id)
      .orderBy(schema.tags.name)

    return { tags }
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const { name, parent_tag_id, color, type, description, icon } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw createError({ statusCode: 400, message: 'Tag name is required' })
    }

    // Validate type
    if (type && !['bookmark', 'note', 'both'].includes(type)) {
      throw createError({ statusCode: 400, message: 'Invalid tag type. Must be "bookmark", "note", or "both"' })
    }

    try {
      const [tag] = await db
        .insert(schema.tags)
        .values({
          id: crypto.randomUUID(),
          userId: currentUser.id,
          name: name.trim(),
          parentTagId: parent_tag_id || null,
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
