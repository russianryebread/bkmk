import { db, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
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

  if (method === 'GET') {
    const [note] = await db
      .select()
      .from(schema.markdownNotes)
      .where(eq(schema.markdownNotes.id, id))

    if (!note) {
      throw createError({
        statusCode: 404,
        message: 'Note not found',
      })
    }

    // Ensure user owns this note
    if (note.userId !== currentUser.id) {
      throw createError({
        statusCode: 403,
        message: 'Access denied',
      })
    }

    return {
      ...note,
      isFavorite: Boolean(note.isFavorite),
      tags: note.tags ? note.tags.split(',').filter(Boolean) : [],
    }
  }

  if (method === 'PUT') {
    // First check ownership
    const [existingNote] = await db
      .select()
      .from(schema.markdownNotes)
      .where(eq(schema.markdownNotes.id, id))

    if (!existingNote) {
      throw createError({
        statusCode: 404,
        message: 'Note not found',
      })
    }

    if (existingNote.userId !== currentUser.id) {
      throw createError({
        statusCode: 403,
        message: 'Access denied',
      })
    }

    const body = await readBody(event)
    const { title, content, isFavorite, sortOrder, tags } = body

    const updates: Record<string, any> = {}

    if (title !== undefined) {
      updates.title = title
    }
    if (content !== undefined) {
      updates.content = content
    }
    if (isFavorite !== undefined) {
      updates.isFavorite = isFavorite ? 1 : 0
    }
    if (sortOrder !== undefined) {
      updates.sortOrder = sortOrder
    }
    if (tags !== undefined) {
      // Handle tags as array or comma-separated string
      const tagsArray = Array.isArray(tags)
        ? tags
        : (typeof tags === 'string' ? tags.split(',').filter(Boolean) : [])
      
      const tagsString = tagsArray.join(',')
      updates.tags = tagsString

      // Auto-create tags if they don't exist in the main tags table
      for (const tagName of tagsArray) {
        const trimmedName = tagName.trim()
        if (trimmedName) {
          const existingTag = await db
            .select()
            .from(schema.tags)
            .where(eq(schema.tags.name, trimmedName))
            .limit(1)
          
          if (existingTag.length === 0) {
            await db
              .insert(schema.tags)
              .values({
                id: crypto.randomUUID(),
                userId: currentUser.id,
                name: trimmedName,
                parentTagId: null,
                color: null,
              })
              .onConflictDoNothing()
          }
        }
      }
    }

    const [note] = await db

      .update(schema.markdownNotes)
      .set(updates)
      .where(eq(schema.markdownNotes.id, id))
      .returning()

    return {
      ...note,
      isFavorite: Boolean(note.isFavorite),
      tags: note.tags ? note.tags.split(',').filter(Boolean) : [],
    }
  }

  if (method === 'DELETE') {
    // First check ownership
    const [existingNote] = await db
      .select()
      .from(schema.markdownNotes)
      .where(eq(schema.markdownNotes.id, id))

    if (!existingNote) {
      throw createError({
        statusCode: 404,
        message: 'Note not found',
      })
    }

    if (existingNote.userId !== currentUser.id) {
      throw createError({
        statusCode: 403,
        message: 'Access denied',
      })
    }

    await db
      .delete(schema.markdownNotes)
      .where(eq(schema.markdownNotes.id, id))

    return { success: true }
  }

  throw createError({
    statusCode: 405,
    message: 'Method not allowed',
  })
})
