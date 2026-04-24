import { stripMarkdown } from '../utils/markdown'

const DB_NAME = 'bkmk-offline-db'
const DB_VERSION = 3
const BOOKMARKS_STORE = 'bookmarks'
const NOTES_STORE = 'notes'
const TAGS_STORE = 'tags'
const SYNC_QUEUE_STORE = 'sync-queue'
const SETTINGS_STORE = 'settings'

// Helper to derive title from content (first line, trimmed, max 100 chars)
export function deriveTitle(content: string): string {
  if (!content) return 'Untitled'
  let firstLine = content.split('\n')[0].trim()
  firstLine = stripMarkdown(firstLine)
  if (!firstLine) return 'Untitled'
  return firstLine.length > 100 ? firstLine.substring(0, 97) + '...' : firstLine
}

export interface Bookmark {
  id: string
  title: string
  url: string
  description: string | null
  originalHtml?: string | null
  cleanedMarkdown?: string | null
  readingTimeMinutes?: number | null
  savedAt: string
  lastAccessedAt?: string | null
  isFavorite: boolean
  sortOrder?: number | null
  thumbnailImagePath: string | null
  isRead: boolean
  readAt: string | null
  sourceDomain: string | null
  wordCount?: number | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  tags?: string[]
}

export interface BookmarkFilters {
  page?: number
  limit?: number
  sort?: string
  order?: string
  favorite?: boolean
  tag?: string
  domain?: string
  unread?: boolean
}

// Note types matching server schema
export interface Note {
  id: string
  content: string
  tags: string[]
  isFavorite: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

// Tag types matching server schema
export interface Tag {
  id: string
  name: string
  parentTagId: string | null
  color: string | null
  type: 'bookmark' | 'note' | 'both'
  description?: string | null
  icon?: string | null
  createdAt: string
  bookmarkCount?: number
}

export interface TagNode extends Tag {
  children: TagNode[]
  depth: number
  expanded: boolean
}

export interface TagFilterOptions {
  type?: TagType
  includeHierarchy?: boolean
  searchQuery?: string
}

export type TagType = 'bookmark' | 'note' | 'both'

interface SyncQueueItem {
  id: string
  action: 'create' | 'update' | 'delete'
  entity: 'bookmark' | 'note' | 'tag'
  data: any
  timestamp: number
  retries: number
}

let dbInstance: IDBDatabase | null = null

export function useIdb() {
  let isReady = false
  let error: string | null = null

  async function openDatabase(): Promise<IDBDatabase> {
    if (dbInstance) return dbInstance

    return new Promise((resolve, reject) => {
      console.log('[IDB] Opening database...')

      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        const err = `Failed to open database: ${request.error?.message}`
        console.error('[IDB] Error:', err)
        error = err
        reject(new Error(err))
      }

      request.onsuccess = () => {
        dbInstance = request.result
        console.log('[IDB] Database opened successfully')
        isReady = true
        resolve(dbInstance)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        const txn = (event.target as IDBOpenDBRequest).transaction

        console.log('[IDB] Upgrading database...')

        if (!db.objectStoreNames.contains(BOOKMARKS_STORE)) {
          const bookmarksStore = db.createObjectStore(BOOKMARKS_STORE, { keyPath: 'id' })
          bookmarksStore.createIndex('savedAt', 'savedAt', { unique: false })
          bookmarksStore.createIndex('isFavorite', 'isFavorite', { unique: false })
          bookmarksStore.createIndex('isRead', 'isRead', { unique: false })
        }

        if (!db.objectStoreNames.contains(NOTES_STORE)) {
          const notesStore = db.createObjectStore(NOTES_STORE, { keyPath: 'id' })
          notesStore.createIndex('createdAt', 'createdAt', { unique: false })
          notesStore.createIndex('updatedAt', 'updatedAt', { unique: false })
          notesStore.createIndex('isFavorite', 'isFavorite', { unique: false })
          notesStore.createIndex('title', 'title', { unique: false })
        }

        if (!db.objectStoreNames.contains(TAGS_STORE)) {
          const tagsStore = db.createObjectStore(TAGS_STORE, { keyPath: 'id' })
          tagsStore.createIndex('name', 'name', { unique: true })
          tagsStore.createIndex('parentTagId', 'parentTagId', { unique: false })
        }

        if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
          const syncStore = db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: 'id' })
          syncStore.createIndex('timestamp', 'timestamp', { unique: false })
          syncStore.createIndex('entity', 'entity', { unique: false })
        }

        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' })
        }

        // Version 3 migration: add deletedAt support
        if (event.oldVersion < 3) {
          console.log('[IDB] Migrating to version 3: Adding soft delete support')

          // Update bookmarks store with deleted_at field
          const bookmarksStore = txn.objectStore(BOOKMARKS_STORE)
          const bookmarksCursor = bookmarksStore.openCursor()
          bookmarksCursor.onsuccess = (e) => {
            const cursor = e.target.result
            if (cursor) {
              const value = cursor.value
              value.deletedAt = null
              cursor.update(value)
              cursor.continue()
            }
          }

          // Update notes store with deletedAt field
          const notesStore = txn.objectStore(NOTES_STORE)
          const notesCursor = notesStore.openCursor()
          notesCursor.onsuccess = (e) => {
            const cursor = e.target.result
            if (cursor) {
              const value = cursor.value
              value.deletedAt = null
              cursor.update(value)
              cursor.continue()
            }
          }
        }
      }
    })
  }

  async function initialize(): Promise<void> {
    console.log('[IDB] Initializing...')
    try {
      await openDatabase()
      console.log('[IDB] Initialization complete')
    } catch (e) {
      console.error('[IDB] Initialization failed:', e)
      throw e
    }
  }

  // ==================== NOTES ====================
  async function saveNote(note: Note): Promise<void> {
    return saveNotes([note])
  }

  async function saveNotes(notes: Note[]): Promise<void> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(NOTES_STORE, 'readwrite')
      const store = tx.objectStore(NOTES_STORE)

      notes.forEach(note => store.put(note))

      tx.oncomplete = () => {
        console.log('[IDB] Saved', notes.length, 'notes')
        resolve()
      }
      tx.onerror = () => reject(tx.error)
    })
  }

  async function getNote(id: string): Promise<Note | null> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(NOTES_STORE, 'readonly')
      const store = tx.objectStore(NOTES_STORE)
      const request = store.get(id)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  async function getAllNotes(): Promise<Note[]> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(NOTES_STORE, 'readonly')
      const store = tx.objectStore(NOTES_STORE)
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async function deleteNote(id: string): Promise<void> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(NOTES_STORE, 'readwrite')
      const store = tx.objectStore(NOTES_STORE)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async function searchNotes(query: string): Promise<Note[]> {
    const notes = await getAllNotes()
    const lowerQuery = query.toLowerCase()

    return notes.filter(note =>
      deriveTitle(note.content).toLowerCase().includes(lowerQuery) ||
      note.content.toLowerCase().includes(lowerQuery) ||
      note.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    )
  }

  // ==================== TAGS ====================
  async function saveTag(tag: Tag): Promise<void> {
    return saveTags([tag])
  }

  async function saveTags(tags: Tag[]): Promise<void> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TAGS_STORE, 'readwrite')
      const store = tx.objectStore(TAGS_STORE)

      tags.forEach(tag => store.put(tag))

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async function getTag(id: string): Promise<Tag | null> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TAGS_STORE, 'readonly')
      const store = tx.objectStore(TAGS_STORE)
      const request = store.get(id)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  async function getAllTags(): Promise<Tag[]> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TAGS_STORE, 'readonly')
      const store = tx.objectStore(TAGS_STORE)
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async function getTagsByType(type: 'bookmark' | 'note' | 'both'): Promise<Tag[]> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TAGS_STORE, 'readonly')
      const store = tx.objectStore(TAGS_STORE)
      const request = store.getAll()

      request.onsuccess = () => {
        const result = request.result.filter(t => t.type === type)
        resolve(result)
      }
      request.onerror = () => reject(request.error)
    })
  }


  async function deleteTag(id: string): Promise<void> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TAGS_STORE, 'readwrite')
      const store = tx.objectStore(TAGS_STORE)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // ==================== BOOKMARKS ====================
  async function saveBookmark(bookmark: Bookmark): Promise<void> {
    return saveBookmarks([bookmark])
  }

  async function saveBookmarks(bookmarks: Bookmark[]): Promise<void> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BOOKMARKS_STORE, 'readwrite')
      const store = tx.objectStore(BOOKMARKS_STORE)

      bookmarks.forEach(bookmark => {
        bookmark.originalHtml = null // Don't store original HTML locally.
        store.put(bookmark)
      })

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async function getBookmark(id: string): Promise<Bookmark | null> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BOOKMARKS_STORE, 'readonly')
      const store = tx.objectStore(BOOKMARKS_STORE)
      const request = store.get(id)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  async function getAllBookmarks(): Promise<Bookmark[]> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BOOKMARKS_STORE, 'readonly')
      const store = tx.objectStore(BOOKMARKS_STORE)
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async function deleteBookmark(id: string): Promise<void> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BOOKMARKS_STORE, 'readwrite')
      const store = tx.objectStore(BOOKMARKS_STORE)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async function clearBookmarks(): Promise<void> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BOOKMARKS_STORE, 'readwrite')
      const store = tx.objectStore(BOOKMARKS_STORE)
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // ==================== SYNC QUEUE ====================
  async function addToSyncQueue(item: Omit<SyncQueueItem, 'retries'>): Promise<void> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite')
      const store = tx.objectStore(SYNC_QUEUE_STORE)
      const request = store.put({ ...item, retries: 0 })

      request.onsuccess = () => {
        console.log('[IDB] Added to sync queue:', item.action, item.entity, item.id)
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }

  async function getSyncQueue(): Promise<SyncQueueItem[]> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SYNC_QUEUE_STORE, 'readonly')
      const store = tx.objectStore(SYNC_QUEUE_STORE)
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async function removeFromSyncQueue(id: string): Promise<void> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite')
      const store = tx.objectStore(SYNC_QUEUE_STORE)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async function updateSyncQueueItem(item: SyncQueueItem): Promise<void> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SYNC_QUEUE_STORE, 'readwrite')
      const store = tx.objectStore(SYNC_QUEUE_STORE)
      const request = store.put(item)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // ==================== SETTINGS ====================
  async function setSetting(key: string, value: any): Promise<void> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SETTINGS_STORE, 'readwrite')
      const store = tx.objectStore(SETTINGS_STORE)
      const request = store.put({ key, value })

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async function getSetting<T>(key: string): Promise<T | null> {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SETTINGS_STORE, 'readonly')
      const store = tx.objectStore(SETTINGS_STORE)
      const request = store.get(key)

      request.onsuccess = () => resolve(request.result?.value ?? null)
      request.onerror = () => reject(request.error)
    })
  }

  return {
    initialize,
    // Notes
    saveNote,
    saveNotes,
    getNote,
    getAllNotes,
    deleteNote,
    searchNotes,
    // Tags
    saveTag,
    saveTags,
    getTag,
    getAllTags,
    getTagsByType,
    deleteTag,
    // Bookmarks
    saveBookmark,
    saveBookmarks,
    getBookmark,
    getAllBookmarks,
    deleteBookmark,
    clearBookmarks,
    // Sync queue
    addToSyncQueue,
    getSyncQueue,
    removeFromSyncQueue,
    updateSyncQueueItem,
    // Settings
    setSetting,
    getSetting,
  }
}
