import { db, schema } from '~/server/database'
import { eq, desc, like, sql, and, or } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
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
      notes = await db
        .select()
        .from(schema.markdownNotes)
        .where(like(schema.markdownNotes.tags, `%${tag}%`))
        .orderBy(desc(schema.markdownNotes[sortColumn]))
        .limit(limitNum)
        .offset(offset)

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.markdownNotes)
        .where(like(schema.markdownNotes.tags, `%${tag}%`))

      total = count

      return {
        notes: notes.map(n => ({
          ...n,
          isFavorite: Boolean(n.isFavorite),
          tags: n.tags ? n.tags.split(',').filter(Boolean) : [],
        })),
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
      .from(schema.markdownNotes)
      .orderBy(desc(schema.markdownNotes[sortColumn]))
      .limit(limitNum)
      .offset(offset)

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.markdownNotes)

    total = count

    return {
      notes: notes.map(n => ({
        ...n,
        isFavorite: Boolean(n.isFavorite),
        tags: n.tags ? n.tags.split(',').filter(Boolean) : [],
      })),
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

    // Handle tags as array or comma-separated string
    const tagsArray = Array.isArray(tags)
      ? tags
      : (typeof tags === 'string' ? tags.split(',').filter(Boolean) : [])
    
    const tagsString = tagsArray.join(',')

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
              name: trimmedName,
              parentTagId: null,
              color: null,
            })
            .onConflictDoNothing()
        }
      }
    }

    const [note] = await db
      .insert(schema.markdownNotes)
      .values({
        id: crypto.randomUUID(),
        title,
        content: content || '',
        isFavorite: isFavorite ? 1 : 0,
        tags: tagsString,
      })
      .returning()

    return {
      ...note,
      isFavorite: Boolean(note.isFavorite),
      tags: note.tags ? note.tags.split(',').filter(Boolean) : [],
    }
  }


  throw createError({
    statusCode: 405,
    message: 'Method not allowed',
  })
})
