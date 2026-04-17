import { useIdb, type Note } from './idb'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CursorNoteFilters {
    tag?: string
    search?: string
    sort?: 'createdAt' | 'title' | 'updatedAt' | 'isFavorite'
    order?: 'asc' | 'desc'
    favorite?: boolean
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export function useOfflineNotes() {
    const idb = useIdb()
    const isOnline = ref<Boolean>(false)
    const offlineError = ref<string | null>(null)

    // Tracks whether a background refresh is already in flight so we never run
    // two simultaneous full-refresh cycles (was a bug in the original).
    let refreshInFlight = false
    // Timestamp of the last completed refresh – used for simple debouncing.
    let lastRefreshAt = 0
    const REFRESH_DEBOUNCE_MS = 30_000 // at most once per 30 s

    onMounted(() => {
        isOnline.value = navigator.onLine

        window.addEventListener('online', () => {
            console.log('[OfflineNotes] Back online')
            isOnline.value = true
            offlineError.value = null
            // Push any queued local changes now that we're back online.
            syncQueuedChanges()
        })

        window.addEventListener('offline', () => {
            console.log('[OfflineNotes] Gone offline')
            isOnline.value = false
        })
    })

    // -------------------------------------------------------------------------
    // Public: paginated read
    // -------------------------------------------------------------------------

    async function getNotesPaginated(
        cursor: string | null,
        options: CursorNoteFilters = {},
        limit = 20,
    ): Promise<{ notes: Note[]; nextCursor: string | null; hasMore: boolean }> {
        offlineError.value = null

        const {
            tag,
            search,
            sort = 'updatedAt',
            order = 'desc',
            favorite,
        } = options

        try {
            let notes = await idb.getAllNotes()

            if (favorite !== undefined)
                notes = notes.filter((n) => n.isFavorite === favorite)
            if (tag) notes = notes.filter((n) => n.tags.includes(tag))
            if (search) {
                const q = search.toLowerCase()
                notes = notes.filter(
                    (n) =>
                        n.content.toLowerCase().includes(q) ||
                        n.tags.some((t) => t.toLowerCase().includes(q)),
                )
            }

            notes.sort((a, b) => {
                let av = a[sort] as string | number | boolean
                let bv = b[sort] as string | number | boolean
                if (typeof av === 'boolean') av = av ? 1 : 0
                if (typeof bv === 'boolean') bv = bv ? 1 : 0
                return order === 'desc'
                    ? av < bv
                        ? 1
                        : av > bv
                          ? -1
                          : 0
                    : av > bv
                      ? 1
                      : av < bv
                        ? -1
                        : 0
            })

            let startIndex = 0
            if (cursor) {
                const idx = notes.findIndex((n) => n.id === cursor)
                if (idx !== -1) startIndex = idx + 1
            }

            const page = notes.slice(startIndex, startIndex + limit)
            const hasMore = startIndex + limit < notes.length
            const nextCursor =
                hasMore && page.length > 0 ? page[page.length - 1].id : null

            // Only trigger a background refresh on the *first* page of a fresh query
            // (cursor === null) and only if enough time has passed since the last one.
            if (isOnline.value && cursor === null) {
                maybeRefreshFromServer()
            }

            return { notes: page, nextCursor, hasMore }
        } catch (e: any) {
            console.error('[OfflineNotes] IndexedDB fetch failed:', e)
            offlineError.value = 'Failed to load notes'
            return { notes: [], nextCursor: null, hasMore: false }
        }
    }

    /** Backwards-compatible wrapper. */
    async function getNotes(
        options: {
            tag?: string
            sort?: 'createdAt' | 'title' | 'updatedAt' | 'isFavorite'
            order?: 'asc' | 'desc'
            limit?: number
        } = {},
    ): Promise<Note[]> {
        const result = await getNotesPaginated(
            null,
            options,
            options.limit ?? 20,
        )
        return result.notes
    }

    // -------------------------------------------------------------------------
    // Background server sync – pull then push
    // -------------------------------------------------------------------------

    /** Debounced gate: skips if another refresh is running or ran recently. */
    function maybeRefreshFromServer() {
        const now = Date.now()
        if (refreshInFlight || now - lastRefreshAt < REFRESH_DEBOUNCE_MS) return
        refreshFromServer()
    }

    async function refreshFromServer(): Promise<void> {
        if (!isOnline.value || refreshInFlight) return
        refreshInFlight = true

        try {
            console.log('[OfflineNotes] Background sync started')

            // --- Pull: fetch server notes ---
            const response = await $fetch<{ notes: any[] }>(
                '/api/notes?limit=1000',
            )
            const serverNotes: Note[] = (response.notes ?? []).map((n) => ({
                id: n.id,
                content: n.content,
                tags: n.tags ?? [],
                isFavorite: n.isFavorite,
                createdAt: n.createdAt,
                updatedAt: n.updatedAt,
                deletedAt: n.deletedAt ?? null,
            }))

            const serverMap = new Map(serverNotes.map((n) => [String(n.id), n]))

            // Get local snapshot *before* writing server data so we can diff fairly.
            const localNotes: Note[] = await idb.getAllNotes()
            const localMap = new Map(localNotes.map((n) => [String(n.id), n]))

            // Merge strategy: server wins only when its updatedAt is strictly newer.
            const toSaveLocally: Note[] = []
            for (const server of serverNotes) {
                const local = localMap.get(String(server.id))
                if (
                    !local ||
                    new Date(server.updatedAt) > new Date(local.updatedAt)
                ) {
                    toSaveLocally.push(server)
                }
            }
            if (toSaveLocally.length) await idb.saveNotes(toSaveLocally)

            // --- Push: upload local notes that are newer than the server version ---
            const toUpload: Note[] = []
            for (const local of localNotes) {
                if (!local.id) {
                    // Orphan with no id – always needs to be created on the server.
                    toUpload.push(local)
                    continue
                }
                const server = serverMap.get(String(local.id))
                if (!server) {
                    // Not on server at all – needs creating.
                    toUpload.push(local)
                } else if (
                    new Date(local.updatedAt) > new Date(server.updatedAt)
                ) {
                    // Local is genuinely newer – push the update.
                    toUpload.push(local)
                }
            }

            if (toUpload.length) {
                console.log(
                    '[OfflineNotes] Pushing',
                    toUpload.length,
                    'notes to server',
                )
                await Promise.allSettled(toUpload.map((note) => pushNote(note)))
            } else {
                console.log('[OfflineNotes] Nothing to push')
            }

            lastRefreshAt = Date.now()
            console.log('[OfflineNotes] Background sync complete')
        } catch (e: any) {
            console.warn('[OfflineNotes] Background sync failed:', e.message)
        } finally {
            refreshInFlight = false
        }
    }

    /**
     * Push a single note to the server.
     * - Uses POST when the note has no server-side id (new note).
     * - Uses PUT when the note already has an id.
     * Saves the canonical server response back to IDB so IDs stay consistent.
     */
    async function pushNote(note: Note): Promise<void> {
        const body = {
            content: note.content,
            tags: note.tags,
            isFavorite: note.isFavorite,
            createdAt: note.createdAt,
            updatedAt: note.updatedAt,
        }

        const isNew = !note.id
        const url = isNew
            ? '/api/notes'
            : `/api/notes/${encodeURIComponent(note.id)}`
        const method = isNew ? 'POST' : 'PUT'

        try {
            const saved = await $fetch<any>(url, { method, body })
            if (!saved) return

            const canonical: Note = {
                id: saved.id ?? note.id,
                content: saved.content ?? note.content,
                tags: saved.tags ?? note.tags ?? [],
                isFavorite: saved.isFavorite ?? note.isFavorite,
                createdAt: saved.createdAt ?? note.createdAt,
                updatedAt: saved.updatedAt ?? note.updatedAt,
                deletedAt: saved.deletedAt ?? null,
            }

            // If the server issued a new id (new note), retire the temp local id.
            if (isNew && note.id && canonical.id !== note.id) {
                await idb.deleteNote(note.id)
            }

            await idb.saveNote(canonical)
        } catch (err: any) {
            console.warn(
                '[OfflineNotes] Failed to push note',
                note.id ?? '(new)',
                err?.message ?? err,
            )
            // Re-throw so Promise.allSettled can report it; we don't want to swallow
            // errors silently here because callers may queue for retry.
            throw err
        }
    }

    // -------------------------------------------------------------------------
    // Sync queue drain (called when coming back online)
    // -------------------------------------------------------------------------

    async function syncQueuedChanges(): Promise<void> {
        try {
            const queue = await idb.getSyncQueue?.()
            if (!queue || queue.length === 0) return

            console.log(
                '[OfflineNotes] Draining sync queue:',
                queue.length,
                'items',
            )

            for (const item of queue) {
                try {
                    if (item.action === 'create') {
                        const note = await idb.getNote(item.id)
                        if (note) await pushNote(note)
                    } else if (item.action === 'update') {
                        const note = await idb.getNote(item.id)
                        if (note) await pushNote(note)
                    } else if (item.action === 'delete') {
                        await $fetch(
                            `/api/notes/${encodeURIComponent(item.id)}`,
                            { method: 'DELETE' },
                        )
                    }
                    await idb.removeSyncQueueItem?.(item.id)
                } catch (e: any) {
                    console.warn(
                        '[OfflineNotes] Queue item failed, will retry later:',
                        item.id,
                        e?.message,
                    )

                    if(idb.getSyncQueueItem(item.id)?.retries >= 3) {
                        console.error(
                            '[OfflineNotes] Queue item has failed 3 times, giving up:',
                            item.id,
                        )
                        await idb.removeSyncQueueItem?.(item.id)
                    }
                }
            }
        } catch (e: any) {
            console.warn(
                '[OfflineNotes] Failed to drain sync queue:',
                e?.message,
            )
        }
    }

    // -------------------------------------------------------------------------
    // Public: single note
    // -------------------------------------------------------------------------

    async function getNoteById(id: string): Promise<Note | null> {
        offlineError.value = null

        try {
            const cached = await idb.getNote(id)
            if (cached) {
                if (isOnline.value) refreshSingleNoteFromServer(id)
                return cached
            }
        } catch (e: any) {
            console.warn('[OfflineNotes] IDB lookup failed:', e.message)
        }

        if (!isOnline.value) return null

        try {
            const response = await $fetch<any>(`/api/notes/${id}`)
            const note: Note = {
                id: response.id,
                content: response.content,
                tags: response.tags ?? [],
                isFavorite: response.isFavorite,
                createdAt: response.createdAt,
                updatedAt: response.updatedAt,
                deletedAt: response.deletedAt ?? null,
            }
            await idb.saveNote(note)
            return note
        } catch (e: any) {
            console.warn('[OfflineNotes] Server fetch failed:', e.message)
            return null
        }
    }

    async function refreshSingleNoteFromServer(id: string): Promise<void> {
        if (!isOnline.value) return
        try {
            const [response, local] = await Promise.all([
                $fetch<any>(`/api/notes/${id}`),
                idb.getNote(id),
            ])

            // Never overwrite a locally-newer note.
            if (
                local &&
                new Date(local.updatedAt) >= new Date(response.updatedAt)
            )
                return

            await idb.saveNote({
                id: response.id,
                content: response.content,
                tags: response.tags ?? [],
                isFavorite: response.isFavorite,
                createdAt: response.createdAt,
                updatedAt: response.updatedAt,
                deletedAt: null,
            })
        } catch {
            // Silent – we already have the cached version.
        }
    }

    // -------------------------------------------------------------------------
    // Public: mutations
    // -------------------------------------------------------------------------

    async function createNote(data: {
        content: string
        tags?: string[]
        isFavorite?: boolean
    }): Promise<Note | null> {
        const id = crypto.randomUUID()
        const now = new Date().toISOString()

        const note: Note = {
            id,
            content: data.content,
            tags: data.tags?.value ?? [],
            isFavorite: data.isFavorite ?? false,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
        }

        try {
            await idb.saveNote(note)

            if (isOnline.value) {
                try {
                    await pushNote(note)
                } catch {
                    await enqueueSync('create', id, {
                        content: note.content,
                        tags: note.tags,
                        isFavorite: note.isFavorite,
                    })
                }
            } else {
                await enqueueSync('create', id, {
                    content: note.content,
                    tags: note.tags,
                    isFavorite: note.isFavorite,
                })
            }

            return note
        } catch (e: any) {
            console.error('[OfflineNotes] Failed to create note:', e)
            return null
        }
    }

    async function updateNote(
        id: string,
        data: { content?: string; tags?: string[]; isFavorite?: boolean },
    ): Promise<boolean> {
        try {
            const current = await idb.getNote(id)
            if (!current) {
                console.error('[OfflineNotes] Note not found for update:', id)
                return false
            }

            const updated: Note = {
                ...current,
                content: data.content ?? current.content,
                tags: data.tags ?? current.tags,
                isFavorite: data.isFavorite ?? current.isFavorite,
                updatedAt: new Date().toISOString(),
            }

            await idb.saveNote(updated)

            if (isOnline.value) {
                try {
                    await pushNote(updated)
                } catch {
                    await enqueueSync('update', id, {
                        content: updated.content,
                        tags: updated.tags,
                        isFavorite: updated.isFavorite,
                    })
                }
            } else {
                await enqueueSync('update', id, {
                    content: updated.content,
                    tags: updated.tags,
                    isFavorite: updated.isFavorite,
                })
            }

            return true
        } catch (e: any) {
            console.error('[OfflineNotes] Failed to update note:', e)
            return false
        }
    }

    async function deleteNote(id: string): Promise<boolean> {
        try {
            await idb.deleteNote(id)

            if (isOnline.value) {
                try {
                    await $fetch(`/api/notes/${id}`, { method: 'DELETE' })
                } catch {
                    await enqueueSync('delete', id, { id })
                }
            } else {
                await enqueueSync('delete', id, { id })
            }

            return true
        } catch (e: any) {
            console.error('[OfflineNotes] Failed to delete note:', e)
            return false
        }
    }

    async function searchNotes(query: string): Promise<Note[]> {
        try {
            return await idb.searchNotes(query)
        } catch (e: any) {
            console.error('[OfflineNotes] Search failed:', e)
            return []
        }
    }

    async function toggleFavorite(id: string): Promise<boolean> {
        const note = await idb.getNote(id)
        if (!note) return false
        return updateNote(id, { isFavorite: !note.isFavorite })
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    async function enqueueSync(
        action: 'create' | 'update' | 'delete',
        id: string,
        data: unknown,
    ) {
        await idb.addToSyncQueue({
            id,
            action,
            entity: 'note',
            data,
            timestamp: Date.now(),
        })
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    return {
        isOnline,
        offlineError,
        getNotes,
        getNotesPaginated,
        getNoteById,
        createNote,
        updateNote,
        deleteNote,
        searchNotes,
        toggleFavorite,
    }
}
