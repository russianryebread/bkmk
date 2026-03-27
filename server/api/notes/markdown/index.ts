import { db, schema } from '~/server/database'
import { eq, desc, like, sql, and } from 'drizzle-orm'
import { getQuery } from 'h3'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  // Require authentication
  const currentUser = await requireAuth(event)
  
  const method = event.method

  if (method === 'GET') {
    const query = getQuery(event)
    const { page = '1', limit = '20', sort = 'updatedAt', tag } = query

    const pageNum = parseInt(page as string)
    const limitNum = parseInt(limit as string)
    const offset = (pageNum - 1) * limitNum

    // Validate sort column
    const validSorts = ['createdAt', 'title', 'updatedAt', 'isFavorite']
    const sortColumn = validSorts.includes(sort as string) 
      ? (sort as 'createdAt' | 'title' | 'updatedAt' | 'isFavorite')
      : 'updatedAt'

    let notes
    let total

    if (tag) {
      // Get notes with specific tag via junction table
      const tagRecords = await db
        .select()
        .from(schema.tags)
        .where(eq(schema.tags.name, tag as string))
      
      if (tagRecords.length > 0) {
        const noteTagRecords = await db
          .select()
          .from(schema.notesTags)
          .where(eq(schema.notesTags.tagId, tagRecords[0].id))
        
        const noteIds = noteTagRecords.map(nt => nt.noteId)
        
        if (noteIds.length > 0) {
          notes = await db
            .select()
            .from(schema.notes)
            .where(and(
              eq(schema.notes.userId, currentUser.id),
              sql`${schema.notes.id} IN (${noteIds.join(',')})`
            ))
            .orderBy(desc(schema.notes[sortColumn]))
            .limit(limitNum)
            .offset(offset)
        } else {
          notes = []
        }
      } else {
        notes = []
      }

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.notes)
        .where(eq(schema.notes.userId, currentUser.id))

      total = count

      // Get tags for each note
      const notesWithTags = await Promise.all(notes.map(async (n) => {
        const tagRecords = await db
          .select({ tag: schema.tags })
          .from(schema.notesTags)
          .innerJoin(schema.tags, eq(schema.notesTags.tagId, schema.tags.id))
          .where(eq(schema.notesTags.noteId, n.id))
        
        return {
          ...n,
          isFavorite: Boolean(n.isFavorite),
          tags: tagRecords.map(t => t.tag.name),
        }
      }))

      return {
        notes: notesWithTags,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      }
    }

    notes = await db
      .select()
      .from(schema.notes)
      .where(eq(schema.notes.userId, currentUser.id))
      .orderBy(desc(schema.notes[sortColumn]))
      .limit(limitNum)
      .offset(offset)

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.notes)
      .where(eq(schema.notes.userId, currentUser.id))

    total = count

    // Get tags for each note
    const notesWithTags = await Promise.all(notes.map(async (n) => {
      const tagRecords = await db
        .select({ tag: schema.tags })
        .from(schema.notesTags)
        .innerJoin(schema.tags, eq(schema.notesTags.tagId, schema.tags.id))
        .where(eq(schema.notesTags.noteId, n.id))
      
      return {
        ...n,
        isFavorite: Boolean(n.isFavorite),
        tags: tagRecords.map(t => t.tag.name),
      }
    }))

    return {
      notes: notesWithTags,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    }
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const { title, content, isFavorite, tags } = body

    if (!title || typeof title !== 'string') {
      throw createError({
        statusCode: 400,
        message: 'Title is required',
      })
    }

    // Handle tags as array
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

    const [note] = await db
      .insert(schema.notes)
      .values({
        id: crypto.randomUUID(),
        userId: currentUser.id,
        title,
        content: content || '',
        isFavorite: isFavorite ? 1 : 0,
      })
      .returning()

    // Create junction records for tags
    for (const tagId of tagIds) {
      await db
        .insert(schema.notesTags)
        .values({
          id: crypto.randomUUID(),
          noteId: note.id,
          tagId,
        })
        .onConflictDoNothing()
    }

    return {
      ...note,
      isFavorite: Boolean(note.isFavorite),
      tags: tagsArray,
    }
  }


  throw createError({
    statusCode: 405,
    message: 'Method not allowed',
  })
})
