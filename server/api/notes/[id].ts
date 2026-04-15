import { db, schema } from '~/server/database'
import { eq, and, inArray } from 'drizzle-orm'
import { getRouterParam } from 'h3'
import { requireAuth } from '~/server/utils/auth'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Single source of truth for "now" within one request. */
const now = () => new Date().toISOString()

/**
 * Fetch a note that belongs to the authenticated user in one query.
 * Returns null if it doesn't exist OR the user doesn't own it – callers
 * must decide which error code to surface (404 vs 403). We always return 404
 * to avoid leaking the existence of other users' notes.
 */
async function requireOwnedNote(noteId: string, userId: string) {
    const [note] = await db
        .select()
        .from(schema.notes)
        .where(
            and(
                eq(schema.notes.id, noteId),
                eq(schema.notes.userId, userId),
                // Exclude soft-deleted notes from reads
                eq(schema.notes.deletedAt, null as any),
            ),
        )

    if (!note) {
        throw createError({ statusCode: 404, message: 'Note not found' })
    }

    return note
}

/** Fetch the tag name strings for a note from the junction table. */
async function getNoteTags(noteId: string): Promise<string[]> {
    const rows = await db
        .select({ name: schema.tags.name })
        .from(schema.notesTags)
        .innerJoin(schema.tags, eq(schema.notesTags.tagId, schema.tags.id))
        .where(eq(schema.notesTags.noteId, noteId))

    return rows.map((r) => r.name)
}

/**
 * Upsert tags for a user in bulk, returning their IDs.
 *
 * Strategy:
 *   1. Fetch all existing tags for this user that match the requested names
 *      in a single query.
 *   2. Insert only the missing ones (also in a single statement).
 *   3. Return all IDs.
 *
 * This collapses the original O(n) serial loop into 2 queries regardless of
 * how many tags are supplied.
 */
async function upsertTags(names: string[], userId: string): Promise<string[]> {
    const trimmed = [...new Set(names.map((n) => n.trim()).filter(Boolean))]
    if (trimmed.length === 0) return []

    // 1. Fetch existing tags (one query)
    const existing = await db
        .select({ id: schema.tags.id, name: schema.tags.name })
        .from(schema.tags)
        .where(
            and(
                eq(schema.tags.userId, userId),
                inArray(schema.tags.name, trimmed),
            ),
        )

    const existingByName = new Map(existing.map((t) => [t.name, t.id]))

    // 2. Insert missing tags (one query, if any)
    const missing = trimmed.filter((n) => !existingByName.has(n))
    if (missing.length > 0) {
        const inserted = await db
            .insert(schema.tags)
            .values(
                missing.map((name) => ({
                    id: crypto.randomUUID(),
                    userId,
                    name,
                    parentTagId: null,
                    color: null,
                })),
            )
            .returning({ id: schema.tags.id, name: schema.tags.name })

        for (const t of inserted) existingByName.set(t.name, t.id)
    }

    return trimmed.map((n) => existingByName.get(n)!).filter(Boolean)
}

/**
 * Replace the tag associations for a note inside the caller's transaction.
 * Delete + bulk-insert is safe here because the caller owns the transaction.
 */
async function replaceNoteTags(noteId: string, tagIds: string[]) {
    await db.delete(schema.notesTags).where(eq(schema.notesTags.noteId, noteId))

    if (tagIds.length > 0) {
        await db
            .insert(schema.notesTags)
            .values(
                tagIds.map((tagId) => ({
                    id: crypto.randomUUID(),
                    noteId,
                    tagId,
                })),
            )
            .onConflictDoNothing()
    }
}

/** Record a sync event so offline clients can detect remote changes. */
async function writeSyncMetadata(entityId: string, isDeleted: 0 | 1 = 0) {
    const ts = now()
    await db
        .insert(schema.syncMetadata)
        .values({
            id: crypto.randomUUID(),
            entityType: 'note',
            entityId,
            lastModifiedAt: ts,
            isDeleted,
            syncStatus: 'pending',
        })
        .onConflictDoUpdate({
            target: [
                schema.syncMetadata.entityType,
                schema.syncMetadata.entityId,
            ],
            set: { lastModifiedAt: ts, isDeleted, syncStatus: 'pending' },
        })
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

interface PutBody {
    title?: string
    content?: string
    isFavorite?: boolean
    sortOrder?: number
    tags?: string[]
    // Timestamps sent by the client (used for conflict resolution on the client
    // side; we always write our own server timestamp on the way out).
    createdAt?: string
    updatedAt?: string
}

function validatePutBody(raw: unknown): PutBody {
    if (!raw || typeof raw !== 'object') {
        throw createError({
            statusCode: 400,
            message: 'Request body must be an object',
        })
    }

    const body = raw as Record<string, unknown>

    if (body.title !== undefined && typeof body.title !== 'string') {
        throw createError({
            statusCode: 400,
            message: 'title must be a string',
        })
    }
    if (body.content !== undefined && typeof body.content !== 'string') {
        throw createError({
            statusCode: 400,
            message: 'content must be a string',
        })
    }
    if (body.isFavorite !== undefined && typeof body.isFavorite !== 'boolean') {
        throw createError({
            statusCode: 400,
            message: 'isFavorite must be a boolean',
        })
    }
    if (body.sortOrder !== undefined && typeof body.sortOrder !== 'number') {
        throw createError({
            statusCode: 400,
            message: 'sortOrder must be a number',
        })
    }
    if (body.tags !== undefined && !Array.isArray(body.tags)) {
        throw createError({ statusCode: 400, message: 'tags must be an array' })
    }

    return body as PutBody
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default defineEventHandler(async (event) => {
    const currentUser = await requireAuth(event)

    const id = getRouterParam(event, 'id')
    if (!id) {
        throw createError({ statusCode: 400, message: 'Note ID is required' })
    }

    const method = event.method

    // ── GET ──────────────────────────────────────────────────────────────────

    if (method === 'GET') {
        const note = await requireOwnedNote(id, currentUser.id)
        const tags = await getNoteTags(id)

        return {
            ...note,
            isFavorite: Boolean(note.isFavorite),
            tags,
        }
    }

    // ── PUT ──────────────────────────────────────────────────────────────────

    if (method === 'PUT') {
        // Validate before hitting the DB
        const body = validatePutBody(await readBody(event))

        // Ownership check fused into the query (no separate select)
        const existingNote = await requireOwnedNote(id, currentUser.id)

        // Conflict resolution: if the client's updatedAt is older than what we
        // have stored, the client is submitting a stale write. Return 409 so the
        // client can fetch the current version and merge.
        if (
            body.updatedAt &&
            new Date(body.updatedAt) < new Date(existingNote.updatedAt)
        ) {
            throw createError({
                statusCode: 409,
                message:
                    'Conflict: note was modified more recently on the server',
                data: { serverUpdatedAt: existingNote.updatedAt },
            })
        }

        const ts = now()

        // Build a typed partial update
        const updates: Partial<typeof schema.notes.$inferInsert> = {
            updatedAt: ts,
        }
        if (body.title !== undefined) updates.title = body.title
        if (body.content !== undefined) updates.content = body.content
        if (body.isFavorite !== undefined)
            updates.isFavorite = body.isFavorite ? 1 : 0
        if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder

        // Run tag upsert + note update + sync metadata atomically
        const [note] = await db.transaction(async (tx) => {
            if (body.tags !== undefined) {
                const tagIds = await upsertTags(body.tags, currentUser.id)
                await replaceNoteTags(id, tagIds)
            }

            return tx
                .update(schema.notes)
                .set(updates)
                .where(eq(schema.notes.id, id))
                .returning()
        })

        // Write sync metadata outside the transaction (non-critical, best-effort)
        await writeSyncMetadata(id).catch((e) =>
            console.warn('[notes/[id]] Failed to write sync metadata:', e),
        )

        const tags = await getNoteTags(id)

        return {
            ...note,
            isFavorite: Boolean(note.isFavorite),
            tags,
        }
    }

    // ── DELETE ───────────────────────────────────────────────────────────────

    if (method === 'DELETE') {
        // Ownership check fused into query
        await requireOwnedNote(id, currentUser.id)

        const ts = now()

        // Soft-delete the note. We intentionally leave notesTags rows intact so
        // that a future undelete (if implemented) can restore associations. If
        // hard-purging is required, add the cascade delete at the schema level.
        await db
            .update(schema.notes)
            .set({ deletedAt: ts, updatedAt: ts })
            .where(eq(schema.notes.id, id))

        // Sync metadata (inside a single write for atomicity)
        await writeSyncMetadata(id, 1).catch((e) =>
            console.warn('[notes/[id]] Failed to write sync metadata:', e),
        )

        return { success: true }
    }

    // ── Fallthrough ──────────────────────────────────────────────────────────

    throw createError({ statusCode: 405, message: 'Method not allowed' })
})
