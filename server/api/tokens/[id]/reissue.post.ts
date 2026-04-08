import { requireAuth, reissueApiToken } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  
  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Token ID is required'
    })
  }
  
  const body = await readBody(event).catch(() => ({}))
  
  // Reissue the token
  const result = await reissueApiToken(user.id, id, body?.name)
  
  if (!result) {
    throw createError({
      statusCode: 404,
      message: 'Token not found'
    })
  }
  
  // Return the new token (only returned on reissue, never stored)
  return {
    token: result.token,
    tokenRecord: result.tokenRecord
  }
})
