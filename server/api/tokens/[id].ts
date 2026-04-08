import { requireAuth, revokeApiToken } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  
  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Token ID is required'
    })
  }
  
  if (event.method === 'DELETE') {
    // Revoke the token
    const success = await revokeApiToken(user.id, id)
    
    if (!success) {
      throw createError({
        statusCode: 404,
        message: 'Token not found'
      })
    }
    
    return { success: true, message: 'Token revoked successfully' }
  }
  
  throw createError({
    statusCode: 405,
    message: 'Method not allowed'
  })
})
