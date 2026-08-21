import { defineEventHandler, setResponseHeader } from 'h3'

// Adds baseline security headers to every response.
const isDev = process.env.NODE_ENV !== 'production'

// Content-Security-Policy.
//
// NOTE: `script-src` includes `'unsafe-inline'`. This is a known weakness and
// should be tightened later with per-request nonces. It is needed for now to
// avoid breaking the current Nuxt build, which emits inline scripts. Likewise
// `style-src` allows `'unsafe-inline'` because the app relies on inline styles.
//
// In development we additionally allow `'unsafe-eval'` and ws/http connections
// so Vite's HMR client keeps working.
const cspDirectives = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  `connect-src 'self'${isDev ? ' ws: http:' : ''}`,
  "font-src 'self' data:",
  // Video players injected by useVideoEmbeds(). Keep in sync with the
  // `embedUrl` origins in utils/video.ts — a platform added there without its
  // origin here renders a silently blank player. Thumbnails are proxied
  // through the images table, so `img-src` stays 'self'.
  "frame-src https://www.youtube-nocookie.com https://player.vimeo.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
]

const CSP = cspDirectives.join('; ')

export default defineEventHandler((event) => {
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  setResponseHeader(event, 'X-Frame-Options', 'DENY')
  setResponseHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin')
  setResponseHeader(event, 'Content-Security-Policy', CSP)
})
