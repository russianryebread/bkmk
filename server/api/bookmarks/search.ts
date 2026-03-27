import { db } from '~/server/database'
import { bookmarks, bookmarkTags, tags } from '~/server/database/schema'
import { sql, desc, eq } from 'drizzle-orm'
import { getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { q, limit = '20' } = query

  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    return { bookmarks: [], total: 0 }
  }

  const searchTerm = q.trim()
  const limitNum = Math.min(parseInt(limit as string), 100)

  // Sanitize search term for PostgreSQL tsquery
  const sanitizedTerm = searchTerm
    .replace(/[():*<>&|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (sanitizedTerm.length === 0) {
    return { bookmarks: [], total: 0 }
  }

  try {
    // Use PostgreSQL full-text search with to_tsvector and to_tsquery
    const rawResults = await db
      .select({
        id: bookmarks.id,
        title: bookmarks.title,
        url: bookmarks.url,
        description: bookmarks.description,
        cleaned_markdown: bookmarks.cleanedMarkdown,
        original_html: bookmarks.originalHtml,
        reading_time_minutes: bookmarks.readingTimeMinutes,
        saved_at: bookmarks.savedAt,
        last_accessed_at: bookmarks.lastAccessedAt,
        is_favorite: bookmarks.isFavorite,
        sort_order: bookmarks.sortOrder,
        thumbnail_image_path: bookmarks.thumbnailImagePath,
        is_read: bookmarks.isRead,
        read_at: bookmarks.readAt,
        source_domain: bookmarks.sourceDomain,
        word_count: bookmarks.wordCount,
        created_at: bookmarks.createdAt,
        updated_at: bookmarks.updatedAt,
        tagName: tags.name,
        tagId: tags.id,
      })
      .from(bookmarks)
      .leftJoin(bookmarkTags, eq(bookmarks.id, bookmarkTags.bookmarkId))
      .leftJoin(tags, eq(bookmarkTags.tagId, tags.id))
      .where(
        sql`(
          setweight(to_tsvector('english', COALESCE(${bookmarks.title}, '')), 'A') ||
          setweight(to_tsvector('english', COALESCE(${bookmarks.description}, '')), 'B') ||
          setweight(to_tsvector('english', COALESCE(${bookmarks.cleanedMarkdown}, '')), 'C')
        ) @@ plainto_tsquery('english', ${sanitizedTerm})`
      )
      .orderBy(
        sql`ts_rank(
          setweight(to_tsvector('english', COALESCE(${bookmarks.title}, '')), 'A') ||
          setweight(to_tsvector('english', COALESCE(${bookmarks.description}, '')), 'B') ||
          setweight(to_tsvector('english', COALESCE(${bookmarks.cleanedMarkdown}, '')), 'C'),
          plainto_tsquery('english', ${sanitizedTerm})
        ) DESC`
      )
      .limit(limitNum)

    // Group by bookmark and aggregate tags
    const bookmarkMap = new Map<string, any>()
    for (const row of rawResults) {
      const bookmarkId = row.id
      if (!bookmarkMap.has(bookmarkId)) {
        bookmarkMap.set(bookmarkId, {
          id: row.id,
          title: row.title,
          url: row.url,
          description: row.description,
          cleaned_markdown: row.cleaned_markdown,
          original_html: row.original_html,
          reading_time_minutes: row.reading_time_minutes,
          saved_at: row.saved_at,
          last_accessed_at: row.last_accessed_at,
          is_favorite: Boolean(row.is_favorite),
          sort_order: row.sort_order,
          thumbnail_image_path: row.thumbnail_image_path,
          is_read: Boolean(row.is_read),
          read_at: row.read_at,
          source_domain: row.source_domain,
          word_count: row.word_count,
          created_at: row.created_at,
          updated_at: row.updated_at,
          tags: [],
          tag_ids: [],
        })
      }
      if (row.tagName) {
        bookmarkMap.get(bookmarkId).tags.push(row.tagName)
        bookmarkMap.get(bookmarkId).tag_ids.push(row.tagId)
      }
    }

    const transformedBookmarks = Array.from(bookmarkMap.values())

    return {
      bookmarks: transformedBookmarks,
      total: transformedBookmarks.length,
    }
  } catch (ftsError: any) {
    console.error('FTS search error, falling back to LIKE search:', ftsError)

    // Fallback to ILIKE search if FTS fails
    const likePattern = `%${sanitizedTerm}%`

    const rawResults = await db
      .select({
        id: bookmarks.id,
        title: bookmarks.title,
        url: bookmarks.url,
        description: bookmarks.description,
        cleaned_markdown: bookmarks.cleanedMarkdown,
        original_html: bookmarks.originalHtml,
        reading_time_minutes: bookmarks.readingTimeMinutes,
        saved_at: bookmarks.savedAt,
        last_accessed_at: bookmarks.lastAccessedAt,
        is_favorite: bookmarks.isFavorite,
        sort_order: bookmarks.sortOrder,
        thumbnail_image_path: bookmarks.thumbnailImagePath,
        is_read: bookmarks.isRead,
        read_at: bookmarks.readAt,
        source_domain: bookmarks.sourceDomain,
        word_count: bookmarks.wordCount,
        created_at: bookmarks.createdAt,
        updated_at: bookmarks.updatedAt,
        tagName: tags.name,
        tagId: tags.id,
      })
      .from(bookmarks)
      .leftJoin(bookmarkTags, eq(bookmarks.id, bookmarkTags.bookmarkId))
      .leftJoin(tags, eq(bookmarkTags.tagId, tags.id))
      .where(
        sql`${bookmarks.title} ILIKE ${likePattern} OR ${bookmarks.description} ILIKE ${likePattern} OR ${bookmarks.cleanedMarkdown} ILIKE ${likePattern}`
      )
      .orderBy(desc(bookmarks.createdAt))
      .limit(limitNum)

    // Group by bookmark and aggregate tags
    const bookmarkMap = new Map<string, any>()
    for (const row of rawResults) {
      const bookmarkId = row.id
      if (!bookmarkMap.has(bookmarkId)) {
        bookmarkMap.set(bookmarkId, {
          id: row.id,
          title: row.title,
          url: row.url,
          description: row.description,
          cleaned_markdown: row.cleaned_markdown,
          original_html: row.original_html,
          reading_time_minutes: row.reading_time_minutes,
          saved_at: row.saved_at,
          last_accessed_at: row.last_accessed_at,
          is_favorite: Boolean(row.is_favorite),
          sort_order: row.sort_order,
          thumbnail_image_path: row.thumbnail_image_path,
          is_read: Boolean(row.is_read),
          read_at: row.read_at,
          source_domain: row.source_domain,
          word_count: row.word_count,
          created_at: row.created_at,
          updated_at: row.updated_at,
          tags: [],
          tag_ids: [],
        })
      }
      if (row.tagName) {
        bookmarkMap.get(bookmarkId).tags.push(row.tagName)
        bookmarkMap.get(bookmarkId).tag_ids.push(row.tagId)
      }
    }

    const transformedBookmarks = Array.from(bookmarkMap.values())

    return {
      bookmarks: transformedBookmarks,
      total: transformedBookmarks.length,
    }
  }
})
