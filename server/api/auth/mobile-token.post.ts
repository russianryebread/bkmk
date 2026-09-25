import { requireAuth, createApiToken } from '~/server/utils/auth'

/**
 * Exchange a freshly authenticated app session for a revocable, non-expiring
 * API credential. The raw credential is returned only once and is stored in
 * the iOS Keychain by the app/share extension.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const result = await createApiToken(user.id, 'Bkmk iOS app')

  return {
    token: result.token,
    tokenRecord: result.tokenRecord,
  }
})
