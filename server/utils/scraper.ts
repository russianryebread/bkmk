import axios from 'axios'
import * as cheerio from 'cheerio'
import { Readability, isProbablyReaderable } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import TurndownService from 'turndown'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { assertSafeUrl } from '~/server/utils/ssrf'

export interface ScrapedContent {
  title: string
  content: string
  markdown: string
  html: string
  originalHtml: string
  description: string | null
  siteName: string | null
  author: string | null
  publishedTime: string | null
  wordCount: number
  readingTimeMinutes: number
  images: string[]
  localImagePaths: Record<string, string>
  isReadable: boolean
}

export interface ImageDownloadResult {
  url: string
  localPath: string
  altText: string
  position: number
}

// Ensure images directory exists
const IMAGES_DIR = path.join(process.cwd(), 'server', 'database', 'images')

function ensureImagesDir(): void {
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true })
  }
}

function getImageFilename(url: string): string {
  const hash = crypto.createHash('md5').update(url).digest('hex')
  const ext = getImageExtension(url)
  return `${hash}${ext}`
}

function getImageExtension(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const match = pathname.match(/\.(jpe?g|png|gif|webp|svg|ico|bmp)(\?|$)/i)
    if (match) {
      return (match[0].split('?')[0] ?? '').toLowerCase()
    }
  } catch {
    // ignore
  }
  return '.jpg' // default extension
}

async function downloadImage(imageUrl: string): Promise<{ localPath: string; success: boolean }> {
  try {
    ensureImagesDir()
    
    const filename = getImageFilename(imageUrl)
    const localPath = path.join(IMAGES_DIR, filename)
    
    // Skip if already downloaded
    if (fs.existsSync(localPath)) {
      return { localPath, success: true }
    }

    // SSRF guard: reject URLs that resolve to internal/private addresses.
    await assertSafeUrl(imageUrl)

    const response = await axios.get(imageUrl, {
      timeout: 15000,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': new URL(imageUrl).origin,
      },
      // NOTE: redirects are still followed; redirect targets are NOT
      // re-validated against the SSRF rules — only the initial URL is checked.
      maxRedirects: 3,
    })
    
    fs.writeFileSync(localPath, response.data)
    
    // Return path relative to database directory
    const relativePath = `database/images/${filename}`
    return { localPath: relativePath, success: true }
  } catch (error) {
    console.error(`Failed to download image: ${imageUrl}`, error)
    return { localPath: imageUrl, success: false }
  }
}

function canReadabilityParse(html: string): { canParse: boolean; confidence: number } {
  try {
    const doc = new JSDOM(html)
    const document = doc.window.document
    const body = document.body
    if (!body) return { canParse: false, confidence: 0 }

    // Readability's own candidate scoring discounts navigation and short links.
    // Body length and a heading alone used to promote link directories to articles.
    const likely = isProbablyReaderable(document, {
      minContentLength: 140,
      minScore: 20,
    })
    const prose = (Array.from(body.querySelectorAll('p')) as Element[])
      .filter(p => (p.textContent?.trim().length ?? 0) >= 80)
    const proseWords = prose.reduce((sum: number, p: Element) => sum + countWords(p.textContent || ''), 0)
    const proseLinkWords = prose.reduce((sum: number, p: Element) =>
      sum + (Array.from(p.querySelectorAll('a')) as Element[]).reduce((n: number, a: Element) => n + countWords(a.textContent || ''), 0), 0)
    const linkDensity = proseWords ? proseLinkWords / proseWords : 1
    const canParse = likely && proseWords >= 80 && linkDensity < 0.4
    return { canParse, confidence: canParse ? Math.min(1, proseWords / 250) : 0 }
  } catch {
    return { canParse: false, confidence: 0 }
  }
}

function removeScripts(html: string): string {
  const $ = cheerio.load(html)
  
  // Remove script tags and their contents
  $('script').remove()
  
  // Remove style tags
  $('style').remove()
  
  // Remove noscript tags
  $('noscript').remove()
  
  // Remove iframe tags
  $('iframe').remove()
  
  // Remove on* event handlers from all elements
  $('*').each(function() {
    const attrs = (this as any).attribs
    if (attrs) {
      Object.keys(attrs).forEach(attr => {
        if (attr.toLowerCase().startsWith('on')) {
          $(this).removeAttr(attr)
        }
      })
      
      // Remove javascript: hrefs
      const href = attrs.href
      if (href && href.toLowerCase().startsWith('javascript:')) {
        $(this).removeAttr('href')
      }
      
      // Remove src attributes that are javascript
      const src = attrs.src
      if (src && src.toLowerCase().startsWith('javascript:')) {
        $(this).removeAttr('src')
      }
    }
  })
  
  return $.html()
}

function cleanHtml(html: string): string {
  let cleaned = removeScripts(html)
  
  const $ = cheerio.load(cleaned)
  
  // Remove inline event handlers (additional pass)
  $('*').each(function() {
    const elem = $(this)
    const attrs = Object.keys((this as any).attribs || {})
    attrs.forEach(attr => {
      if (/^on/i.test(attr)) {
        elem.removeAttr(attr)
      }
    })
  })
  
  // Remove javascript: URIs
  $('[href^="javascript:"]').removeAttr('href')
  
  return $.html()
}

export async function scrapeUrl(url: string): Promise<ScrapedContent> {
  try {
    // Validate URL
    const urlObj = new URL(url)
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('Invalid URL protocol')
    }

    // SSRF guard: reject URLs that resolve to internal/private addresses.
    await assertSafeUrl(url)

    // Fetch the page
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      // NOTE: redirects are still followed; redirect targets are NOT
      // re-validated against the SSRF rules — only the initial URL is checked.
      maxRedirects: 5,
    })

    let html = response.data as string
    const $ = cheerio.load(html)

    // Remove initial script/style/noscript/iframe elements
    $('script, style, noscript, iframe').remove()

    // Extract metadata
    const title = extractTitle($) || urlObj.hostname
    const description = extractDescription($)
    const siteName = $('meta[property="og:site_name"]').attr('content') || urlObj.hostname
    const author = extractAuthor($)
    const publishedTime = $('meta[property="article:published_time"]').attr('content') || null

    // Only promote pages with substantial prose to reader content. Otherwise
    // retain metadata and save a plain link, which works well for landing pages.
    const parseability = canReadabilityParse(html)
    const articleHtml = parseability.canParse ? extractWithReadability(html, url) : ''
    const articleText = cheerio.load(articleHtml).text()
    const isReadable = parseability.canParse && countWords(articleText) >= 80
    
    // Clean the HTML
    const cleanedArticleHtml = isReadable ? cleanHtml(articleHtml) : ''

    // Extract images before converting to markdown
    const images = isReadable ? extractImageUrls($, cleanedArticleHtml) : []
    
    // Don't download images here - let the API handle it (database storage)
    const localImagePaths: Record<string, string> = {}

    // Convert to markdown - keep original image URLs (don't replace with local paths)
    // The API will handle image downloading and URL replacement
    const turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
    })

    const markdown = isReadable ? turndown.turndown(cleanedArticleHtml) : `[${url}](${url})`

    // Count words
    const wordCount = countWords(markdown)
    const readingTimeMinutes = Math.ceil(wordCount / 200)

    return {
      title,
      content: cleanedArticleHtml,
      markdown,
      html: removeScripts(html),
      originalHtml: html, // Keep original HTML with original image URLs
      description,
      siteName,
      author,
      publishedTime,
      wordCount: isReadable ? wordCount : 0,
      readingTimeMinutes: isReadable ? readingTimeMinutes : 0,
      images: images.map(i => i.url),
      localImagePaths,
      isReadable,
    }
  } catch (error: any) {
    throw new Error(`Failed to scrape URL: ${error.message}`)
  }
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
    // Use JSDOM with the URL for proper relative URL resolution
    const doc = new JSDOM(html, { url })
    const reader = new Readability(doc.window.document, {
      charThreshold: 100,
    })
    const article = reader.parse()
    return article?.content || ''
  } catch (error) {
    console.error('Readability parsing failed:', error)
    return ''
  }
}

function extractImageUrls($: cheerio.CheerioAPI, articleHtml: string): { url: string; alt: string }[] {
  const images: { url: string; alt: string }[] = []
  const $article = cheerio.load(articleHtml)
  
  $article('img').each((_, img) => {
    const src = $article(img).attr('src') || $article(img).attr('data-src') || $article(img).attr('data-lazy-src')
    const alt = $article(img).attr('alt') || ''
    if (src && !src.startsWith('data:') && !src.startsWith('blob:')) {
      images.push({ url: src, alt })
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

// Export for use by the scrape API
export { downloadImage, cleanHtml, removeScripts, canReadabilityParse, getImageFilename, IMAGES_DIR }
