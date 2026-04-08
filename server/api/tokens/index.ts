import { requireAuth, createApiToken, listApiTokens } from '~/server/utils/auth'

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
    
    const result = await createApiToken(user.id, body.name, body.expiresAt)
    
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
