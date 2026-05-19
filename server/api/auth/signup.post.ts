import { readBody, getRequestIP } from 'h3'
import { signup, setAuthCookie } from '~/server/utils/auth'
import { checkRateLimit } from '~/server/utils/rate-limit'

const SIGNUP_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const SIGNUP_MAX_ATTEMPTS = 3

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password } = body

  if (!email || !password) {
    throw createError({
      statusCode: 400,
      message: 'Email and password are required'
    })
  }

  // Rate limit signups by client IP to prevent mass account creation
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  if (!checkRateLimit(`signup:${ip}`, SIGNUP_MAX_ATTEMPTS, SIGNUP_WINDOW_MS).allowed) {
    throw createError({
      statusCode: 429,
      message: 'Too many attempts, please try again later'
    })
  }

  const result = await signup(email, password)

  // Set auth cookie
  setAuthCookie(event, result.token)

  return {
    user: result.user
  }
})
