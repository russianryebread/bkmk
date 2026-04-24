import { db } from '~/server/database'
import { bookmarks, bookmarkTags, tags } from '~/server/database/schema'
import { sql, desc, eq, and, isNull } from 'drizzle-orm'
import { getQuery } from 'h3'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  // Require authentication
  const currentUser = await requireAuth(event)

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
    // Only search bookmarks belonging to current user
    const rawResults = await db
      .select()
      .from(bookmarks)
      .leftJoin(bookmarkTags, eq(bookmarks.id, bookmarkTags.bookmarkId))
      .leftJoin(tags, eq(bookmarkTags.tagId, tags.id))
      .where(
        and(
          eq(bookmarks.userId, currentUser.id),
          isNull(bookmarks.deletedAt),
          sql`(
            setweight(to_tsvector('english', COALESCE(${bookmarks.title}, '')), 'A') ||
            setweight(to_tsvector('english', COALESCE(${bookmarks.description}, '')), 'B') ||
            setweight(to_tsvector('english', COALESCE(${bookmarks.cleanedMarkdown}, '')), 'C')
          ) @@ plainto_tsquery('english', ${sanitizedTerm})`
        )
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
        bookmarkMap.set(bookmarkId, row)
      }
      if (row.tagName) {
        bookmarkMap.get(bookmarkId).tags.push(row.tagName)
      }
    }

    const transformedBookmarks = Array.from(bookmarkMap.values())

    return {
      bookmarks: transformedBookmarks,
      total: transformedBookmarks.length,
    }
  } catch (ftsError: any) {
    console.error('FTS search error, falling back to LIKE search:', ftsError)

    // Fallback to ILIKE search if FTS fails - also filter by userId
    const likePattern = `%${sanitizedTerm}%`

    const rawResults = await db
      .select()
      .from(bookmarks)
      .leftJoin(bookmarkTags, eq(bookmarks.id, bookmarkTags.bookmarkId))
      .leftJoin(tags, eq(bookmarkTags.tagId, tags.id))
      .where(
        and(
          eq(bookmarks.userId, currentUser.id),
          sql`${bookmarks.title} ILIKE ${likePattern} OR ${bookmarks.description} ILIKE ${likePattern} OR ${bookmarks.cleanedMarkdown} ILIKE ${likePattern}`
        )
      )
      .orderBy(desc(bookmarks.createdAt))
      .limit(limitNum)

    // Group by bookmark and aggregate tags
    const bookmarkMap = new Map<string, any>()
    for (const row of rawResults) {
      const bookmarkId = row.id
      if (!bookmarkMap.has(bookmarkId)) {
        bookmarkMap.set(bookmarkId, row)
      }
      if (row.tagName) {
        bookmarkMap.get(bookmarkId).tags.push(row.tagName)
      }
    }

    const transformedBookmarks = Array.from(bookmarkMap.values())

    return {
      bookmarks: transformedBookmarks,
      total: transformedBookmarks.length,
    }
  }
})
