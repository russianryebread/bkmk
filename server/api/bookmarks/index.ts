import { db } from '~/server/database'
import { bookmarks, bookmarkTags, tags } from '~/server/database/schema'
import { eq, desc, asc, sql, and, isNull } from 'drizzle-orm'
import { getQuery } from 'h3'
import { requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
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

    const baseConditions: any[] = [eq(bookmarks.userId, currentUser.id), isNull(bookmarks.deletedAt)]

    if (favorite === 'true') baseConditions.push(eq(bookmarks.isFavorite, 1))
    if (unread === 'true') baseConditions.push(eq(bookmarks.isRead, 0))
    if (domain) baseConditions.push(eq(bookmarks.sourceDomain, domain as string))

    const sortColumnMap: Record<string, any> = {
      'created_at': bookmarks.createdAt,
      'title': bookmarks.title,
      'saved_at': bookmarks.savedAt,
      'is_favorite': bookmarks.isFavorite,
      'sort_order': bookmarks.sortOrder,
    }
    const sortColumn = sortColumnMap[sort as string] || bookmarks.createdAt
    const sortOrder = order === 'asc' ? asc : desc

    // COUNT
    let countResult: any[]
    if (tag) {
      const tagCondition = tag as string
      countResult = await db
        .select({ total: sql<number>`count(DISTINCT ${bookmarks.id})` })
        .from(bookmarks)
        .innerJoin(bookmarkTags, eq(bookmarks.id, bookmarkTags.bookmarkId))
        .innerJoin(tags, and(eq(bookmarkTags.tagId, tags.id), eq(tags.userId, currentUser.id)))
        .where(and(...baseConditions, eq(tags.name, tagCondition)))
    } else {
      countResult = await db
        .select({ total: sql<number>`count(DISTINCT ${bookmarks.id})` })
        .from(bookmarks)
        .leftJoin(bookmarkTags, eq(bookmarks.id, bookmarkTags.bookmarkId))
        .leftJoin(tags, and(eq(bookmarkTags.tagId, tags.id), eq(tags.userId, currentUser.id)))
        .where(and(...baseConditions))
    }
    const total = countResult[0]?.total || 0

    // SELECT
    let rawBookmarks: any[]
    const selectShape = {
      bookmark: {
        id: bookmarks.id,
        title: bookmarks.title,
        url: bookmarks.url,
        description: bookmarks.description,
        cleanedMarkdown: bookmarks.cleanedMarkdown,
        originalHtml: bookmarks.originalHtml,
        readingTimeMinutes: bookmarks.readingTimeMinutes,
        savedAt: bookmarks.savedAt,
        lastAccessedAt: bookmarks.lastAccessedAt,
        isFavorite: bookmarks.isFavorite,
        sortOrder: bookmarks.sortOrder,
        thumbnailImagePath: bookmarks.thumbnailImagePath,
        isRead: bookmarks.isRead,
        readAt: bookmarks.readAt,
        sourceDomain: bookmarks.sourceDomain,
        wordCount: bookmarks.wordCount,
        createdAt: bookmarks.createdAt,
        updatedAt: bookmarks.updatedAt,
      },
      tagName: tags.name,
    }

    if (tag) {
      const tagCondition = tag as string
      rawBookmarks = await db
        .select(selectShape)
        .from(bookmarks)
        .innerJoin(bookmarkTags, eq(bookmarks.id, bookmarkTags.bookmarkId))
        .innerJoin(tags, and(eq(bookmarkTags.tagId, tags.id), eq(tags.userId, currentUser.id)))
        .where(and(...baseConditions, eq(tags.name, tagCondition)))
        .orderBy(sortOrder(sortColumn))
        .limit(limitNum)
        .offset(offset)
    } else {
      rawBookmarks = await db
        .select(selectShape)
        .from(bookmarks)
        .leftJoin(bookmarkTags, eq(bookmarks.id, bookmarkTags.bookmarkId))
        .leftJoin(tags, and(eq(bookmarkTags.tagId, tags.id), eq(tags.userId, currentUser.id)))
        .where(and(...baseConditions))
        .orderBy(sortOrder(sortColumn))
        .limit(limitNum)
        .offset(offset)
    }

    const bookmarkMap = new Map<string, any>()
    for (const row of rawBookmarks) {
      const bm = row.bookmark
      const bookmarkId = bm.id
      if (!bookmarkMap.has(bookmarkId)) {
        bookmarkMap.set(bookmarkId, {
          id: bm.id,
          title: bm.title,
          url: bm.url,
          description: bm.description,
          cleanedMarkdown: bm.cleanedMarkdown,
          originalHtml: bm.originalHtml,
          readingTimeMinutes: bm.readingTimeMinutes,
          savedAt: bm.savedAt,
          lastAccessedAt: bm.lastAccessedAt,
          isFavorite: Boolean(bm.isFavorite),
          sortOrder: bm.sortOrder,
          thumbnailImagePath: bm.thumbnailImagePath,
          isRead: Boolean(bm.isRead),
          readAt: bm.readAt,
          sourceDomain: bm.sourceDomain,
          wordCount: bm.wordCount,
          createdAt: bm.createdAt,
          updatedAt: bm.updatedAt,
          tags: [] as string[],
        })
      }
      if (row.tagName) {
        const item = bookmarkMap.get(bookmarkId)
        if (!item.tags.includes(row.tagName)) item.tags.push(row.tagName)
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
    const { url, sourceDomain } = body

    let domain = sourceDomain
    if (!domain && url) {
      try {
        domain = new URL(url).hostname
      } catch {}
    }

    const now = new Date().toISOString()

    const newBookmark = {
      ...body,
      id: crypto.randomUUID(),
      userId: currentUser.id,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }

    const result = await db.insert(bookmarks).values(newBookmark).returning()
    const inserted = result[0]

    return {
      success: true,
      bookmark: inserted,
    }
  }

  throw createError({
    statusCode: 405,
    message: 'Method not allowed',
  })
})
