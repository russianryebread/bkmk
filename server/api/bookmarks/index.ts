import { db } from '~/server/database'
import { bookmarks, bookmarkTags, tags } from '~/server/database/schema'
import { eq, desc, asc, sql, and, isNull, notExists } from 'drizzle-orm'
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
      sort = 'saved_at',
      order = 'desc',
      favorite,
      tag,
      domain,
      unread,
      untagged,
      search,
      includeDeleted,
    } = query

    const pageNum = parseInt(page as string)
    const limitNum = parseInt(limit as string)
    const offset = (pageNum - 1) * limitNum

    const baseConditions: any[] = [eq(bookmarks.userId, currentUser.id)]
    if (includeDeleted !== 'true') baseConditions.push(isNull(bookmarks.deletedAt))

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
    const sortColumn = sortColumnMap[sort as string] || bookmarks.savedAt
    const sortOrder = order === 'asc' ? asc : desc

    const selectShape = {
      bookmark: {
        id: bookmarks.id,
        title: bookmarks.title,
        url: bookmarks.url,
        description: bookmarks.description,
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
        deletedAt: bookmarks.deletedAt,
      },
      tagName: tags.name,
    }

    // Untagged: bookmarks with no bookmark_tags entries
    if (untagged === 'true') {
      const untaggedCondition = notExists(
        db.select({ one: sql`1` })
          .from(bookmarkTags)
          .where(eq(bookmarkTags.bookmarkId, bookmarks.id))
      )

      const [countResult] = await db
        .select({ total: sql<number>`count(*)` })
        .from(bookmarks)
        .where(and(...baseConditions, untaggedCondition))

      const rawBookmarks = await db
        .select(selectShape)
        .from(bookmarks)
        .leftJoin(bookmarkTags, eq(bookmarks.id, bookmarkTags.bookmarkId))
        .leftJoin(tags, and(eq(bookmarkTags.tagId, tags.id), eq(tags.userId, currentUser.id)))
        .where(and(...baseConditions, untaggedCondition))
        .orderBy(sortOrder(sortColumn))
        .limit(limitNum)
        .offset(offset)

      const bookmarkMap = buildBookmarkMap(rawBookmarks)
      return {
        bookmarks: Array.from(bookmarkMap.values()),
        pagination: buildPagination(pageNum, limitNum, countResult.total),
      }
    }

    // Filter by tag name
    if (tag) {
      const tagName = tag as string

      const [countResult] = await db
        .select({ total: sql<number>`count(DISTINCT ${bookmarks.id})` })
        .from(bookmarks)
        .innerJoin(bookmarkTags, eq(bookmarks.id, bookmarkTags.bookmarkId))
        .innerJoin(tags, and(eq(bookmarkTags.tagId, tags.id), eq(tags.userId, currentUser.id)))
        .where(and(...baseConditions, eq(tags.name, tagName)))

      const rawBookmarks = await db
        .select(selectShape)
        .from(bookmarks)
        .innerJoin(bookmarkTags, eq(bookmarks.id, bookmarkTags.bookmarkId))
        .innerJoin(tags, and(eq(bookmarkTags.tagId, tags.id), eq(tags.userId, currentUser.id)))
        .where(and(...baseConditions, eq(tags.name, tagName)))
        .orderBy(sortOrder(sortColumn))
        .limit(limitNum)
        .offset(offset)

      const bookmarkMap = buildBookmarkMap(rawBookmarks)
      return {
        bookmarks: Array.from(bookmarkMap.values()),
        pagination: buildPagination(pageNum, limitNum, countResult.total),
      }
    }

    // All bookmarks (with tags loaded)
    const [countResult] = await db
      .select({ total: sql<number>`count(DISTINCT ${bookmarks.id})` })
      .from(bookmarks)
      .where(and(...baseConditions))

    const rawBookmarks = await db
      .select(selectShape)
      .from(bookmarks)
      .leftJoin(bookmarkTags, eq(bookmarks.id, bookmarkTags.bookmarkId))
      .leftJoin(tags, and(eq(bookmarkTags.tagId, tags.id), eq(tags.userId, currentUser.id)))
      .where(and(...baseConditions))
      .orderBy(sortOrder(sortColumn))
      .limit(limitNum)
      .offset(offset)

    const bookmarkMap = buildBookmarkMap(rawBookmarks)
    return {
      bookmarks: Array.from(bookmarkMap.values()),
      pagination: buildPagination(pageNum, limitNum, countResult.total),
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
      sourceDomain: domain,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }

    const [inserted] = await db.insert(bookmarks).values(newBookmark).returning()
    return { success: true, bookmark: inserted }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})

function buildBookmarkMap(rawBookmarks: any[]) {
  const map = new Map<string, any>()
  for (const row of rawBookmarks) {
    const bm = row.bookmark
    if (!map.has(bm.id)) {
      map.set(bm.id, {
        ...bm,
        isFavorite: Boolean(bm.isFavorite),
        isRead: Boolean(bm.isRead),
        tags: [] as string[],
      })
    }
    if (row.tagName) {
      const item = map.get(bm.id)!
      if (!item.tags.includes(row.tagName)) item.tags.push(row.tagName)
    }
  }
  return map
}

function buildPagination(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total: Number(total),
    totalPages: Math.ceil(Number(total) / limit),
  }
}
