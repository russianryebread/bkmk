import { readBody, getRequestIP } from 'h3'
import { requestPasswordReset } from '~/server/utils/auth'
import { checkRateLimit } from '~/server/utils/rate-limit'

const RESET_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const RESET_MAX_ATTEMPTS = 3

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email } = body

  if (!email) {
    throw createError({
      statusCode: 400,
      message: 'Email is required'
    })
  }

  // Rate limit reset requests by client IP + email to prevent abuse
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const rateKey = `reset:${ip}:${String(email).toLowerCase()}`
  if (!checkRateLimit(rateKey, RESET_MAX_ATTEMPTS, RESET_WINDOW_MS).allowed) {
    throw createError({
      statusCode: 429,
      message: 'Too many attempts, please try again later'
    })
  }

  const result = await requestPasswordReset(email)

  return result
})
