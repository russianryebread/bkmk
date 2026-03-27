import { db, schema } from '~/server/database'
import { eq, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const method = event.method

  if (method === 'GET') {
    const tags = await db
      .select({
        id: schema.tags.id,
        name: schema.tags.name,
        parentTagId: schema.tags.parentTagId,
        color: schema.tags.color,
        createdAt: schema.tags.createdAt,
        bookmarkCount: sql<number>`count(${schema.bookmarkTags.bookmarkId})`,
      })
      .from(schema.tags)
      .leftJoin(schema.bookmarkTags, eq(schema.tags.id, schema.bookmarkTags.tagId))
      .groupBy(schema.tags.id)
      .orderBy(schema.tags.name)

    return { tags }
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const { name, parent_tag_id, color } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw createError({ statusCode: 400, message: 'Tag name is required' })
    }

    try {
      const [tag] = await db
        .insert(schema.tags)
        .values({ id: crypto.randomUUID(), name: name.trim(), parentTagId: parent_tag_id || null, color: color || null })
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
