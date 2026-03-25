import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
})

export function useMarkdown() {
  function render(content: string): string {
    return md.render(content)
  }

  function renderInline(content: string): string {
    return md.renderInline(content)
  }

  return {
    render,
    renderInline,
  }
}
