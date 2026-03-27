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

  // Get notes - try online first, fallback to IndexedDB
  async function getNotes(options: { 
    tag?: string 
    sort?: 'createdAt' | 'title' | 'updatedAt' | 'isFavorite'
    order?: 'asc' | 'desc'
    page?: number
    limit?: number
  } = {}): Promise<Note[]> {
    offlineError.value = null
    
    const { tag, sort = 'updatedAt', order = 'desc', page = 1, limit = 20 } = options

    // Try online fetch first
    if (isOnline.value) {
      try {
        console.log('[OfflineNotes] Fetching notes from server')
        const params = new URLSearchParams()
        params.set('sort', sort)
        params.set('order', order)
        params.set('page', page.toString())
        params.set('limit', limit.toString())
        if (tag) params.set('tag', tag)

        const response = await $fetch<{ notes: any[] }>(`/api/notes/markdown?${params}`)
        
        if (response.notes && response.notes.length > 0) {
          const notes: Note[] = response.notes.map(n => ({
            id: n.id,
            title: n.title,
            content: n.content,
            tags: n.tags || [],
            isFavorite: n.isFavorite,
            createdAt: n.createdAt,
            updatedAt: n.updatedAt,
          }))
          
          // Cache in IndexedDB
          await idb.saveNotes(notes)
          console.log('[OfflineNotes] Cached', notes.length, 'notes')
          return notes
        }
        
        return []
      } catch (e: any) {
        console.warn('[OfflineNotes] Server fetch failed, falling back to IndexedDB:', e.message)
        offlineError.value = 'Using cached data (server unavailable)'
      }
    }

    // Fallback to IndexedDB
    console.log('[OfflineNotes] Fetching notes from IndexedDB')
    try {
      let notes = await idb.getAllNotes()
      
      // Filter by tag
      if (tag) {
        notes = notes.filter(n => n.tags.includes(tag))
      }
      
      // Sort
      notes.sort((a, b) => {
        let aVal = a[sort] as string | number | boolean
        let bVal = b[sort] as string | number | boolean
        
        if (typeof aVal === 'boolean') aVal = aVal ? 1 : 0
        if (typeof bVal === 'boolean') bVal = bVal ? 1 : 0
        
        if (order === 'desc') {
          return aVal < bVal ? 1 : -1
        }
        return aVal > bVal ? 1 : -1
      })
      
      // Paginate
      const start = (page - 1) * limit
      notes = notes.slice(start, start + limit)
      
      console.log('[OfflineNotes] Returning', notes.length, 'notes from IndexedDB')
      return notes
    } catch (e: any) {
      console.error('[OfflineNotes] IndexedDB fetch failed:', e)
      offlineError.value = 'Failed to load notes'
      return []
    }
  }

  // Get single note
  async function getNoteById(id: string): Promise<Note | null> {
    offlineError.value = null
    
    // Try online first
    if (isOnline.value) {
      try {
        const response = await $fetch<any>(`/api/notes/markdown/${id}`)
        const note: Note = {
          id: response.id,
          title: response.title,
          content: response.content,
          tags: response.tags || [],
          isFavorite: response.isFavorite,
          createdAt: response.createdAt,
          updatedAt: response.updatedAt,
        }
        // Cache in IndexedDB
        await idb.saveNote(note)
        return note
      } catch (e: any) {
        console.warn('[OfflineNotes] Server fetch failed, falling back to IndexedDB:', e.message)
      }
    }

    // Fallback to IndexedDB
    try {
      return await idb.getNote(id)
    } catch (e: any) {
      console.error('[OfflineNotes] IndexedDB fetch failed:', e)
      return null
    }
  }

  // Create note - save locally and queue sync
  async function createNote(data: { title: string; content: string; tags?: string[]; isFavorite?: boolean }): Promise<Note | null> {
    // Convert to plain object to handle reactive refs
    const plainData = toPlainObject(data)
    
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    
    const note: Note = {
      id,
      title: plainData.title,
      content: plainData.content,
      tags: plainData.tags || [],
      isFavorite: plainData.isFavorite || false,
      createdAt: now,
      updatedAt: now,
    }

    try {
      console.log('note', note )
      // Save to IndexedDB immediately
      await idb.saveNote(note)
      console.log('[OfflineNotes] Created note locally:', id)
      
      // Queue for sync if online
      if (isOnline.value) {
        try {
          const response = await $fetch<any>('/api/notes/markdown', {
            method: 'POST',
            body: { title: note.title, content: note.content, tags: note.tags, isFavorite: note.isFavorite }
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
            data: toPlainObject({ title: note.title, content: note.content, tags: note.tags, isFavorite: note.isFavorite }),
            timestamp: Date.now(),
          })
        }
      } else {
        // Queue for sync when back online
        await idb.addToSyncQueue({
          id,
          action: 'create',
          entity: 'note',
          data: toPlainObject({ title: note.title, content: note.content, tags: note.tags, isFavorite: note.isFavorite }),
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
  async function updateNote(id: string, data: { title?: string; content?: string; tags?: string[]; isFavorite?: boolean }): Promise<boolean> {
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
        title: plainData.title ?? current.title,
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
              title: updated.title,
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
              title: updated.title,
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
            title: updated.title,
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
    getNoteById,
    createNote,
    updateNote,
    deleteNote: deleteNoteFn,
    searchNotes,
    toggleFavorite,
  }
}