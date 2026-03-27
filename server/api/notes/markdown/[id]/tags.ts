import { db, schema } from '~/server/database'
import { eq, and } from 'drizzle-orm'
import { getRouterParam } from 'h3'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  // Require authentication
  const currentUser = await requireAuth(event)
  
  const id = getRouterParam(event, 'id')
  const method = event.method

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Note ID is required',
    })
  }

  // Check if note exists and belongs to user
  const [existing] = await db
    .select({ id: schema.notes.id })
    .from(schema.notes)
    .where(and(
      eq(schema.notes.id, id),
      eq(schema.notes.userId, currentUser.id)
    ))
    .limit(1)

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'Note not found',
    })
  }

  if (method === 'GET') {
    // Get tags for note via junction table
    const result = await db
      .select({
        id: schema.tags.id,
        name: schema.tags.name,
        parentTagId: schema.tags.parentTagId,
        color: schema.tags.color,
        createdAt: schema.tags.createdAt,
      })
      .from(schema.tags)
      .innerJoin(schema.notesTags, eq(schema.tags.id, schema.notesTags.tagId))
      .where(eq(schema.notesTags.noteId, id))
      .orderBy(schema.tags.name)

    return { tags: result }
  }

  if (method === 'POST') {
    // Add tags to note via junction table
    const body = await readBody(event)
    const { tag_ids } = body

    if (!Array.isArray(tag_ids)) {
      throw createError({
        statusCode: 400,
        message: 'tag_ids must be an array',
      })
    }

    // Insert new tag associations, ignoring duplicates
    for (const tagId of tag_ids) {
      await db
        .insert(schema.notesTags)
        .values({
          id: crypto.randomUUID(),
          noteId: id,
          tagId: tagId,
        })
        .onConflictDoNothing()
    }

    return { success: true }
  }

  if (method === 'DELETE') {
    // Remove specific tags from note via junction table
    const body = await readBody(event)
    const { tag_ids } = body

    if (!Array.isArray(tag_ids)) {
      throw createError({
        statusCode: 400,
        message: 'tag_ids must be an array',
      })
    }

    for (const tagId of tag_ids) {
      await db
        .delete(schema.notesTags)
        .where(
          and(
            eq(schema.notesTags.noteId, id),
            eq(schema.notesTags.tagId, tagId)
          )
        )
    }

    return { success: true }
  }

  throw createError({
    statusCode: 405,
    message: 'Method not allowed',
  })
})
