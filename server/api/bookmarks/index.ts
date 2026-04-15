import { db } from '~/server/database'
import { bookmarks, bookmarkTags, tags } from '~/server/database/schema'
import { eq, desc, asc, sql, and, isNull } from 'drizzle-orm'
import { getQuery } from 'h3'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  // Require authentication
  const currentUser = await requireAuth(event)
  
  const method = event.method

  if (method === 'GET') {
    const query = getQuery(event)
    
    const {
      page = '1',
      limit = '20',
      sort = 'created_at',
      order = 'desc',
      favorite,
      tag,
      domain,
      unread,
    } = query

    const pageNum = parseInt(page as string)
    const limitNum = parseInt(limit as string)
    const offset = (pageNum - 1) * limitNum

    // Build conditions array - always filter by userId
    const conditions: any[] = [eq(bookmarks.userId, currentUser.id), isNull(bookmarks.deletedAt)]

    if (favorite === 'true') {
      conditions.push(eq(bookmarks.isFavorite, 1))
    }

    if (unread === 'true') {
      conditions.push(eq(bookmarks.isRead, 0))
    }

    if (domain) {
      conditions.push(eq(bookmarks.sourceDomain, domain as string))
    }

    // Map sort column to schema field
    const sortColumnMap: Record<string, any> = {
      'created_at': bookmarks.createdAt,
      'title': bookmarks.title,
      'saved_at': bookmarks.savedAt,
      'is_favorite': bookmarks.isFavorite,
      'sort_order': bookmarks.sortOrder,
    }
    const sortColumn = sortColumnMap[sort as string] || bookmarks.createdAt
    const sortOrder = order === 'asc' ? asc : desc

    // Get total count
    let countResult: any[]
    if (tag) {
      const tagCondition = tag as string
      countResult = await db
        .select({ total: sql<number>`count(DISTINCT ${bookmarks.id})` })
        .from(bookmarks)
        .innerJoin(bookmarkTags, eq(bookmarks.id, bookmarkTags.bookmarkId))
        .innerJoin(tags, eq(bookmarkTags.tagId, tags.id))
        .where(and(...conditions, eq(tags.name, tagCondition), eq(tags.userId, currentUser.id)))
    } else {
      countResult = await db
        .select({ total: sql<number>`count(*)` })
        .from(bookmarks)
        .where(and(...conditions))
    }
    
    const total = countResult[0]?.total || 0

    // Get bookmarks with tags
    let rawBookmarks: any[]
    if (tag) {
      const tagCondition = tag as string
      rawBookmarks = await db
        .select({
          bookmark: {
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
          },
          tagName: tags.name,
          tagId: tags.id,
        })
        .from(bookmarks)
        .innerJoin(bookmarkTags, eq(bookmarks.id, bookmarkTags.bookmarkId))
        .innerJoin(tags, eq(bookmarkTags.tagId, tags.id))
        .where(and(...conditions, eq(tags.name, tagCondition)))
        .orderBy(sortOrder(sortColumn))
        .limit(limitNum)
        .offset(offset)
    } else {
      rawBookmarks = await db
        .select({
          bookmark: {
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
          },
          tagName: tags.name,
          tagId: tags.id,
        })
        .from(bookmarks)
        .leftJoin(bookmarkTags, eq(bookmarks.id, bookmarkTags.bookmarkId))
        .leftJoin(tags, eq(bookmarkTags.tagId, tags.id))
        .where(and(...conditions))
        .orderBy(sortOrder(sortColumn))
        .limit(limitNum)
        .offset(offset)
    }

    // Group by bookmark and aggregate tags
    const bookmarkMap = new Map<string, any>()
    for (const row of rawBookmarks) {
      const bookmarkId = row.bookmark.id
      if (!bookmarkMap.has(bookmarkId)) {
        bookmarkMap.set(bookmarkId, {
          ...row.bookmark,
          is_favorite: Boolean(row.bookmark.is_favorite),
          is_read: Boolean(row.bookmark.is_read),
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
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / limitNum),
      },
    }
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const {
      title,
      url,
      description,
      cleaned_markdown,
      original_html,
      reading_time_minutes,
      saved_at,
      is_favorite,
      sort_order,
      thumbnail_image_path,
      is_read,
      source_domain,
      word_count,
    } = body

    // Extract domain from URL if not provided
    let domain = source_domain
    if (!domain && url) {
      try {
        domain = new URL(url).hostname
      } catch {}
    }

    const now = new Date().toISOString()

    const newBookmark = {
      id: crypto.randomUUID(),
      userId: currentUser.id,
      title,
      url,
      description: description || null,
      cleanedMarkdown: cleaned_markdown || null,
      originalHtml: original_html || null,
      readingTimeMinutes: reading_time_minutes || null,
      savedAt: saved_at || now,
      lastAccessedAt: null,
      isFavorite: is_favorite ? 1 : 0,
      sortOrder: sort_order || null,
      thumbnailImagePath: thumbnail_image_path || null,
      isRead: is_read ? 1 : 0,
      readAt: is_read ? now : null,
      sourceDomain: domain || null,
      wordCount: word_count || null,
      createdAt: now,
      updatedAt: now,
    }

    const result = await db.insert(bookmarks).values(newBookmark).returning()

    return {
      success: true,
      bookmark: {
        ...result[0],
        is_favorite: Boolean(result[0].isFavorite),
        is_read: Boolean(result[0].isRead),
        tags: [],
        tag_ids: [],
      },
    }
  }

  throw createError({
    statusCode: 405,
    message: 'Method not allowed',
  })
})
