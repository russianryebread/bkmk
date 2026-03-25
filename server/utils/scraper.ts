import axios from 'axios'
import * as cheerio from 'cheerio'
import { Readability } from '@mozilla/readability'
import TurndownService from 'turndown'

export interface ScrapedContent {
  title: string
  content: string
  markdown: string
  html: string
  description: string | null
  siteName: string | null
  author: string | null
  publishedTime: string | null
  wordCount: number
  readingTimeMinutes: number
  images: string[]
}

export async function scrapeUrl(url: string): Promise<ScrapedContent> {
  try {
    // Validate URL
    const urlObj = new URL(url)
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('Invalid URL protocol')
    }

    // Fetch the page
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      maxRedirects: 5,
    })

    const html = response.data as string
    const $ = cheerio.load(html)

    // Remove script and style elements
    $('script, style, noscript, iframe').remove()

    // Extract metadata
    const title = extractTitle($) || urlObj.hostname
    const description = extractDescription($)
    const siteName = $('meta[property="og:site_name"]').attr('content') || urlObj.hostname
    const author = extractAuthor($)
    const publishedTime = $('meta[property="article:published_time"]').attr('content') || null

    // Use Readability for content extraction
    const articleHtml = extractWithReadability(html, url)
    
    // Convert to markdown
    const turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
    })
    
    // Add custom rules
    turndown.addRule('images', {
      filter: 'img',
      replacement: (content, node) => {
        const img = node as HTMLImageElement
        const alt = img.alt || ''
        const src = img.src || ''
        return src ? `![${alt}](${src})` : ''
      }
    })

    const markdown = turndown.turndown(articleHtml)
    
    // Count words
    const wordCount = countWords(markdown)
    const readingTimeMinutes = Math.ceil(wordCount / 200)

    // Extract images from content
    const images = extractImages($, articleHtml)

    return {
      title,
      content: articleHtml,
      markdown,
      html,
      description,
      siteName,
      author,
      publishedTime,
      wordCount,
      readingTimeMinutes,
      images,
    }
  } catch (error: any) {
    throw new Error(`Failed to scrape URL: ${error.message}`)
  }
}

function extractTitle($: cheerio.CheerioAPI): string | null {
  // Try Open Graph title first
  const ogTitle = $('meta[property="og:title"]').attr('content')
  if (ogTitle) return ogTitle

  // Try Twitter title
  const twitterTitle = $('meta[name="twitter:title"]').attr('content')
  if (twitterTitle) return twitterTitle

  // Fall back to document title
  const docTitle = $('title').text().trim()
  if (docTitle) return docTitle

  // Try h1
  const h1 = $('h1').first().text().trim()
  if (h1) return h1

  return null
}

function extractDescription($: cheerio.CheerioAPI): string | null {
  const ogDesc = $('meta[property="og:description"]').attr('content')
  if (ogDesc) return ogDesc

  const metaDesc = $('meta[name="description"]').attr('content')
  if (metaDesc) return metaDesc

  return null
}

function extractAuthor($: cheerio.CheerioAPI): string | null {
  const authorMeta = $('meta[name="author"]').attr('content')
  if (authorMeta) return authorMeta

  const articleAuthor = $('meta[property="article:author"]').attr('content')
  if (articleAuthor) return articleAuthor

  const byline = $('[rel="author"], .author, .byline').first().text().trim()
  if (byline) return byline

  return null
}

function extractWithReadability(html: string, url: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const article = new Readability(doc, {
      url,
      charThreshold: 100,
    }).parse()
    return article?.content || ''
  } catch {
    // Fallback: extract body content manually
    const $ = cheerio.load(html)
    return $('body').html() || ''
  }
}

function extractImages($: cheerio.CheerioAPI, articleHtml: string): string[] {
  const images: string[] = []
  const $article = cheerio.load(articleHtml)
  
  $article('img').each((_, img) => {
    const src = $(img).attr('src') || $(img).attr('data-src')
    if (src && !src.startsWith('data:')) {
      images.push(src)
    }
  })

  return images
}

function countWords(text: string): number {
  return text
    .replace(/[#*`_\[\]()]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 0)
    .length
}

export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace('www.', '')
  } catch {
    return ''
  }
}
