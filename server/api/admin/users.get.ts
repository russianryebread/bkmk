import { requireRole } from '~/server/utils/auth'
import { db } from '~/server/database'
import { users } from '~/server/database/schema'
import { desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  // Require admin role
  const currentUser = await requireRole(event, 'admin')
  
  // Get all users (for admin management)
  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt
    })
    .from(users)
    .orderBy(desc(users.createdAt))
  
  return {
    users: allUsers.map(u => ({
      id: u.id,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt
    }))
  }
})
