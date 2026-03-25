export interface Bookmark {
  id: string
  title: string
  url: string
  description: string | null
  original_html: string | null
  cleaned_markdown: string | null
  reading_time_minutes: number | null
  saved_at: string
  last_accessed_at: string | null
  is_favorite: boolean
  sort_order: number | null
  thumbnail_image_path: string | null
  is_read: boolean
  read_at: string | null
  source_domain: string | null
  word_count: number | null
  created_at: string
  updated_at: string
  tags: string[]
  tag_ids: string[]
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

export function useBookmarks() {
  const bookmarks = ref<Bookmark[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const pagination = ref({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })

  async function fetchBookmarks(filters: BookmarkFilters = {}) {
    loading.value = true
    error.value = null
    
    try {
      const params = new URLSearchParams()
      
      if (filters.page) params.set('page', filters.page.toString())
      if (filters.limit) params.set('limit', filters.limit.toString())
      if (filters.sort) params.set('sort', filters.sort)
      if (filters.order) params.set('order', filters.order)
      if (filters.favorite) params.set('favorite', 'true')
      if (filters.tag) params.set('tag', filters.tag)
      if (filters.domain) params.set('domain', filters.domain)
      if (filters.unread) params.set('unread', 'true')

      const response = await $fetch<{ bookmarks: Bookmark[]; pagination: typeof pagination.value }>(`/api/bookmarks?${params}`)
      
      bookmarks.value = response.bookmarks
      pagination.value = response.pagination
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch bookmarks'
    } finally {
      loading.value = false
    }
  }

  async function fetchBookmark(id: string): Promise<Bookmark | null> {
    try {
      const response = await $fetch<Bookmark>(`/api/bookmarks/${id}`)
      return response
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch bookmark'
      return null
    }
  }

  async function createBookmark(url: string): Promise<Bookmark | null> {
    try {
      const response = await $fetch<Bookmark>('/api/scrape', {
        method: 'POST',
        body: { url },
      })
      await fetchBookmarks()
      return response
    } catch (e: any) {
      error.value = e.message || 'Failed to create bookmark'
      return null
    }
  }

  async function updateBookmark(id: string, updates: Partial<Bookmark>): Promise<boolean> {
    try {
      await $fetch(`/api/bookmarks/${id}`, {
        method: 'PUT',
        body: updates,
      })
      await fetchBookmarks()
      return true
    } catch (e: any) {
      error.value = e.message || 'Failed to update bookmark'
      return false
    }
  }

  async function deleteBookmark(id: string): Promise<boolean> {
    try {
      await $fetch(`/api/bookmarks/${id}`, {
        method: 'DELETE',
      })
      bookmarks.value = bookmarks.value.filter(b => b.id !== id)
      return true
    } catch (e: any) {
      error.value = e.message || 'Failed to delete bookmark'
      return false
    }
  }

  async function toggleFavorite(id: string): Promise<boolean> {
    const bookmark = bookmarks.value.find(b => b.id === id)
    if (!bookmark) return false
    
    return updateBookmark(id, { is_favorite: !bookmark.is_favorite })
  }

  async function markAsRead(id: string): Promise<boolean> {
    return updateBookmark(id, { is_read: true })
  }

  async function toggleRead(id: string): Promise<boolean> {
    const bookmark = bookmarks.value.find(b => b.id === id)
    if (!bookmark) return false
    
    return updateBookmark(id, { is_read: !bookmark.is_read })
  }

  return {
    bookmarks,
    loading,
    error,
    pagination,
    fetchBookmarks,
    fetchBookmark,
    createBookmark,
    updateBookmark,
    deleteBookmark,
    toggleFavorite,
    markAsRead,
    toggleRead,
  }
}
