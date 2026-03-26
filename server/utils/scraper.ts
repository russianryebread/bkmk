import axios from 'axios'
import * as cheerio from 'cheerio'
import { Readability } from '@mozilla/readability'
import TurndownService from 'turndown'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

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
  localImagePaths: Record<string, string>
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
      return match[0].split('?')[0].toLowerCase()
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
    
    const response = await axios.get(imageUrl, {
      timeout: 15000,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': new URL(imageUrl).origin,
      },
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
    const doc = new DOMParser().parseFromString(html, 'text/html')
    
    // Check for basic content indicators
    const body = doc.body
    if (!body) return { canParse: false, confidence: 0 }
    
    // Check for article-like elements
    const articleElements = body.querySelectorAll('article, [role="main"], main, .content, .post, .entry')
    const hasArticleElements = articleElements.length > 0
    
    // Check text density
    const textLength = body.textContent?.length || 0
    const hasEnoughText = textLength > 500
    
    // Check for likely article content
    const headings = body.querySelectorAll('h1, h2, h3')
    const hasHeadings = headings.length > 0
    
    // Calculate confidence score
    let confidence = 0
    if (hasArticleElements) confidence += 0.4
    if (hasEnoughText) confidence += 0.3
    if (hasHeadings) confidence += 0.3
    
    return {
      canParse: confidence >= 0.4,
      confidence,
    }
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

    // Check if Readability can parse the page
    const parseability = canReadabilityParse(html)
    
    let articleHtml: string
    if (parseability.canParse && parseability.confidence >= 0.5) {
      // Good candidate for Readability
      articleHtml = extractWithReadability(html, url)
    } else if (parseability.canParse) {
      // Moderate confidence - try Readability but have fallback ready
      const readabilityResult = extractWithReadability(html, url)
      if (readabilityResult.length < 200) {
        // Readability didn't extract much, use body content
        articleHtml = $('body').html() || ''
      } else {
        articleHtml = readabilityResult
      }
    } else {
      // Low confidence - use body content directly
      articleHtml = $('body').html() || ''
    }
    
    // Clean the HTML
    articleHtml = cleanHtml(articleHtml)

    // Extract images before converting to markdown
    const images = extractImageUrls($, articleHtml)
    
    // Download images and get local paths
    const localImagePaths: Record<string, string> = {}
    
    for (let i = 0; i < images.length; i++) {
      const { url: imgUrl } = images[i]
      if (imgUrl && !imgUrl.startsWith('data:') && !imgUrl.startsWith('blob:')) {
        const result = await downloadImage(imgUrl)
        localImagePaths[imgUrl] = result.localPath
      }
    }

    // Convert to markdown with local image paths
    const turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
    })
    
    // Add custom rule for images that uses local paths
    turndown.addRule('images', {
      filter: 'img',
      replacement: (content, node) => {
        const img = node as HTMLImageElement
        const alt = img.alt || ''
        const src = img.src || ''
        const localPath = localImagePaths[src] || src
        return localPath ? `![${alt}](${localPath})` : ''
      }
    })

    let markdown = turndown.turndown(articleHtml)
    
    // Update markdown with local image paths (in case any were missed)
    for (const [originalUrl, localPath] of Object.entries(localImagePaths)) {
      markdown = markdown.replace(new RegExp(escapeRegex(originalUrl), 'g'), localPath)
    }

    // Count words
    const wordCount = countWords(markdown)
    const readingTimeMinutes = Math.ceil(wordCount / 200)

    return {
      title,
      content: articleHtml,
      markdown,
      html: removeScripts(html),
      description,
      siteName,
      author,
      publishedTime,
      wordCount,
      readingTimeMinutes,
      images: images.map(i => i.url),
      localImagePaths,
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
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const article = new Readability(doc as any, {
      charThreshold: 100,
    }).parse()
    return article?.content || ''
  } catch {
    // Fallback: extract body content manually
    const $ = cheerio.load(html)
    return $('body').html() || ''
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
