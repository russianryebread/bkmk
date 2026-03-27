import { db, schema } from '~/server/database'
import { verifyPassword, hashPassword } from '~/server/utils/crypto'
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
      .from(schema.secretNotes)
      .where(and(
        eq(schema.secretNotes.id, id),
        eq(schema.secretNotes.userId, currentUser.id)
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
      .update(schema.secretNotes)
      .set({ lastAccessedAt: new Date().toISOString() })
      .where(eq(schema.secretNotes.id, id))

    return {
      ...note,
      requiresPassword: false,
    }
  }

  if (method === 'PUT') {
    // Verify note belongs to user
    const [note] = await db
      .select()
      .from(schema.secretNotes)
      .where(and(
        eq(schema.secretNotes.id, id),
        eq(schema.secretNotes.userId, currentUser.id)
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
      .update(schema.secretNotes)
      .set(updates)
      .where(eq(schema.secretNotes.id, id))
      .returning({
        id: schema.secretNotes.id,
        title: schema.secretNotes.title,
        createdAt: schema.secretNotes.createdAt,
        updatedAt: schema.secretNotes.updatedAt,
        lastAccessedAt: schema.secretNotes.lastAccessedAt,
      })

    return { note: updatedNote }
  }

  if (method === 'DELETE') {
    // Verify note belongs to user
    const [note] = await db
      .select()
      .from(schema.secretNotes)
      .where(and(
        eq(schema.secretNotes.id, id),
        eq(schema.secretNotes.userId, currentUser.id)
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

    await db
      .delete(schema.secretNotes)
      .where(eq(schema.secretNotes.id, id))

    return { success: true }
  }

  throw createError({
    statusCode: 405,
    message: 'Method not allowed',
  })
})
