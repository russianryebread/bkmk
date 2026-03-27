import { readBody } from 'h3'
import { requireAuth, changePassword } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  
  const body = await readBody(event)
  const { currentPassword, newPassword } = body

  if (!currentPassword || !newPassword) {
    throw createError({
      statusCode: 400,
      message: 'Current password and new password are required'
    })
  }

  const result = await changePassword(user.id, currentPassword, newPassword)

  return result
})
