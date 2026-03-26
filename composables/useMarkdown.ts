import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
})

// Convert relative image paths to absolute paths pointing to our images API
function convertImagePaths(html: string): string {
  // Match img tags with relative paths like src="database/images/xxx.jpg" or src="images/xxx.jpg"
  return html.replace(/src="(database\/)?images\/([^"]+)"/g, 'src="/api/images/$2"')
}

export function useMarkdown() {
  function render(content: string): string {
    const html = md.render(content)
    return convertImagePaths(html)
  }

  function renderInline(content: string): string {
    const html = md.renderInline(content)
    return convertImagePaths(html)
  }

  return {
    render,
    renderInline,
  }
}
