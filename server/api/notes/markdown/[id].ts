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

  if (method === 'GET') {
    const [note] = await db
      .select()
      .from(schema.notes)
      .where(eq(schema.notes.id, id))

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

    // Get tags from junction table
    const tagRecords = await db
      .select({ tag: schema.tags })
      .from(schema.notesTags)
      .innerJoin(schema.tags, eq(schema.notesTags.tagId, schema.tags.id))
      .where(eq(schema.notesTags.noteId, id))

    // Update sync metadata
    await db
      .insert(schema.syncMetadata)
      .values({
        id: crypto.randomUUID(),
        entityType: 'note',
        entityId: id,
        lastModifiedAt: new Date().toISOString(),
        syncStatus: 'pending',
      })
      .onConflictDoUpdate({
        target: [schema.syncMetadata.entityType, schema.syncMetadata.entityId],
        set: {
          lastModifiedAt: new Date().toISOString(),
          syncStatus: 'pending',
        },
      })

    return {
      ...note,
      isFavorite: Boolean(note.isFavorite),
      tags: tagRecords.map(t => t.tag.name),
    }
  }

  if (method === 'PUT') {
    // First check ownership
    const [existingNote] = await db
      .select()
      .from(schema.notes)
      .where(eq(schema.notes.id, id))

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

    // Handle tags - update junction table
    if (tags !== undefined) {
      const tagsArray = Array.isArray(tags) ? tags : []
      
      // Auto-create tags if they don't exist in the main tags table
      const tagIds: string[] = []
      for (const tagName of tagsArray) {
        const trimmedName = tagName.trim()
        if (trimmedName) {
          let existingTag = await db
            .select()
            .from(schema.tags)
            .where(and(eq(schema.tags.name, trimmedName), eq(schema.tags.userId, currentUser.id)))
            .limit(1)
          
          if (existingTag.length === 0) {
            const [newTag] = await db
              .insert(schema.tags)
              .values({
                id: crypto.randomUUID(),
                userId: currentUser.id,
                name: trimmedName,
                parentTagId: null,
                color: null,
              })
              .returning()
            tagIds.push(newTag.id)
          } else {
            tagIds.push(existingTag[0].id)
          }
        }
      }

      // Delete existing tag associations
      await db
        .delete(schema.notesTags)
        .where(eq(schema.notesTags.noteId, id))

      // Create new tag associations
      for (const tagId of tagIds) {
        await db
          .insert(schema.notesTags)
          .values({
            id: crypto.randomUUID(),
            noteId: id,
            tagId,
          })
          .onConflictDoNothing()
      }
    }

    const [note] = await db
      .update(schema.notes)
      .set(updates)
      .where(eq(schema.notes.id, id))
      .returning()

    // Get current tags
    const tagRecords = await db
      .select({ tag: schema.tags })
      .from(schema.notesTags)
      .innerJoin(schema.tags, eq(schema.notesTags.tagId, schema.tags.id))
      .where(eq(schema.notesTags.noteId, id))

    return {
      ...note,
      isFavorite: Boolean(note.isFavorite),
      tags: tagRecords.map(t => t.tag.name),
    }
  }

  if (method === 'DELETE') {
    // First check ownership
    const [existingNote] = await db
      .select()
      .from(schema.notes)
      .where(eq(schema.notes.id, id))

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

    // Delete junction records first (handled by cascade, but since we soft-delete, we need to do it manually)
    await db
      .delete(schema.notesTags)
      .where(eq(schema.notesTags.noteId, id))

    // Soft delete note
    await db.update(schema.notes)
      .set({
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.notes.id, id))

    // Update sync metadata
    await db
      .insert(schema.syncMetadata)
      .values({
        id: crypto.randomUUID(),
        entityType: 'note',
        entityId: id,
        lastModifiedAt: new Date().toISOString(),
        isDeleted: 1,
        syncStatus: 'pending',
      })
      .onConflictDoUpdate({
        target: [schema.syncMetadata.entityType, schema.syncMetadata.entityId],
        set: {
          lastModifiedAt: new Date().toISOString(),
          isDeleted: 1,
          syncStatus: 'pending',
        },
      })

    return { success: true }
  }

  throw createError({
    statusCode: 405,
    message: 'Method not allowed',
  })
})
