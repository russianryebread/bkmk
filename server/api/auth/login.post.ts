import { readBody, getRequestIP } from 'h3'
import { login, setAuthCookie, getBearerToken } from '~/server/utils/auth'
import { checkRateLimit } from '~/server/utils/rate-limit'

const LOGIN_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const LOGIN_MAX_ATTEMPTS = 5

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password } = body

  if (!email || !password) {
    throw createError({
      statusCode: 400,
      message: 'Email and password are required'
    })
  }

  // Rate limit by client IP + email to slow down brute-force attempts
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const rateKey = `login:${ip}:${String(email).toLowerCase()}`
  if (!checkRateLimit(rateKey, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS).allowed) {
    throw createError({
      statusCode: 429,
      message: 'Too many attempts, please try again later'
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
