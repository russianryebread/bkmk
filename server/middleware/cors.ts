import { defineEventHandler, setResponseHeader, getRequestHeader } from 'h3'

// CORS configuration for API access
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '*').split(',')
const CORS_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
const CORS_HEADERS = ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']

export default defineEventHandler((event) => {
  // Only apply CORS to API routes
  const url = event.path || ''
  if (!url.startsWith('/api')) {
    return
  }

  // Determine allowed origin
  const origin = getRequestHeader(event, 'origin') || ''
  let allowOrigin = '*'
  
  if (CORS_ORIGINS[0] !== '*') {
    if (origin && CORS_ORIGINS.includes(origin)) {
      allowOrigin = origin
    } else {
      allowOrigin = CORS_ORIGINS[0] || ''
    }
  }

  // Handle preflight requests
  if (event.method === 'OPTIONS') {
    setResponseHeader(event, 'Access-Control-Allow-Origin', allowOrigin)
    setResponseHeader(event, 'Access-Control-Allow-Methods', CORS_METHODS.join(', '))
    setResponseHeader(event, 'Access-Control-Allow-Headers', CORS_HEADERS.join(', '))
    setResponseHeader(event, 'Access-Control-Allow-Credentials', 'true')
    setResponseHeader(event, 'Access-Control-Max-Age', '86400')
    
    event.node.res.statusCode = 204
    event.node.res.end()
    return
  }

  // For actual requests, add CORS headers
  setResponseHeader(event, 'Access-Control-Allow-Origin', allowOrigin)
  setResponseHeader(event, 'Access-Control-Allow-Credentials', 'true')
  setResponseHeader(event, 'Access-Control-Expose-Headers', 'X-Request-Id')
})
