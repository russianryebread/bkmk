import { readBody } from 'h3'
import { login, setAuthCookie, getBearerToken } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password } = body

  if (!email || !password) {
    throw createError({
      statusCode: 400,
      message: 'Email and password are required'
    })
  }

  const result = await login(email, password)
  
  // Set auth cookie for web app
  setAuthCookie(event, result.token)

  // Check if this is an API request (using Bearer token in header)
  // If so, return the token for programmatic access
  const bearerToken = getBearerToken(event)
  const isApiRequest = !!bearerToken

  return {
    user: result.user,
    // Return token for third-party API access
    token: isApiRequest ? result.token : undefined
  }
})
