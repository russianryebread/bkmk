import { db, schema } from '~/server/database'
import { like, or, desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { q, limit = '10' } = query
  const limitNum = Math.min(parseInt(limit as string), 50)
  if (!q || typeof q !== 'string' || q.trim().length === 0) return { notes: [] }
  const searchTerm = q.trim().toLowerCase()
  const notes = await db.select({
    id: schema.markdownNotes.id,
    title: schema.markdownNotes.title,
    content: schema.markdownNotes.content,
    isFavorite: schema.markdownNotes.isFavorite,
    createdAt: schema.markdownNotes.createdAt,
    updatedAt: schema.markdownNotes.updatedAt,
  }).from(schema.markdownNotes).where(
    or(
      like(schema.markdownNotes.title, `%${searchTerm}%`),
      like(schema.markdownNotes.content, `%${searchTerm}%`)
    )
  ).orderBy(desc(schema.markdownNotes.updatedAt)).limit(limitNum)
  return { notes: notes.map(n => ({ ...n, isFavorite: Boolean(n.isFavorite) })) }
})
