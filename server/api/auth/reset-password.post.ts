import { readBody } from 'h3'
import { resetPassword } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { token, password } = body

  if (!token || !password) {
    throw createError({
      statusCode: 400,
      message: 'Token and new password are required'
    })
  }

  const result = await resetPassword(token, password)

  return result
})
