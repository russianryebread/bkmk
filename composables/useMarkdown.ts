import MarkdownIt from 'markdown-it'
import DOMPurify from 'isomorphic-dompurify'

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
})

// DOMPurify options. The defaults already strip <script>, event-handler
// attributes (onclick, onerror, ...) and dangerous URI schemes like
// javascript:. We explicitly allow <img> with src/alt/title so the reader can
// still display images, plus target/rel on links for external navigation.
const PURIFY_OPTIONS = {
  ADD_TAGS: ['img'],
  ADD_ATTR: ['target', 'rel'],
} as const

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
