import { db } from '~/server/database'
import { notes, notesTags, tags } from '~/server/database/schema'
import { eq, desc, sql, and, isNull, inArray, notExists, gt } from 'drizzle-orm'
import { getQuery } from 'h3'
import { requireAuth } from '~/server/utils/auth'
import { resolveTagIds, tagNameEquals } from '~/server/utils/tags'

async function fetchTagsForNotes(noteIds: string[]): Promise<Map<string, string[]>> {
  if (noteIds.length === 0) return new Map()

  const tagRecords = await db
    .select({ noteId: notesTags.noteId, tagName: tags.name })
    .from(notesTags)
    .innerJoin(tags, eq(notesTags.tagId, tags.id))
    .where(inArray(notesTags.noteId, noteIds))

  const tagMap = new Map<string, string[]>()
  for (const record of tagRecords) {
    if (!tagMap.has(record.noteId)) tagMap.set(record.noteId, [])
    tagMap.get(record.noteId)!.push(record.tagName)
  }
  return tagMap
}

// Maximum length of a note's content.
const MAX_NOTE_CONTENT_LENGTH = 1_000_000

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuth(event)
  const method = event.method

  if (method === 'GET') {
    const query = getQuery(event)
    const {
      page = '1',
      limit = '20',
      sort = 'updatedAt',
      tag,
      untagged,
      favorite,
      includeDeleted,
      since,
    } = query

    const pageNum = parseInt(page as string)
    const limitNum = parseInt(limit as string)
    const offset = (pageNum - 1) * limitNum

    const validSorts = ['createdAt', 'updatedAt', 'isFavorite'] as const
    const sortColumn = validSorts.includes(sort as any) ? (sort as (typeof validSorts)[number]) : 'updatedAt'

    const baseConditions = [eq(notes.userId, currentUser.id)]
    if (includeDeleted !== 'true') baseConditions.push(isNull(notes.deletedAt))
    if (favorite === 'true') baseConditions.push(eq(notes.isFavorite, 1))

    // Incremental sync: when `since` is supplied, only return rows changed
    // after that timestamp. Soft-deleted tombstones in the window are still
    // included so deletions propagate to clients.
    if (since) {
      const sinceStr = String(since)
      if (Number.isNaN(Date.parse(sinceStr))) {
        throw createError({ statusCode: 400, message: 'Invalid `since` timestamp' })
      }
      baseConditions.push(gt(notes.updatedAt, sinceStr))
    }

    let fetchedNotes: typeof notes.$inferSelect[]
    let total: number

    if (untagged === 'true') {
      const untaggedCondition = notExists(
        db.select({ one: sql`1` })
          .from(notesTags)
          .where(eq(notesTags.noteId, notes.id))
      )

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(notes)
        .where(and(...baseConditions, untaggedCondition))
      total = Number(countResult[0]?.count ?? 0)

      fetchedNotes = await db
        .select()
        .from(notes)
        .where(and(...baseConditions, untaggedCondition))
        .orderBy(desc(notes[sortColumn]))
        .limit(limitNum)
        .offset(offset)
    } else if (tag) {
      const [tagRecord] = await db
        .select({ id: tags.id })
        .from(tags)
        .where(and(tagNameEquals(tag as string), eq(tags.userId, currentUser.id)))
        .limit(1)

      if (!tagRecord) {
        return { notes: [], pagination: { page: pageNum, limit: limitNum, total: 0, totalPages: 0 } }
      }

      const noteTagRecords = await db
        .select({ noteId: notesTags.noteId })
        .from(notesTags)
        .where(eq(notesTags.tagId, tagRecord.id))

      const noteIds = noteTagRecords.map(nt => nt.noteId)

      if (noteIds.length === 0) {
        return { notes: [], pagination: { page: pageNum, limit: limitNum, total: 0, totalPages: 0 } }
      }

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(notes)
        .where(and(...baseConditions, inArray(notes.id, noteIds)))
      total = Number(countResult[0]?.count ?? 0)

      fetchedNotes = await db
        .select()
        .from(notes)
        .where(and(...baseConditions, inArray(notes.id, noteIds)))
        .orderBy(desc(notes[sortColumn]))
        .limit(limitNum)
        .offset(offset)
    } else {
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(notes)
        .where(and(...baseConditions))
      total = Number(countResult[0]?.count ?? 0)

      fetchedNotes = await db
        .select()
        .from(notes)
        .where(and(...baseConditions))
        .orderBy(desc(notes[sortColumn]))
        .limit(limitNum)
        .offset(offset)
    }

    const noteIds = fetchedNotes.map(n => n.id)
    const tagMap = await fetchTagsForNotes(noteIds)

    const notesWithTags = fetchedNotes.map(n => ({
      ...n,
      isFavorite: Boolean(n.isFavorite),
      tags: tagMap.get(n.id) || [],
    }))

    return {
      notes: notesWithTags,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    }
  }

  if (method === 'POST') {
    const body = await readBody(event)
    const { content, isFavorite, tags: tagNames } = body

    if (typeof content !== 'string') {
      throw createError({ statusCode: 400, message: 'Content is required' })
    }
    if (content.length > MAX_NOTE_CONTENT_LENGTH) {
      throw createError({ statusCode: 413, message: `content exceeds ${MAX_NOTE_CONTENT_LENGTH} characters` })
    }

    const tagsArray: string[] = Array.isArray(tagNames) ? tagNames : []
    const { ids: tagIds, names: canonicalTagNames } = await resolveTagIds(currentUser.id, tagsArray)

    const [note] = await db
      .insert(notes)
      .values({ id: crypto.randomUUID(), userId: currentUser.id, content, isFavorite: isFavorite ? 1 : 0 })
      .returning()

    if (!note) {
      throw createError({ statusCode: 500, message: 'Failed to create note' })
    }

    for (const tagId of tagIds) {
      await db.insert(notesTags).values({ id: crypto.randomUUID(), noteId: note.id, tagId }).onConflictDoNothing()
    }

    return { ...note, isFavorite: Boolean(note.isFavorite), tags: canonicalTagNames }
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' })
})
