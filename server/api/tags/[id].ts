import { db, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const method = event.method

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Tag ID is required',
    })
  }

  if (method === 'GET') {
    const [tag] = await db
      .select()
      .from(schema.tags)
      .where(eq(schema.tags.id, id))

    if (!tag) {
      throw createError({
        statusCode: 404,
        message: 'Tag not found',
      })
    }

    return { tag }
  }

  if (method === 'PUT') {
    const body = await readBody(event)
    const { name, parent_tag_id, color } = body

    const updates: Record<string, any> = {}

    if (name !== undefined) {
      updates.name = name.trim()
    }
    if (parent_tag_id !== undefined) {
      updates.parentTagId = parent_tag_id
    }
    if (color !== undefined) {
      updates.color = color
    }

    if (Object.keys(updates).length === 0) {
      return { success: true }
    }

    const [tag] = await db
      .update(schema.tags)
      .set(updates)
      .where(eq(schema.tags.id, id))
      .returning()

    return { tag }
  }

  if (method === 'DELETE') {
    // Remove tag associations first
    await db
      .delete(schema.bookmarkTags)
      .where(eq(schema.bookmarkTags.tagId, id))

    // Delete the tag
    await db
      .delete(schema.tags)
      .where(eq(schema.tags.id, id))

    return { success: true }
  }

  throw createError({
    statusCode: 405,
    message: 'Method not allowed',
  })
})
