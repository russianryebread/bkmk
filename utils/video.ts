// Shared video-URL parsing for the scraper (server) and the markdown renderer
// (client). Kept deliberately narrow: a URL only counts as a video if we can
// actually embed it, which today means YouTube and Vimeo.
//
// IMPORTANT: the player origins returned by `embedUrl` must stay in sync with
// the `frame-src` allowlist in server/middleware/security-headers.ts. Adding a
// platform here without adding its origin there produces a silently blank
// player.

export type VideoPlatform = 'youtube' | 'vimeo'

export interface VideoRef {
  platform: VideoPlatform
  id: string
  /** Canonical page for the video — what we link out to. */
  watchUrl: string
  /** Player URL. Privacy-preserving variants where the platform offers one. */
  embedUrl: string
  /** oEmbed endpoint for title / author / thumbnail lookup. */
  oembedUrl: string
}

// YouTube IDs are always 11 chars of [A-Za-z0-9_-].
const YOUTUBE_ID = /^[a-zA-Z0-9_-]{11}$/
const VIMEO_ID = /^\d+$/

// Exact host, or a subdomain of it. Written this way so `evilyoutube.com`
// cannot match `youtube.com`.
function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`)
}

function youtube(id: string | undefined | null): VideoRef | null {
  if (!id || !YOUTUBE_ID.test(id)) return null
  return {
    platform: 'youtube',
    id,
    watchUrl: `https://www.youtube.com/watch?v=${id}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
    oembedUrl: `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`,
  }
}

function vimeo(id: string | undefined | null): VideoRef | null {
  if (!id || !VIMEO_ID.test(id)) return null
  return {
    platform: 'vimeo',
    id,
    watchUrl: `https://vimeo.com/${id}`,
    embedUrl: `https://player.vimeo.com/video/${id}`,
    oembedUrl: `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${id}`)}`,
  }
}

/**
 * Resolve a URL to an embeddable video, or null if it isn't one.
 *
 * Parses the URL properly rather than substring-matching, so a tracking param
 * that happens to contain "youtube.com" can't be mistaken for a video.
 */
export function parseVideoUrl(raw: string): VideoRef | null {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null

  const host = u.hostname.toLowerCase().replace(/^www\./, '')
  const segments = u.pathname.split('/').filter(Boolean)

  if (host === 'youtu.be') {
    return youtube(segments[0])
  }

  if (hostMatches(host, 'youtube.com') || hostMatches(host, 'youtube-nocookie.com')) {
    if (segments[0] === 'watch') return youtube(u.searchParams.get('v'))
    // /shorts/<id>, /embed/<id>, /v/<id>, /live/<id>
    if (['shorts', 'embed', 'v', 'live'].includes(segments[0] ?? '')) {
      return youtube(segments[1])
    }
    return null
  }

  if (hostMatches(host, 'vimeo.com')) {
    // vimeo.com/<id> and player.vimeo.com/video/<id>
    return vimeo(segments[0] === 'video' ? segments[1] : segments[0])
  }

  return null
}
