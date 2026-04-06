import { db, schema } from '~/server/database'
import { hashPassword } from '~/server/utils/auth'
import { desc, eq } from 'drizzle-orm'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  // Require authentication
  const currentUser = await requireAuth(event)
  
  const method = event.method
  if (method === 'GET') {
    const notes = await db.select({
      id: schema.secrets.id,
      title: schema.secrets.title,
      createdAt: schema.secrets.createdAt,
      updatedAt: schema.secrets.updatedAt,
      lastAccessedAt: schema.secrets.lastAccessedAt,
    }).from(schema.secrets)
    .where(eq(schema.secrets.userId, currentUser.id))
    .orderBy(desc(schema.secrets.updatedAt))
    return { notes }
  }
  if (method === 'POST') {
    const body = await readBody(event)
    const { title, content, password } = body
    if (!title || typeof title !== 'string') throw createError({ statusCode: 400, message: 'Title is required' })
    if (!password || typeof password !== 'string' || password.length < 4) throw createError({ statusCode: 400, message: 'Password must be at least 4 characters' })
    const passwordHash = await hashPassword(password)
    const [note] = await db.insert(schema.secrets).values({ id: crypto.randomUUID(), userId: currentUser.id, title, content: content || '', passwordHash }).returning({
      id: schema.secrets.id,
      title: schema.secrets.title,
      createdAt: schema.secrets.createdAt,
      updatedAt: schema.secrets.updatedAt,
      lastAccessedAt: schema.secrets.lastAccessedAt,
    })
    return { note }
  }
  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
