import { getDb } from '../utils/db'
import { scrapeUrl, extractDomain } from '../utils/scraper'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody(event)
  
  const { url } = body

  if (!url || typeof url !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'URL is required',
    })
  }

  // Validate URL
  try {
    new URL(url)
  } catch {
    throw createError({
      statusCode: 400,
      message: 'Invalid URL format',
    })
  }

  // Check if bookmark already exists
  const existing = db.prepare('SELECT id FROM bookmarks WHERE url = ?').get(url)
  if (existing) {
    throw createError({
      statusCode: 409,
      message: 'Bookmark already exists',
    })
  }

  // Scrape the URL
  const scraped = await scrapeUrl(url)
  
  // Generate ID
  const id = Array.from({ length: 16 }, () => 
    Math.floor(Math.random() * 16).toString(16)
  ).join('')

  // Extract domain
  const sourceDomain = extractDomain(url)

  // Insert bookmark
  db.prepare(`
    INSERT INTO bookmarks (
      id, title, url, description, original_html, cleaned_markdown,
      reading_time_minutes, source_domain, word_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    scraped.title,
    url,
    scraped.description,
    scraped.html,
    scraped.markdown,
    scraped.readingTimeMinutes,
    sourceDomain,
    scraped.wordCount
  )

  // Update sync metadata
  db.prepare(`
    INSERT INTO sync_metadata (entity_type, entity_id, last_modified_at, sync_status)
    VALUES ('bookmark', ?, CURRENT_TIMESTAMP, 'pending')
  `).run(id)

  // Get the created bookmark
  const bookmark = db.prepare(`
    SELECT b.*,
      GROUP_CONCAT(DISTINCT t.name) as tags,
      GROUP_CONCAT(DISTINCT t.id) as tag_ids
    FROM bookmarks b
    LEFT JOIN bookmark_tags bt ON b.id = bt.bookmark_id
    LEFT JOIN tags t ON bt.tag_id = t.id
    WHERE b.id = ?
    GROUP BY b.id
  `).get(id) as any

  return {
    ...bookmark,
    is_favorite: Boolean(bookmark.is_favorite),
    is_read: Boolean(bookmark.is_read),
    tags: bookmark.tags ? bookmark.tags.split(',') : [],
    tag_ids: bookmark.tag_ids ? bookmark.tag_ids.split(',') : [],
  }
})
