// Unified Pinia store for bookmarks, notes, tags
// Data flow: server → IndexedDB → pinia (on read)
//           pinia → IndexedDB → server (on write, background sync)

import { defineStore } from 'pinia'
import { useIdb, type Note, type Tag } from '~/composables/idb'
import type { Bookmark, BookmarkFilters } from '~/composables/useBookmarks'

// Types for sync queue items
interface SyncQueueItem {
  id: string
  action: 'create' | 'update' | 'delete'
  entity: 'bookmark' | 'note' | 'tag'
  data: unknown
  timestamp: number
  retries: number
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline'

export const useDataStore = defineStore('data', () => {
  const idb = useIdb()

  // ==================== STATE ====================
  const bookmarks = ref<Bookmark[]>([])
  const notes = ref<Note[]>([])
  const tags = ref<Tag[]>([])

  const loading = ref(false)
  const syncing = ref(false)
  const syncStatus = ref<SyncStatus>('idle')
  const syncError = ref<string | null>(null)
  const lastSyncTime = ref<Date | null>(null)

  const isOnline = ref(true)

  // ==================== COMPUTED ====================
  const pendingChangesCount = computed(() => syncQueue.value.length)
  const hasPendingChanges = computed(() => syncQueue.value.length > 0)

  // ==================== SYNC QUEUE ====================
  const syncQueue = ref<SyncQueueItem[]>([])

  // ==================== LIFECYCLE ====================
  async function initialize() {
    console.log('[DataStore] Initializing...')
    
    // Initialize IndexedDB first
    await idb.initialize()
    
    // Load from IndexedDB into state
    await loadFromIdb()
    
    // Set up online/offline listeners
    isOnline.value = navigator.onLine
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    // Fetch latest from server and update IndexedDB
    if (isOnline.value) {
      syncWithServer()
    }
  }

  function cleanup() {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }

  function handleOnline() {
    console.log('[DataStore] Online')
    isOnline.value = true
    syncStatus.value = 'idle'
    syncWithServer()
  }

  function handleOffline() {
    console.log('[DataStore] Offline')
    isOnline.value = false
    syncStatus.value = 'offline'
  }

  // ==================== LOAD FROM INDEXEDDB ====================
  async function loadFromIdb() {
    console.log('[DataStore] Loading from IndexedDB...')
    try {
      const [loadedBookmarks, loadedNotes, loadedTags] = await Promise.all([
        idb.getAllBookmarks(),
        idb.getAllNotes(),
        idb.getAllTags(),
      ])
      bookmarks.value = loadedBookmarks
      notes.value = loadedNotes
      tags.value = loadedTags
      console.log(`[DataStore] Loaded: ${loadedBookmarks.length} bookmarks, ${loadedNotes.length} notes, ${loadedTags.length} tags`)
    } catch (e) {
      console.error('[DataStore] Failed to load from IndexedDB:', e)
    }
  }

  // ==================== SERVER SYNC ====================
  async function syncWithServer(): Promise<boolean> {
    if (!isOnline.value || syncing.value) return false

    console.log('[DataStore] Syncing with server...')
    syncing.value = true
    syncStatus.value = 'syncing'
    syncError.value = null

    try {
      // 1. Push local changes via batch API
      await pushLocalChanges()

      // 2. Pull server data
      await pullServerData()

      lastSyncTime.value = new Date()
      syncStatus.value = 'success'
      return true
    } catch (e: unknown) {
      const error = e as Error
      console.error('[DataStore] Sync failed:', error)
      syncError.value = error.message || 'Sync failed'
      syncStatus.value = 'error'
      return false
    } finally {
      syncing.value = false
    }
  }

  async function pushLocalChanges() {
    const queue = await idb.getSyncQueue()
    if (queue.length === 0) return

    console.log(`[DataStore] Processing ${queue.length} queued changes...`)

    // Group by entity type for batch operations
    const bookmarkItems = queue.filter(q => q.entity === 'bookmark')
    const noteItems = queue.filter(q => q.entity === 'note')
    const tagItems = queue.filter(q => q.entity === 'tag')

    // Process bookmarks
    if (bookmarkItems.length > 0) {
      const creates = bookmarkItems.filter(q => q.action === 'create')
      const updates = bookmarkItems.filter(q => q.action === 'update')
      const deletes = bookmarkItems.filter(q => q.action === 'delete')

      try {
        await pushBookmarksBatch(creates, updates, deletes)
      } catch (e) {
        console.warn(`[DataStore] Batch push failed for bookmarks, falling back to individual pushes`)
        for (const item of bookmarkItems) {
          try {
            await pushChange(item)
          } catch (err) {
            item.retries++
            await idb.updateSyncQueueItem(item)
          }
        }
      }
      for (const item of bookmarkItems) {
        await idb.removeFromSyncQueue(item.id)
      }
    }

    // Process notes
    if (noteItems.length > 0) {
      const creates = noteItems.filter(q => q.action === 'create')
      const updates = noteItems.filter(q => q.action === 'update')
      const deletes = noteItems.filter(q => q.action === 'delete')

      try {
        await pushNotesBatch(creates, updates, deletes)
      } catch (e) {
        console.warn(`[DataStore] Batch push failed for notes, falling back to individual pushes`)
        for (const item of noteItems) {
          try {
            await pushChange(item)
          } catch (err) {
            item.retries++
            await idb.updateSyncQueueItem(item)
          }
        }
      }
      for (const item of noteItems) {
        await idb.removeFromSyncQueue(item.id)
      }
    }

    // Process tags
    if (tagItems.length > 0) {
      const creates = tagItems.filter(q => q.action === 'create')
      const updates = tagItems.filter(q => q.action === 'update')
      const deletes = tagItems.filter(q => q.action === 'delete')

      try {
        await pushTagsBatch(creates, updates, deletes)
      } catch (e) {
        console.warn(`[DataStore] Batch push failed for tags, falling back to individual pushes`)
        for (const item of tagItems) {
          try {
            await pushChange(item)
          } catch (err) {
            item.retries++
            await idb.updateSyncQueueItem(item)
          }
        }
      }
      for (const item of tagItems) {
        await idb.removeFromSyncQueue(item.id)
      }
    }
  }

  async function pushBookmarksBatch(creates: SyncQueueItem[], updates: SyncQueueItem[], deletes: SyncQueueItem[]) {
    const batchData = {
      create: creates.map(c => c.data as Bookmark),
      update: updates.map(u => {
        const data = u.data as Partial<Bookmark>
        return { id: u.id, ...data }
      }),
      del: deletes.map(d => d.id),
    }

    if (batchData.create.length === 0 && batchData.update.length === 0 && batchData.del.length === 0) {
      return
    }

    const result = await $fetch('/api/bookmarks/batch', {
      method: 'POST',
      body: batchData,
    })

    console.log(`[DataStore] Batch bookmark sync: ${result.created.length} created, ${result.updated.length} updated, ${result.deleted.length} deleted`)
  }

  async function pushNotesBatch(creates: SyncQueueItem[], updates: SyncQueueItem[], deletes: SyncQueueItem[]) {
    const batchData = {
      create: creates.map(c => c.data as Note),
      update: updates.map(u => {
        const data = u.data as Partial<Note>
        return { id: u.id, ...data }
      }),
      del: deletes.map(d => d.id),
    }

    if (batchData.create.length === 0 && batchData.update.length === 0 && batchData.del.length === 0) {
      return
    }

    const result = await $fetch('/api/notes/batch', {
      method: 'POST',
      body: batchData,
    })

    console.log(`[DataStore] Batch note sync: ${result.created.length} created, ${result.updated.length} updated, ${result.deleted.length} deleted`)
  }

  async function pushTagsBatch(creates: SyncQueueItem[], updates: SyncQueueItem[], deletes: SyncQueueItem[]) {
    const batchData = {
      create: creates.map(c => c.data as Tag),
      update: updates.map(u => {
        const data = u.data as Partial<Tag>
        return { id: u.id, ...data }
      }),
      del: deletes.map(d => d.id),
    }

    if (batchData.create.length === 0 && batchData.update.length === 0 && batchData.del.length === 0) {
      return
    }

    const result = await $fetch('/api/tags/batch', {
      method: 'POST',
      body: batchData,
    })

    console.log(`[DataStore] Batch tag sync: ${result.created.length} created, ${result.updated.length} updated, ${result.deleted.length} deleted`)
  }

  async function pushChange(item: SyncQueueItem) {
    const { action, entity, id } = item

    switch (entity) {
      case 'bookmark': {
        const data = item.data as Partial<Bookmark>
        if (action === 'delete') {
          await $fetch(`/api/bookmarks/${id}`, { method: 'DELETE' })
        } else if (action === 'create') {
          await $fetch('/api/bookmarks', { method: 'POST', body: data })
        } else {
          await $fetch(`/api/bookmarks/${id}`, { method: 'PUT', body: data })
        }
        break
      }
      case 'note': {
        const data = item.data as Partial<Note>
        if (action === 'delete') {
          await $fetch(`/api/notes/${id}`, { method: 'DELETE' })
        } else if (action === 'create') {
          await $fetch('/api/notes', { method: 'POST', body: data })
        } else {
          await $fetch(`/api/notes/${id}`, { method: 'PUT', body: data })
        }
        break
      }
      case 'tag': {
        const data = item.data as Partial<Tag>
        if (action === 'delete') {
          await $fetch(`/api/tags/${id}`, { method: 'DELETE' })
        } else if (action === 'create') {
          await $fetch('/api/tags', { method: 'POST', body: data })
        } else {
          await $fetch(`/api/tags/${id}`, { method: 'PUT', body: data })
        }
        break
      }
    }
  }

  async function pullServerData() {
    console.log('[DataStore] Pulling data from server...')

    try {
      const [bookmarksRes, notesRes, tagsRes] = await Promise.allSettled([
        $fetch<{ bookmarks: Bookmark[] }>('/api/bookmarks?limit=1000'),
        $fetch<{ notes: Note[] }>('/api/notes?limit=1000'),
        $fetch<{ tags: Tag[] }>('/api/tags'),
      ])

      if (bookmarksRes.status === 'fulfilled' && bookmarksRes.value.bookmarks) {
        const serverBookmarks = bookmarksRes.value.bookmarks
        await mergeBookmarks(serverBookmarks)
        console.log(`[DataStore] Synced ${serverBookmarks.length} bookmarks`)
      }
      if (notesRes.status === 'fulfilled' && notesRes.value.notes) {
        const serverNotes = notesRes.value.notes
        await mergeNotes(serverNotes)
        console.log(`[DataStore] Synced ${serverNotes.length} notes`)
      }

      if (tagsRes.status === 'fulfilled' && tagsRes.value.tags) {
        const serverTags = tagsRes.value.tags
        await mergeTags(serverTags)
        console.log(`[DataStore] Synced ${serverTags.length} tags`)
      }
    } catch (e) {
      console.warn('[DataStore] Partial server pull failed:', e)
    }
  }

  async function mergeBookmarks(serverBookmarks: Bookmark[]) {
    const localMap = new Map(bookmarks.value.map(b => [b.id, { ...b }]))
    
    const toSave: Bookmark[] = []
    
    for (const server of serverBookmarks) {
      const local = localMap.get(server.id)
      if (!local || new Date(server.updated_at) > new Date(local.updated_at)) {
        toSave.push(server)
      } else if (local && new Date(local.updated_at) > new Date(server.updated_at)) {
        toSave.push(local)
      }
    }
    
    if (toSave.length > 0) {
      await idb.saveBookmarks(toSave)
      bookmarks.value = toSave
    }
  }

  async function mergeNotes(serverNotes: Note[]) {
    const localMap = new Map(notes.value.map(n => [n.id, { ...n }]))
    
    const toSave: Note[] = []
    
    for (const server of serverNotes) {
      const local = localMap.get(server.id)
      if (!local || new Date(server.updatedAt) > new Date(local.updatedAt)) {
        toSave.push(server)
      } else if (local && new Date(local.updatedAt) > new Date(server.updatedAt)) {
        toSave.push(local)
      }
    }
    
    if (toSave.length > 0) {
      await idb.saveNotes(toSave)
      notes.value = toSave
    }
  }

  async function mergeTags(serverTags: Tag[]) {
    const localMap = new Map(tags.value.map(t => [t.id, { ...t }]))
    
    const toSave: Tag[] = []
    for (const server of serverTags) {
      const local = localMap.get(server.id)
      if (!local || new Date(server.createdAt) > new Date(local.createdAt)) {
        toSave.push(server)
      } else if (local) {
        toSave.push(local)
      }
    }
    
    if (toSave.length > 0) {
      await idb.saveTags(toSave)
      tags.value = toSave
    }
  }

  // ==================== QUEUE CHANGE ====================
  async function queueChange(entity: 'bookmark' | 'note' | 'tag', action: 'create' | 'update' | 'delete', id: string, data?: unknown) {
    const item = {
      id: `${entity}-${action}-${id}-${Date.now()}`,
      action,
      entity,
      data: data || { id },
      timestamp: Date.now(),
    }
    
    await idb.addToSyncQueue(item as Omit<SyncQueueItem, 'retries'>)

    // Try immediate sync if online (fire and forget)
    if (isOnline.value && !syncing.value) {
      syncWithServer()
    }
  }

  // ==================== BOOKMARK OPERATIONS ====================
  async function createBookmark(url: string): Promise<Bookmark | null> {
    try {
      const response = await $fetch<Bookmark>('/api/scrape', {
        method: 'POST',
        body: { url },
      })

      // Add to local state and IndexedDB immediately
      bookmarks.value.push(response)
      await idb.saveBookmark(response)

      return response
    } catch (e) {
      console.error('[DataStore] Failed to create bookmark:', e)
      return null
    }
  }

  async function updateBookmark(id: string, updates: Partial<Bookmark>): Promise<boolean> {
    const index = bookmarks.value.findIndex(b => b.id === id)
    if (index === -1) return false

    const current = bookmarks.value[index]
    if (!current) return false

    const updated = { ...current, ...updates, updated_at: new Date().toISOString() }
    bookmarks.value[index] = updated

    // Save to IndexedDB immediately
    await idb.saveBookmark(updated)

    // Queue for server sync (background)
    await queueChange('bookmark', 'update', id, updates)

    return true
  }

  async function deleteBookmark(id: string): Promise<boolean> {
    const bookmark = bookmarks.value.find(b => b.id === id)
    if (!bookmark) return false

    // Optimistically remove from local state
    bookmarks.value = bookmarks.value.filter(b => b.id !== id)
    await idb.deleteBookmark(id)

    // Queue for server sync (background)
    await queueChange('bookmark', 'delete', id)

    return true
  }

  async function toggleBookmarkFavorite(id: string): Promise<boolean> {
    const bookmark = bookmarks.value.find(b => b.id === id)
    if (!bookmark) return false
    return updateBookmark(id, { is_favorite: !bookmark.is_favorite })
  }

  async function markBookmarkRead(id: string): Promise<boolean> {
    return updateBookmark(id, { is_read: true, read_at: new Date().toISOString() })
  }

  // ==================== NOTE OPERATIONS ====================
  async function createNote(data: { content: string; tags?: string[]; isFavorite?: boolean }): Promise<Note | null> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const note: Note = {
      id,
      content: data.content,
      tags: data.tags || [],
      isFavorite: data.isFavorite || false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }

    // Save locally first
    notes.value.push(note)
    await idb.saveNote(note)

    // Queue for server sync (background)
    await queueChange('note', 'create', id, note)

    return note
  }

  async function updateNote(id: string, data: { content?: string; tags?: string[]; isFavorite?: boolean }): Promise<boolean> {
    const index = notes.value.findIndex(n => n.id === id)
    if (index === -1) return false

    const current = notes.value[index]
    if (!current) return false

    const updated: Note = {
      ...current,
      content: data.content ?? current.content,
      tags: data.tags ?? current.tags,
      isFavorite: data.isFavorite ?? current.isFavorite,
      updatedAt: new Date().toISOString(),
    }
    notes.value[index] = updated

    // Save to IndexedDB immediately
    await idb.saveNote(updated)

    // Queue for server sync (background)
    await queueChange('note', 'update', id, data)

    return true
  }

  async function deleteNote(id: string): Promise<boolean> {
    const note = notes.value.find(n => n.id === id)
    if (!note) return false

    // Optimistically remove from local state
    notes.value = notes.value.filter(n => n.id !== id)
    await idb.deleteNote(id)

    // Queue for server sync (background)
    await queueChange('note', 'delete', id)

    return true
  }

  async function toggleNoteFavorite(id: string): Promise<boolean> {
    const note = notes.value.find(n => n.id === id)
    if (!note) return false
    return updateNote(id, { isFavorite: !note.isFavorite })
  }

  // ==================== TAG OPERATIONS ====================
  async function createTag(data: {
    name: string
    parentTagId?: string | null
    color?: string | null
    type?: 'bookmark' | 'note' | 'both'
    description?: string | null
    icon?: string | null
  }): Promise<Tag | null> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const tag: Tag = {
      id,
      name: data.name,
      parentTagId: data.parentTagId || null,
      color: data.color || null,
      type: data.type || 'both',
      description: data.description || null,
      icon: data.icon || null,
      createdAt: now,
      bookmarkCount: 0,
    }

    // Save locally first
    tags.value.push(tag)
    await idb.saveTag(tag)

    // Queue for server sync (background)
    await queueChange('tag', 'create', id, tag)

    return tag
  }

  async function updateTag(id: string, data: Partial<Tag>): Promise<boolean> {
    const index = tags.value.findIndex(t => t.id === id)
    if (index === -1) return false

    const current = tags.value[index]
    if (!current) return false

    const updated = { ...current, ...data }
    tags.value[index] = updated

    // Save to IndexedDB immediately
    await idb.saveTag(updated)

    // Queue for server sync (background)
    await queueChange('tag', 'update', id, data)

    return true
  }

  async function deleteTag(id: string): Promise<boolean> {
    const tag = tags.value.find(t => t.id === id)
    if (!tag) return false

    // Optimistically remove from local state
    tags.value = tags.value.filter(t => t.id !== id)
    await idb.deleteTag(id)

    // Queue for server sync (background)
    await queueChange('tag', 'delete', id)

    return true
  }

  // ==================== LOOKUP ====================
  function getBookmarkById(id: string): Bookmark | undefined {
    return bookmarks.value.find(b => b.id === id)
  }

  function getNoteById(id: string): Note | undefined {
    return notes.value.find(n => n.id === id)
  }

  function getTagById(id: string): Tag | undefined {
    return tags.value.find(t => t.id === id)
  }

  // ==================== SEARCH ====================
  function searchBookmarks(query: string, filters: BookmarkFilters = {}): Bookmark[] {
    let results = [...bookmarks.value]

    if (filters.favorite) {
      results = results.filter(b => b.is_favorite)
    }
    if (filters.unread) {
      results = results.filter(b => !b.is_read)
    }
    if (filters.tag) {
      results = results.filter(b => b.tags?.includes(filters.tag!))
    }
    if (filters.domain) {
      results = results.filter(b => b.source_domain === filters.domain)
    }

    if (query) {
      const q = query.toLowerCase()
      results = results.filter(b =>
        b.title?.toLowerCase().includes(q) ||
        b.description?.toLowerCase().includes(q) ||
        b.url?.toLowerCase().includes(q) ||
        b.source_domain?.toLowerCase().includes(q) ||
        b.tags?.some(t => t.toLowerCase().includes(q))
      )
    }

    // Sort
    const sort = filters.sort || 'saved_at'
    const order = filters.order || 'desc'
    results.sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sort] || ''
      const bVal = (b as Record<string, unknown>)[sort] || ''
      if (typeof aVal === 'boolean') return order === 'desc' ? (bVal ? 1 : -1) : (aVal ? 1 : -1)
      return order === 'desc'
        ? (bVal > aVal ? 1 : bVal < aVal ? -1 : 0)
        : (aVal > bVal ? 1 : aVal < bVal ? -1 : 0)
    })

    return results
  }

  function searchNotes(query: string): Note[] {
    if (!query) return notes.value

    const q = query.toLowerCase()
    return notes.value.filter(n =>
      n.content.toLowerCase().includes(q) ||
      n.tags.some(t => t.toLowerCase().includes(q))
    )
  }

  function searchTags(query: string): Tag[] {
    if (!query) return tags.value
    const q = query.toLowerCase()
    return tags.value.filter(t => t.name.toLowerCase().includes(q))
  }

  // ==================== PAGINATION HELPERS ====================

  // Cursor-based pagination for bookmarks (for infinite scroll)
  function getBookmarksPaginated(
    cursor: string | null,
    filters: { search?: string; tag?: string; favorite?: boolean; sort?: string; order?: string } = {},
    limit: number = 20
  ): { bookmarks: Bookmark[]; nextCursor: string | null; hasMore: boolean } {
    let results = searchBookmarks('', filters)

    // Find cursor position
    let startIndex = 0
    if (cursor) {
      const cursorIndex = results.findIndex(b => b.id === cursor)
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1
      }
    }

    const pageBookmarks = results.slice(startIndex, startIndex + limit)
    const hasMore = startIndex + limit < results.length
    const lastBookmark = pageBookmarks[pageBookmarks.length - 1]
    const nextCursor = hasMore && lastBookmark ? lastBookmark.id : null

    return { bookmarks: pageBookmarks, nextCursor, hasMore }
  }

  // Cursor-based pagination for notes (for infinite scroll)
  function getNotesPaginated(
    cursor: string | null,
    filters: { sort?: string; order?: string; favorite?: boolean } = {},
    limit: number = 20
  ): { notes: Note[]; nextCursor: string | null; hasMore: boolean } {
    let results = [...notes.value]

    if (filters.favorite !== undefined) {
      results = results.filter(n => n.isFavorite === filters.favorite)
    }

    // Sort
    const sort = filters.sort || 'updatedAt'
    const order = filters.order || 'desc'
    results.sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sort] || ''
      const bVal = (b as Record<string, unknown>)[sort] || ''
      if (typeof aVal === 'boolean') return order === 'desc' ? (bVal ? 1 : -1) : (aVal ? 1 : -1)
      return order === 'desc'
        ? (bVal > aVal ? 1 : bVal < aVal ? -1 : 0)
        : (aVal > bVal ? 1 : aVal < bVal ? -1 : 0)
    })

    // Find cursor position
    let startIndex = 0
    if (cursor) {
      const cursorIndex = results.findIndex(n => n.id === cursor)
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1
      }
    }

    const pageNotes = results.slice(startIndex, startIndex + limit)
    const hasMore = startIndex + limit < results.length
    const lastNote = pageNotes[pageNotes.length - 1]
    const nextCursor = hasMore && lastNote ? lastNote.id : null

    return { notes: pageNotes, nextCursor, hasMore }
  }

  // ==================== MANUAL SYNC TRIGGER ====================
  async function triggerSync(): Promise<boolean> {
    return syncWithServer()
  }

  return {
    // State
    bookmarks,
    notes,
    tags,
    loading,
    syncing,
    syncStatus,
    syncError,
    lastSyncTime,
    isOnline,
    hasPendingChanges,
    pendingChangesCount,

    // Lifecycle
    initialize,
    cleanup,
    triggerSync,

    // Bookmark operations
    createBookmark,
    updateBookmark,
    deleteBookmark,
    toggleBookmarkFavorite,
    markBookmarkRead,

    // Note operations
    createNote,
    updateNote,
    deleteNote,
    toggleNoteFavorite,

    // Tag operations
    createTag,
    updateTag,
    deleteTag,

    // Search
    searchBookmarks,
    searchNotes,
    searchTags,

    // Lookup
    getBookmarkById,
    getNoteById,
    getTagById,

    // Pagination
    getBookmarksPaginated,
    getNotesPaginated,
  }
})