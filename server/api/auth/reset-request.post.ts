import { readBody } from 'h3'
import { requestPasswordReset } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email } = body

  if (!email) {
    throw createError({
      statusCode: 400,
      message: 'Email is required'
    })
  }

  const result = await requestPasswordReset(email)

  return result
})
