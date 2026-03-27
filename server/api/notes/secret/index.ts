import { db, schema } from '~/server/database'
import { hashPassword } from '~/server/utils/crypto'
import { desc, eq } from 'drizzle-orm'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  // Require authentication
  const currentUser = await requireAuth(event)
  
  const method = event.method
  if (method === 'GET') {
    const notes = await db.select({
      id: schema.secretNotes.id,
      title: schema.secretNotes.title,
      createdAt: schema.secretNotes.createdAt,
      updatedAt: schema.secretNotes.updatedAt,
      lastAccessedAt: schema.secretNotes.lastAccessedAt,
    }).from(schema.secretNotes)
    .where(eq(schema.secretNotes.userId, currentUser.id))
    .orderBy(desc(schema.secretNotes.updatedAt))
    return { notes }
  }
  if (method === 'POST') {
    const body = await readBody(event)
    const { title, content, password } = body
    if (!title || typeof title !== 'string') throw createError({ statusCode: 400, message: 'Title is required' })
    if (!password || typeof password !== 'string' || password.length < 4) throw createError({ statusCode: 400, message: 'Password must be at least 4 characters' })
    const passwordHash = await hashPassword(password)
    const [note] = await db.insert(schema.secretNotes).values({ id: crypto.randomUUID(), userId: currentUser.id, title, content: content || '', passwordHash }).returning({
      id: schema.secretNotes.id,
      title: schema.secretNotes.title,
      createdAt: schema.secretNotes.createdAt,
      updatedAt: schema.secretNotes.updatedAt,
      lastAccessedAt: schema.secretNotes.lastAccessedAt,
    })
    return { note }
  }
  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
