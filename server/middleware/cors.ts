import { defineEventHandler, setResponseHeader, getRequestHeader } from 'h3'

// CORS configuration for API access.
// CORS_ORIGINS is a comma-separated allowlist of explicit origins.
// There is intentionally NO `*` fallback: an empty allowlist means
// same-origin only (no permissive CORS headers are emitted).
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)
const CORS_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
const CORS_HEADERS = ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']

export default defineEventHandler((event) => {
  // Only apply CORS to API routes
  const url = event.path || ''
  if (!url.startsWith('/api')) {
    return
  }

  // Only emit cross-origin headers when the request's Origin is explicitly
  // allowlisted. We never reflect `*` together with credentials.
  const origin = getRequestHeader(event, 'origin') || ''
  const isAllowed = !!origin && CORS_ORIGINS.includes(origin)

  // Handle preflight requests
  if (event.method === 'OPTIONS') {
    if (isAllowed) {
      setResponseHeader(event, 'Access-Control-Allow-Origin', origin)
      setResponseHeader(event, 'Access-Control-Allow-Methods', CORS_METHODS.join(', '))
      setResponseHeader(event, 'Access-Control-Allow-Headers', CORS_HEADERS.join(', '))
      setResponseHeader(event, 'Access-Control-Allow-Credentials', 'true')
      setResponseHeader(event, 'Access-Control-Max-Age', 86400)
      setResponseHeader(event, 'Vary', 'Origin')
    }

    event.node.res.statusCode = 204
    event.node.res.end()
    return
  }

  // For actual requests, only add CORS headers for allowlisted origins.
  if (isAllowed) {
    setResponseHeader(event, 'Access-Control-Allow-Origin', origin)
    setResponseHeader(event, 'Access-Control-Allow-Credentials', 'true')
    setResponseHeader(event, 'Access-Control-Expose-Headers', 'X-Request-Id')
    setResponseHeader(event, 'Vary', 'Origin')
  }
})
