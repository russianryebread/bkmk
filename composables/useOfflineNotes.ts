import { useIdb, type Note } from './idb'

// Helper to convert refs to plain objects for IndexedDB storage
function toPlainObject(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') return obj
  if (Array.isArray(obj)) return obj.map(toPlainObject)
  if (typeof obj === 'object') {
    const plain: any = {}
    for (const key of Object.keys(obj)) {
      const value = obj[key]
      // Skip refs and reactive objects
      if (value && typeof value === 'object' && 'value' in value) {
        plain[key] = value.value
      } else if (typeof value !== 'function') {
        plain[key] = toPlainObject(value)
      }
    }
    return plain
  }
  return obj
}

export interface CursorNoteFilters {
  tag?: string
  search?: string
  sort?: 'createdAt' | 'title' | 'updatedAt' | 'isFavorite'
  order?: 'asc' | 'desc'
  favorite?: boolean
}

export function useOfflineNotes() {
  // Get IDB instance without destructuring to avoid cloning refs
  const idb = useIdb()
  
  const isOnline = ref(true)
  const offlineError = ref<string | null>(null)

  // Initialize online status
  onMounted(() => {
    isOnline.value = navigator.onLine
    
    window.addEventListener('online', () => {
      console.log('[OfflineNotes] Back online')
      isOnline.value = true
      offlineError.value = null
    })
    
    window.addEventListener('offline', () => {
      console.log('[OfflineNotes] Gone offline')
      isOnline.value = false
    })
  })

  // Get notes with cursor-based pagination for infinite scroll
  async function getNotesPaginated(
    cursor: string | null,
    options: CursorNoteFilters = {},
    limit: number = 20
  ): Promise<{ notes: Note[]; nextCursor: string | null; hasMore: boolean }> {
    offlineError.value = null
    
    const { tag, search, sort = 'updatedAt', order = 'desc', favorite } = options

    try {
      let notes = await idb.getAllNotes()
      
      // Filter by favorite
      if (favorite !== undefined) {
        notes = notes.filter(n => n.isFavorite === favorite)
      }
      
      // Filter by tag
      if (tag) {
        notes = notes.filter(n => n.tags.includes(tag))
      }
      
      // Filter by search
      if (search) {
        const query = search.toLowerCase()
        notes = notes.filter(n => 
          n.content.toLowerCase().includes(query) ||
          n.tags.some(t => t.toLowerCase().includes(query))
        )
      }
      
      // Sort
      notes.sort((a, b) => {
        let aVal = a[sort] as string | number | boolean
        let bVal = b[sort] as string | number | boolean
        
        if (typeof aVal === 'boolean') aVal = aVal ? 1 : 0
        if (typeof bVal === 'boolean') bVal = bVal ? 1 : 0
        
        if (order === 'desc') {
          return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
        }
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
      })
      
      // Find cursor position
      let startIndex = 0
      if (cursor) {
        const cursorIndex = notes.findIndex(n => n.id === cursor)
        if (cursorIndex !== -1) {
          startIndex = cursorIndex + 1
        }
      }
      
      // Get page of results
      const pageNotes = notes.slice(startIndex, startIndex + limit)
      const hasMore = startIndex + limit < notes.length
      const nextCursor = hasMore && pageNotes.length > 0 
        ? pageNotes[pageNotes.length - 1].id 
        : null
      
      console.log('[OfflineNotes] Returning', pageNotes.length, 'notes, hasMore:', hasMore)
      
      // Then refresh from server in background
      if (isOnline.value) {
        refreshFromServer()
      }
      
      return {
        notes: pageNotes,
        nextCursor,
        hasMore,
      }
    } catch (e: any) {
      console.error('[OfflineNotes] IndexedDB fetch failed:', e)
      offlineError.value = 'Failed to load notes'
      return { notes: [], nextCursor: null, hasMore: false }
    }
  }

  // Legacy getNotes for backwards compatibility
  async function getNotes(options: { 
    tag?: string 
    sort?: 'createdAt' | 'title' | 'updatedAt' | 'isFavorite'
    order?: 'asc' | 'desc'
    page?: number
    limit?: number
  } = {}): Promise<Note[]> {
    const result = await getNotesPaginated(null, {
      tag: options.tag,
      sort: options.sort,
      order: options.order,
    }, options.limit || 20)
    return result.notes
  }

  // Refresh cache from server (background, non-blocking)
  async function refreshFromServer(): Promise<void> {
    if (!isOnline.value) return
    
    try {
      console.log('[OfflineNotes] Refreshing cache from server (background)')
      const response = await $fetch<{ notes: any[] }>('/api/notes/markdown?limit=1000')
      
      if (response.notes && response.notes.length > 0) {
        const notes: Note[] = response.notes.map(n => ({
          id: n.id,
          content: n.content,
          tags: n.tags || [],
          isFavorite: n.isFavorite,
          createdAt: n.createdAt,
          updatedAt: n.updatedAt,
        }))
        await idb.saveNotes(notes)
        console.log('[OfflineNotes] Cache refreshed with', notes.length, 'notes')
      }
    } catch (e: any) {
      console.warn('[OfflineNotes] Cache refresh failed:', e.message)
    }
  }

  // Get single note - always from IndexedDB first
  async function getNoteById(id: string): Promise<Note | null> {
    offlineError.value = null
    
    // First, read from IndexedDB
    try {
      const cached = await idb.getNote(id)
      if (cached) {
        console.log('[OfflineNotes] Found note in IndexedDB:', id)
        
        // Then refresh from server in background
        if (isOnline.value) {
          refreshNoteFromServer(id)
        }
        
        return cached
      }
    } catch (e: any) {
      console.warn('[OfflineNotes] IndexedDB lookup failed:', e.message)
    }
    
    // If not in cache and online, try server
    if (isOnline.value) {
      try {
        const response = await $fetch<any>(`/api/notes/markdown/${id}`)
        const note: Note = {
          id: response.id,
          content: response.content,
          tags: response.tags || [],
          isFavorite: response.isFavorite,
          createdAt: response.createdAt,
          updatedAt: response.updatedAt,
        }
        await idb.saveNote(note)
        return note
      } catch (e: any) {
        console.warn('[OfflineNotes] Server fetch failed:', e.message)
      }
    }
    
    return null
  }

  // Refresh single note from server (background, non-blocking)
  async function refreshNoteFromServer(id: string): Promise<void> {
    if (!isOnline.value) return
    
    try {
      const response = await $fetch<any>(`/api/notes/markdown/${id}`)
      const note: Note = {
        id: response.id,
        content: response.content,
        tags: response.tags || [],
        isFavorite: response.isFavorite,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt,
      }
      await idb.saveNote(note)
      console.log('[OfflineNotes] Refreshed note from server:', id)
    } catch (e) {
      // Silently fail - we have cached version
    }
  }

  // Create note - save locally and queue sync
  async function createNote(data: { content: string; tags?: string[]; isFavorite?: boolean }): Promise<Note | null> {
    // Convert to plain object to handle reactive refs
    const plainData = toPlainObject(data)

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const note: Note = {
      id,
      content: plainData.content,
      tags: plainData.tags || [],
      isFavorite: plainData.isFavorite || false,
      createdAt: now,
      updatedAt: now,
    }

    try {
      console.log('note', note)
      // Save to IndexedDB immediately
      await idb.saveNote(note)
      console.log('[OfflineNotes] Created note locally:', id)

      // Queue for sync if online
      if (isOnline.value) {
        try {
          const response = await $fetch<any>('/api/notes/markdown', {
            method: 'POST',
            body: { content: note.content, tags: note.tags, isFavorite: note.isFavorite }
          })

          // Update with server ID if different
          if (response.id !== id) {
            // Delete local with temp ID and save with server ID
            await idb.deleteNote(id)
            note.id = response.id
            await idb.saveNote(note)
          }
          console.log('[OfflineNotes] Synced note to server')
        } catch (e) {
          console.warn('[OfflineNotes] Failed to sync note, queuing for later:', e)
          // Use plain object to avoid cloning issues
          await idb.addToSyncQueue({
            id,
            action: 'create',
            entity: 'note',
            data: toPlainObject({ content: note.content, tags: note.tags, isFavorite: note.isFavorite }),
            timestamp: Date.now(),
          })
        }
      } else {
        // Queue for sync when back online
        await idb.addToSyncQueue({
          id,
          action: 'create',
          entity: 'note',
          data: toPlainObject({ content: note.content, tags: note.tags, isFavorite: note.isFavorite }),
          timestamp: Date.now(),
        })
      }

      return note
    } catch (e: any) {
      console.error('[OfflineNotes] Failed to create note:', e)
      return null
    }
  }

  // Update note - save locally and queue sync
  async function updateNote(id: string, data: { content?: string; tags?: string[]; isFavorite?: boolean }): Promise<boolean> {
    // Convert to plain object to handle reactive refs
    const plainData = toPlainObject(data)

    try {
      // Get current note
      const current = await idb.getNote(id)
      if (!current) {
        console.error('[OfflineNotes] Note not found:', id)
        return false
      }

      const updated: Note = {
        ...current,
        content: plainData.content ?? current.content,
        tags: plainData.tags ?? current.tags,
        isFavorite: plainData.isFavorite ?? current.isFavorite,
        updatedAt: new Date().toISOString(),
      }

      // Save to IndexedDB immediately
      await idb.saveNote(updated)
      console.log('[OfflineNotes] Updated note locally:', id)

      // Queue for sync if online
      if (isOnline.value) {
        try {
          await $fetch(`/api/notes/markdown/${id}`, {
            method: 'PUT',
            body: {
              content: updated.content,
              tags: updated.tags,
              isFavorite: updated.isFavorite,
            }
          })
          console.log('[OfflineNotes] Synced note update to server')
        } catch (e) {
          console.warn('[OfflineNotes] Failed to sync note update, queuing for later:', e)
          await idb.addToSyncQueue({
            id,
            action: 'update',
            entity: 'note',
            data: toPlainObject({
              content: updated.content,
              tags: updated.tags,
              isFavorite: updated.isFavorite,
            }),
            timestamp: Date.now(),
          })
        }
      } else {
        // Queue for sync when back online
        await idb.addToSyncQueue({
          id,
          action: 'update',
          entity: 'note',
          data: toPlainObject({
            content: updated.content,
            tags: updated.tags,
            isFavorite: updated.isFavorite,
          }),
          timestamp: Date.now(),
        })
      }

      return true
    } catch (e: any) {
      console.error('[OfflineNotes] Failed to update note:', e)
      return false
    }
  }

  // Delete note - save locally and queue sync
  async function deleteNoteFn(id: string): Promise<boolean> {
    try {
      // Remove from IndexedDB
      await idb.deleteNote(id)
      console.log('[OfflineNotes] Deleted note from IndexedDB:', id)

      // Queue for sync if online
      if (isOnline.value) {
        try {
          await $fetch(`/api/notes/markdown/${id}`, { method: 'DELETE' })
          console.log('[OfflineNotes] Synced note deletion to server')
        } catch (e) {
          console.warn('[OfflineNotes] Failed to sync note deletion, queuing for later:', e)
          await idb.addToSyncQueue({
            id,
            action: 'delete',
            entity: 'note',
            data: toPlainObject({ id }),
            timestamp: Date.now(),
          })
        }
      } else {
        // Queue for sync when back online
        await idb.addToSyncQueue({
          id,
          action: 'delete',
          entity: 'note',
          data: toPlainObject({ id }),
          timestamp: Date.now(),
        })
      }
      
      return true
    } catch (e: any) {
      console.error('[OfflineNotes] Failed to delete note:', e)
      return false
    }
  }

  // Search notes locally
  async function searchNotes(query: string): Promise<Note[]> {
    try {
      return await idb.searchNotes(query)
    } catch (e: any) {
      console.error('[OfflineNotes] Search failed:', e)
      return []
    }
  }

  // Toggle favorite
  async function toggleFavorite(id: string): Promise<boolean> {
    const note = await idb.getNote(id)
    if (!note) return false
    return updateNote(id, { isFavorite: !note.isFavorite })
  }

  return {
    isOnline,
    offlineError,
    getNotes,
    getNotesPaginated,
    getNoteById,
    createNote,
    updateNote,
    deleteNote: deleteNoteFn,
    searchNotes,
    toggleFavorite,
  }
}
