import { db } from '~/server/database'
import { notes, notesTags, tags } from '~/server/database/schema'
import { eq, desc, sql, and } from 'drizzle-orm'
import { getQuery } from 'h3'
import { requireAuth } from '~/server/utils/auth'

// Batch fetch tags for multiple notes to avoid N+1 queries
async function fetchTagsForNotes(noteIds: string[]): Promise<Map<string, string[]>> {
  if (noteIds.length === 0) return new Map()
  
  const tagRecords = await db
    .select({
      noteId: notesTags.noteId,
      tagName: tags.name,
    })
    .from(notesTags)
    .innerJoin(tags, eq(notesTags.tagId, tags.id))
    .where(sql`${notesTags.noteId} IN (${noteIds.join(',')})`)

  const tagMap = new Map<string, string[]>()
  for (const record of tagRecords) {
    if (!tagMap.has(record.noteId)) {
      tagMap.set(record.noteId, [])
    }
    tagMap.get(record.noteId)!.push(record.tagName)
  }
  return tagMap
}

// Transform note with tags
function transformNoteWithTags(note: any, noteTags: string[]): any {
  return {
    ...note,
    isFavorite: Boolean(note.isFavorite),
    tags: noteTags,
  }
}

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
    const validSorts = ['createdAt', 'updatedAt', 'isFavorite']
    const sortColumn = validSorts.includes(sort as string)
      ? (sort as 'createdAt' | 'updatedAt' | 'isFavorite')
      : 'updatedAt'

    let fetchedNotes
    let total

    if (tag) {
      // Get notes with specific tag via junction table
      const [tagRecord] = await db
        .select({ id: tags.id })
        .from(tags)
        .where(and(eq(tags.name, tag as string), eq(tags.userId, currentUser.id)))
        .limit(1)
      
      if (!tagRecord) {
        return {
          notes: [],
          pagination: { page: pageNum, limit: limitNum, total: 0, totalPages: 0 },
        }
      }

      const noteTagRecords = await db
        .select({ noteId: notesTags.noteId })
        .from(notesTags)
        .where(eq(notesTags.tagId, tagRecord.id))
      
      const noteIds = noteTagRecords.map(nt => nt.noteId)
      
      if (noteIds.length > 0) {
        fetchedNotes = await db
          .select()
          .from(notes)
          .where(and(
            eq(notes.userId, currentUser.id),
            sql`${notes.id} IN (${noteIds.join(',')})`
          ))
          .orderBy(desc(notes[sortColumn]))
          .limit(limitNum)
          .offset(offset)
      } else {
        fetchedNotes = []
      }

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(notes)
        .where(eq(notes.userId, currentUser.id))

      total = count
    } else {
      fetchedNotes = await db
        .select()
        .from(notes)
        .where(eq(notes.userId, currentUser.id))
        .orderBy(desc(notes[sortColumn]))
        .limit(limitNum)
        .offset(offset)

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(notes)
        .where(eq(notes.userId, currentUser.id))

      total = count
    }

    // Batch fetch tags for all notes at once (avoids N+1)
    const noteIds = fetchedNotes.map(n => n.id)
    const tagMap = await fetchTagsForNotes(noteIds)

    // Transform notes with their tags
    const notesWithTags = fetchedNotes.map(n => 
      transformNoteWithTags(n, tagMap.get(n.id) || [])
    )

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
    const { content, isFavorite, tags } = body

    if (typeof content !== 'string') {
      throw createError({
        statusCode: 400,
        message: 'Content is required',
      })
    }

    // Handle tags as array
    const tagsArray = Array.isArray(tags) ? tags : []

    // Auto-create tags if they don't exist in the main tags table
    const tagIds: string[] = []
    for (const tagName of tagsArray) {
      const trimmedName = tagName.trim()
      if (trimmedName) {
        let [existingTag] = await db
          .select()
          .from(tags)
          .where(and(eq(tags.name, trimmedName), eq(tags.userId, currentUser.id)))
          .limit(1)

        if (!existingTag) {
          const [newTag] = await db
            .insert(tags)
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
          tagIds.push(existingTag.id)
        }
      }
    }

    const [note] = await db
      .insert(notes)
      .values({
        id: crypto.randomUUID(),
        userId: currentUser.id,
        content: content,
        isFavorite: isFavorite ? 1 : 0,
      })
      .returning()

    // Create junction records for tags
    for (const tagId of tagIds) {
      await db
        .insert(notesTags)
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
