import { readBody, getRouterParam } from 'h3'
import { requireRole } from '~/server/utils/auth'
import { db } from '~/server/database'
import { users } from '~/server/database/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  // Require admin role
  const currentUser = await requireRole(event, 'admin')
  
  const userId = getRouterParam(event, 'id')
  const body = await readBody(event)
  const { role } = body
  
  if (!userId) {
    throw createError({
      statusCode: 400,
      message: 'User ID is required'
    })
  }
  
  // Validate role
  if (role && !['user', 'admin'].includes(role)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid role. Must be "user" or "admin"'
    })
  }
  
  // Cannot modify own role
  if (userId === currentUser.id) {
    throw createError({
      statusCode: 400,
      message: 'Cannot modify your own role'
    })
  }
  
  // Check if user exists
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  
  if (!existingUser) {
    throw createError({
      statusCode: 404,
      message: 'User not found'
    })
  }
  
  // Update user
  const now = new Date().toISOString()
  await db.update(users)
    .set({
      role: role || 'user',
      updatedAt: now
    })
    .where(eq(users.id, userId))
  
  // Return updated user
  const [updatedUser] = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  
  return {
    user: updatedUser
  }
})
