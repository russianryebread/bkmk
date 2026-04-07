export function stripMarkdown(text) {
  if (typeof text !== 'string') return text;
  return text
    // Remove code blocks ```lang ... ```
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline code `...`
    .replace(/`([^`]+)`/g, '$1')
    // Remove images ![alt](url) -> alt
    .replace(/!\[([^\]]*)\]\([^\)]*\)/g, '$1')
    // Remove links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^\)]*\)/g, '$1')
    // Remove headings (#, ##, ### at line starts)
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    // Remove setext-style underlines
    .replace(/^[=-]{2,}\s*$/gm, '')
    // Remove bold/italic markers **, __, *, _
    .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '$2')
    .replace(/(\*|_)(?=\S)([\s\S]*?\S)\1/g, '$2')
    // Remove blockquote markers
    .replace(/^\s{0,3}>\s?/gm, '')
    // Remove unordered list markers (-, *, +) at line starts
    .replace(/^\s{0,3}([-*+])\s+/gm, '')
    // Remove ordered list markers (1. , 2. )
    .replace(/^\s{0,3}\d+\.\s+/gm, '')
    // Remove horizontal rules
    .replace(/(^|\n)([-*_]\s?){3,}(\n|$)/g, '\n')
    // Collapse multiple blank lines to two
    .replace(/\n{3,}/g, '\n\n')
    // Trim
    .trim();
}
