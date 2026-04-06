import { db, schema } from '~/server/database'
import { verifyPassword, hashPassword } from '~/server/utils/auth'
import { eq, and } from 'drizzle-orm'
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
    // Verify note belongs to user
    const [note] = await db
      .select()
      .from(schema.secrets)
      .where(and(
        eq(schema.secrets.id, id),
        eq(schema.secrets.userId, currentUser.id)
      ))

    if (!note) {
      throw createError({
        statusCode: 404,
        message: 'Note not found',
      })
    }

    // Check for password in query
    const query = getQuery(event)
    const password = query.password as string

    if (!password) {
      // Return metadata without content
      return {
        id: note.id,
        title: note.title,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        lastAccessedAt: note.lastAccessedAt,
        requiresPassword: true,
      }
    }

    // Verify password
    const isValid = await verifyPassword(password, note.passwordHash)
    
    if (!isValid) {
      throw createError({
        statusCode: 401,
        message: 'Invalid password',
      })
    }

    // Update last accessed
    await db
      .update(schema.secrets)
      .set({ lastAccessedAt: new Date().toISOString() })
      .where(eq(schema.secrets.id, id))

    return {
      ...note,
      requiresPassword: false,
    }
  }

  if (method === 'PUT') {
    // Verify note belongs to user
    const [note] = await db
      .select()
      .from(schema.secrets)
      .where(and(
        eq(schema.secrets.id, id),
        eq(schema.secrets.userId, currentUser.id)
      ))

    if (!note) {
      throw createError({
        statusCode: 404,
        message: 'Note not found',
      })
    }

    const body = await readBody(event)
    const { title, content, password, current_password } = body

    // Verify current password if changing password or content
    if (password || content) {
      if (!current_password) {
        throw createError({
          statusCode: 400,
          message: 'Current password is required',
        })
      }

      const isValid = await verifyPassword(current_password, note.passwordHash)
      if (!isValid) {
        throw createError({
          statusCode: 401,
          message: 'Invalid password',
        })
      }
    }

    const updates: Record<string, any> = {}

    if (title !== undefined) {
      updates.title = title
    }
    if (content !== undefined) {
      updates.content = content
    }
    if (password !== undefined) {
      updates.passwordHash = await hashPassword(password)
    }

    const [updatedNote] = await db
      .update(schema.secrets)
      .set(updates)
      .where(eq(schema.secrets.id, id))
      .returning({
        id: schema.secrets.id,
        title: schema.secrets.title,
        createdAt: schema.secrets.createdAt,
        updatedAt: schema.secrets.updatedAt,
        lastAccessedAt: schema.secrets.lastAccessedAt,
      })

    return { note: updatedNote }
  }

  if (method === 'DELETE') {
    // Verify note belongs to user
    const [note] = await db
      .select()
      .from(schema.secrets)
      .where(and(
        eq(schema.secrets.id, id),
        eq(schema.secrets.userId, currentUser.id)
      ))

    if (!note) {
      throw createError({
        statusCode: 404,
        message: 'Note not found',
      })
    }

    const body = await readBody(event)
    const { password } = body

    if (!password) {
      throw createError({
        statusCode: 400,
        message: 'Password is required to delete',
      })
    }

    const isValid = await verifyPassword(password, note.passwordHash)
    if (!isValid) {
      throw createError({
        statusCode: 401,
        message: 'Invalid password',
      })
    }

    // Delete junction records first (handled by cascade, but being explicit)
    await db
      .delete(schema.secretsTags)
      .where(eq(schema.secretsTags.secretId, id))

    await db
      .delete(schema.secrets)
      .where(eq(schema.secrets.id, id))

    return { success: true }
  }

  throw createError({
    statusCode: 405,
    message: 'Method not allowed',
  })
})
