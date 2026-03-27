import { getRouterParam } from 'h3'
import { requireRole } from '~/server/utils/auth'
import { db } from '~/server/database'
import { users } from '~/server/database/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  // Require admin role
  const currentUser = await requireRole(event, 'admin')
  
  const userId = getRouterParam(event, 'id')
  
  if (!userId) {
    throw createError({
      statusCode: 400,
      message: 'User ID is required'
    })
  }
  
  // Cannot delete yourself
  if (userId === currentUser.id) {
    throw createError({
      statusCode: 400,
      message: 'Cannot delete your own account'
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
  
  // Delete user (this will cascade to their data due to the foreign key setup)
  await db.delete(users).where(eq(users.id, userId))
  
  return {
    success: true
  }
})
