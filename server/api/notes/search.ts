import { db, schema } from '~/server/database'
import { like, or, desc, and, eq } from 'drizzle-orm'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  // Require authentication
  const currentUser = await requireAuth(event)
  
  const query = getQuery(event)
  const { q, limit = '10' } = query
  const limitNum = Math.min(parseInt(limit as string), 50)
  if (!q || typeof q !== 'string' || q.trim().length === 0) return { notes: [] }
  const searchTerm = q.trim().toLowerCase()
  
  // Only search notes belonging to current user
  const notes = await db
    .select({
      id: schema.notes.id,
      title: schema.notes.title,
      content: schema.notes.content,
      isFavorite: schema.notes.isFavorite,
      createdAt: schema.notes.createdAt,
      updatedAt: schema.notes.updatedAt,
    })
    .from(schema.notes)
    .where(
      and(
        eq(schema.notes.userId, currentUser.id),
        or(
          like(schema.notes.title, `%${searchTerm}%`),
          like(schema.notes.content, `%${searchTerm}%`)
        )
      )
    )
    .orderBy(desc(schema.notes.updatedAt))
    .limit(limitNum)
  
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
  
  return { notes: notesWithTags }
})
