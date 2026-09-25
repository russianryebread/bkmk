/** Small, safe markdown decoration for the lightweight editor overlay. */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function decorateInline(text: string): string {
  let html = escapeHtml(text)
  // Order matters: combined emphasis must be recognized before single markers.
  html = html.replace(/(\*\*\*|___)(?=\S)(.+?\S)\1/g, '<span class="md-marker">$1</span><strong class="md-strong"><em class="md-em">$2</em></strong><span class="md-marker">$1</span>')
  html = html.replace(/(\*\*|__)(?=\S)(.+?\S)\1/g, '<span class="md-marker">$1</span><strong class="md-strong">$2</strong><span class="md-marker">$1</span>')
  html = html.replace(/(\*|_)(?=\S)(.+?\S)\1/g, '<span class="md-marker">$1</span><em class="md-em">$2</em><span class="md-marker">$1</span>')
  return html
}

export function decorateMarkdown(markdown: string): string {
  if (!markdown) return ''
  return markdown.split('\n').map((line) => {
    const heading = line.match(/^(#{1,3})(\s+)(.*)$/)
    if (heading) {
      const hashes = heading[1] ?? ''
      const spacing = heading[2] ?? ''
      const level = hashes.length
      return `<span class="md-heading md-h${level}"><span class="md-marker">${hashes}${spacing}</span>${decorateInline(heading[3] ?? '')}</span>`
    }
    const list = line.match(/^(\s*)([-*+]|\d+[.)])(\s+)(.*)$/)
    if (list) {
      const indent = list[1] ?? ''
      const symbol = list[2] ?? '-'
      const spacing = list[3] ?? ' '
      const marker = /^\d/.test(symbol) ? `${symbol}${spacing}` : `•${spacing}`
      return `${indent}<span class="md-list-marker">${escapeHtml(marker)}</span>${decorateInline(list[4] ?? '')}`
    }
    return decorateInline(line)
  }).join('\n')
}
