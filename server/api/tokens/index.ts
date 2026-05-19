import { requireAuth, createApiToken, listApiTokens } from '~/server/utils/auth'

// Maximum lifetime for an API token. Long-lived tokens are a liability if
// leaked, so we cap and default the expiry to 90 days.
const MAX_TOKEN_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  
  if (event.method === 'GET') {
    // List all tokens for the user
    const tokens = await listApiTokens(user.id)
    return { tokens }
  }
  
  if (event.method === 'POST') {
    // Create a new token
    const body = await readBody(event)
    
    if (!body?.name) {
      throw createError({
        statusCode: 400,
        message: 'Token name is required'
      })
    }
    
    // Enforce a maximum token lifetime. Default to the max when omitted;
    // reject anything beyond the cap (or an unparseable date).
    const now = Date.now()
    const maxExpiry = now + MAX_TOKEN_LIFETIME_MS
    let expiresAt: string
    if (body.expiresAt) {
      const requested = new Date(body.expiresAt).getTime()
      if (Number.isNaN(requested)) {
        throw createError({
          statusCode: 400,
          message: 'Invalid expiresAt date'
        })
      }
      if (requested > maxExpiry) {
        throw createError({
          statusCode: 400,
          message: 'Token expiry cannot exceed 90 days'
        })
      }
      expiresAt = new Date(requested).toISOString()
    } else {
      expiresAt = new Date(maxExpiry).toISOString()
    }

    const result = await createApiToken(user.id, body.name, expiresAt)

    // Return the full token only on creation (never again)
    return {
      token: result.token,
      tokenRecord: result.tokenRecord
    }
  }
  
  throw createError({
    statusCode: 405,
    message: 'Method not allowed'
  })
})
