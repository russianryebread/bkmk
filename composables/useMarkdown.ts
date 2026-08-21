import MarkdownIt from 'markdown-it'
import DOMPurify from 'isomorphic-dompurify'
import { parseVideoUrl } from '~/utils/video'

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
})

// DOMPurify options. The defaults already strip <script>, event-handler
// attributes (onclick, onerror, ...) and dangerous URI schemes like
// javascript:. We explicitly allow <img> with src/alt/title so the reader can
// still display images, plus target/rel on links for external navigation.
//
// Note there is deliberately no `iframe` here. Video embeds render as inert
// placeholder markup (see the video_embed rule below) and the real player is
// injected imperatively on click by useVideoEmbeds(), so the allowlist stays
// closed.
const PURIFY_OPTIONS = {
  ADD_TAGS: ['img'],
  ADD_ATTR: ['target', 'rel'],
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ==================== VIDEO EMBEDS ====================

// Tokens that carry no visible content, so a paragraph containing only a link
// plus these still counts as "just a link".
function isIgnorableToken(token: any): boolean {
  if (token.type === 'softbreak' || token.type === 'hardbreak') return true
  return token.type === 'text' && token.content.trim() === ''
}

// Recognize a paragraph whose entire content is a single link to a video —
// either a bare (linkified) URL, or a thumbnail image wrapped in a link, which
// is the shape the scraper writes for video bookmarks.
function matchVideoParagraph(children: any[]): { href: string; poster: string | null; title: string } | null {
  const meaningful = children.filter((t) => !isIgnorableToken(t))
  if (meaningful.length < 2) return null

  const open = meaningful[0]
  const close = meaningful[meaningful.length - 1]
  if (open.type !== 'link_open' || close.type !== 'link_close') return null

  const href = open.attrGet('href')
  if (!href) return null

  const inner = meaningful.slice(1, -1)
  if (inner.length > 1) return null

  let poster: string | null = null
  let title = ''

  const child = inner[0]
  if (child) {
    if (child.type === 'image') {
      poster = child.attrGet('src')
      title = child.attrGet('alt') || child.content || ''
    } else if (child.type === 'text') {
      title = child.content
    } else {
      // Anything richer than a plain label or a thumbnail is left alone.
      return null
    }
  }

  return { href, poster, title }
}

function renderPlaceholder(
  video: NonNullable<ReturnType<typeof parseVideoUrl>>,
  poster: string | null,
  title: string,
): string {
  // A linkified bare URL has the URL itself as its text — useless as a label.
  const trimmed = title.trim()
  const label = !trimmed || trimmed === video.watchUrl || /^https?:\/\//.test(trimmed)
    ? 'Play video'
    : trimmed
  const attrs = [
    `class="video-embed"`,
    `data-video-embed="${escapeHtml(video.embedUrl)}"`,
    `data-video-platform="${escapeHtml(video.platform)}"`,
    `data-video-title="${escapeHtml(label)}"`,
  ].join(' ')

  // The <a> is the no-JS / pre-hydration state and stays a real, working link
  // to the original video.
  const posterMarkup = poster
    ? `<img class="video-embed__poster" src="${escapeHtml(poster)}" alt="${escapeHtml(label)}" />`
    : `<span class="video-embed__poster video-embed__poster--empty"></span>`

  return (
    `<div ${attrs}>` +
    `<a class="video-embed__link" href="${escapeHtml(video.watchUrl)}" target="_blank" rel="noopener">` +
    posterMarkup +
    `<span class="video-embed__play" aria-hidden="true"></span>` +
    `<span class="video-embed__label">${escapeHtml(label)}</span>` +
    `</a>` +
    `</div>`
  )
}

// Replace qualifying paragraphs with a single html_block carrying the inert
// placeholder. Runs as a core rule so it sees the finished token stream.
md.core.ruler.push('video_embed', (state) => {
  const tokens = state.tokens

  for (let i = 0; i < tokens.length; i++) {
    const inline = tokens[i]
    if (!inline || inline.type !== 'inline' || !inline.children) continue
    if (tokens[i - 1]?.type !== 'paragraph_open' || tokens[i + 1]?.type !== 'paragraph_close') continue

    const match = matchVideoParagraph(inline.children)
    if (!match) continue

    const video = parseVideoUrl(match.href)
    if (!video) continue

    const block = new state.Token('html_block', '', 0)
    block.content = renderPlaceholder(video, match.poster, match.title)
    block.block = true

    // Swap paragraph_open + inline + paragraph_close for the placeholder.
    tokens.splice(i - 1, 3, block)
    i -= 1
  }

  return true
})

// Convert relative image paths to absolute paths pointing to our images API
function convertImagePaths(html: string): string {
  // Match img tags with relative paths like src="database/images/xxx.jpg" or src="images/xxx.jpg"
  return html.replace(/src="(database\/)?images\/([^"]+)"/g, 'src="/api/images/$2"')
}

// Sanitize first so untrusted markup can never reach the DOM, then rewrite
// image paths. Running convertImagePaths last is safe because it only touches
// the src attribute of <img> tags that survived sanitization.
function sanitize(html: string): string {
  return convertImagePaths(DOMPurify.sanitize(html, PURIFY_OPTIONS))
}

export function useMarkdown() {
  function render(content: string): string {
    return sanitize(md.render(content))
  }

  function renderInline(content: string): string {
    return sanitize(md.renderInline(content))
  }

  return {
    render,
    renderInline,
  }
}
