import { readBody } from 'h3'
import { signup, setAuthCookie } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password } = body

  if (!email || !password) {
    throw createError({
      statusCode: 400,
      message: 'Email and password are required'
    })
  }

  const result = await signup(email, password)
  
  // Set auth cookie
  setAuthCookie(event, result.token)

  return {
    user: result.user
  }
})
