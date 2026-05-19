import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '~/server/database'
import { tags } from '~/server/database/schema'

// Case-insensitive equality for a tag name. Used everywhere we look up an
// existing tag by name so that "books" and "Books" resolve to the same row.
export const tagNameEquals = (name: string) =>
  sql`lower(${tags.name}) = lower(${name})`

// Resolve a list of free-form tag names to tag IDs (and canonical names) for a
// user. Existing tags match case-insensitively; missing ones are created using
// the user's casing.
//
// Returns ids/names in the same order as the input (after trim+dedup).
export async function resolveTagIds(
  userId: string,
  tagNames: string[] = [],
): Promise<{ ids: string[]; names: string[] }> {
  const trimmed = [...new Set(tagNames.map((n) => String(n).trim()).filter(Boolean))]
  if (trimmed.length === 0) return { ids: [], names: [] }

  const trimmedLower = trimmed.map((n) => n.toLowerCase())

  const existing = await db
    .select({
      id: tags.id,
      name: tags.name,
      nameLower: sql<string>`lower(${tags.name})`,
    })
    .from(tags)
    .where(and(eq(tags.userId, userId), inArray(sql`lower(${tags.name})`, trimmedLower)))

  const existingByLower = new Map(existing.map((t) => [t.nameLower, t]))

  const missing = trimmed.filter((n) => !existingByLower.has(n.toLowerCase()))
  if (missing.length > 0) {
    const inserted = await db
      .insert(tags)
      .values(
        missing.map((name) => ({
          id: crypto.randomUUID(),
          userId,
          name,
          parentTagId: null,
          color: null,
        })),
      )
      .returning({ id: tags.id, name: tags.name })

    for (const t of inserted) existingByLower.set(t.name.toLowerCase(), t)
  }

  const ids: string[] = []
  const names: string[] = []
  for (const n of trimmed) {
    const row = existingByLower.get(n.toLowerCase())
    if (row) {
      ids.push(row.id)
      names.push(row.name)
    }
  }
  return { ids, names }
}

// Resolve tag names for many items in a single DB round-trip. Pass the array
// of per-item tag-name lists; receive a function that maps any one of those
// lists back to its resolved { ids, names } — avoiding an N+1 query pattern in
// batch endpoints. Behavior per list matches resolveTagIds (trim + dedup,
// case-insensitive match, missing tags created with the user's casing).
export async function resolveTagIdsBatch(
  userId: string,
  tagNameLists: (string[] | undefined | null)[],
): Promise<(tagNames: string[] | undefined | null) => { ids: string[]; names: string[] }> {
  // Collect the union of all distinct (lowercased) names across the batch.
  const allLower = new Set<string>()
  for (const list of tagNameLists) {
    if (!Array.isArray(list)) continue
    for (const raw of list) {
      const trimmed = String(raw).trim()
      if (trimmed) allLower.add(trimmed.toLowerCase())
    }
  }

  const existingByLower = new Map<string, { id: string; name: string }>()

  if (allLower.size > 0) {
    const existing = await db
      .select({
        id: tags.id,
        name: tags.name,
        nameLower: sql<string>`lower(${tags.name})`,
      })
      .from(tags)
      .where(and(eq(tags.userId, userId), inArray(sql`lower(${tags.name})`, [...allLower])))

    for (const t of existing) existingByLower.set(t.nameLower, t)

    // Create any names not found. Use the first-seen casing for each missing
    // lowercased name across the whole batch.
    const firstCasingByLower = new Map<string, string>()
    for (const list of tagNameLists) {
      if (!Array.isArray(list)) continue
      for (const raw of list) {
        const trimmed = String(raw).trim()
        if (!trimmed) continue
        const lower = trimmed.toLowerCase()
        if (!existingByLower.has(lower) && !firstCasingByLower.has(lower)) {
          firstCasingByLower.set(lower, trimmed)
        }
      }
    }

    const missing = [...firstCasingByLower.values()]
    if (missing.length > 0) {
      const inserted = await db
        .insert(tags)
        .values(
          missing.map((name) => ({
            id: crypto.randomUUID(),
            userId,
            name,
            parentTagId: null,
            color: null,
          })),
        )
        .returning({ id: tags.id, name: tags.name })

      for (const t of inserted) existingByLower.set(t.name.toLowerCase(), t)
    }
  }

  return (tagNames: string[] | undefined | null) => {
    const trimmed = [
      ...new Set((Array.isArray(tagNames) ? tagNames : []).map((n) => String(n).trim()).filter(Boolean)),
    ]
    const ids: string[] = []
    const names: string[] = []
    for (const n of trimmed) {
      const row = existingByLower.get(n.toLowerCase())
      if (row) {
        ids.push(row.id)
        names.push(row.name)
      }
    }
    return { ids, names }
  }
}
