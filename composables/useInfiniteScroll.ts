// Shared composable for infinite scroll functionality
// Supports both bookmarks and notes with cursor-based pagination

export interface InfiniteScrollOptions<T> {
  // Fetch function that receives cursor and returns items + hasMore
  fetchFn: (cursor: string | null, filters: InfiniteScrollFilters) => Promise<{
    items: T[]
    nextCursor: string | null
    hasMore: boolean
  }>
  // Initial filters
  initialFilters?: InfiniteScrollFilters
  // Page size for initial load
  pageSize?: number
}

export interface InfiniteScrollFilters {
  search?: string
  tag?: string
  favorite?: boolean
  sort?: string
  order?: 'asc' | 'desc'
}

export function useInfiniteScroll<T>(options: InfiniteScrollOptions<T>) {
  const {
    fetchFn,
    initialFilters = {},
    pageSize = 20,
  } = options

  // State
  const items = ref<T[]>([]) as Ref<T[]>
  const loading = ref(false)
  const loadingMore = ref(false)
  const error = ref<string | null>(null)
  const cursor = ref<string | null>(null)
  const hasMore = ref(true)
  const filters = ref<InfiniteScrollFilters>({ ...initialFilters })
  const searchQuery = ref('')
  
  // Debounce timer for search
  let searchDebounceTimer: NodeJS.Timeout | null = null

  // Reset state and reload
  async function reset() {
    items.value = []
    cursor.value = null
    hasMore.value = true
    error.value = null
    await loadMore(true)
  }

  // Load more items
  async function loadMore(isRefresh = false) {
    if (loading.value || loadingMore.value) return
    if (!hasMore.value && !isRefresh) return

    if (isRefresh) {
      loading.value = true
    } else {
      loadingMore.value = true
    }
    error.value = null

    try {
      const result = await fetchFn(
        isRefresh ? null : cursor.value,
        filters.value
      )

      if (isRefresh) {
        items.value = result.items
      } else {
        items.value = [...items.value, ...result.items]
      }

      cursor.value = result.nextCursor
      hasMore.value = result.hasMore
    } catch (e: any) {
      error.value = e.message || 'Failed to load items'
      console.error('[useInfiniteScroll] Error:', e)
    } finally {
      loading.value = false
      loadingMore.value = false
    }
  }

  // Update filters and refresh
  function updateFilters(newFilters: Partial<InfiniteScrollFilters>) {
    filters.value = { ...filters.value, ...newFilters }
    reset()
  }

  // Set search with debounce
  function setSearch(query: string) {
    searchQuery.value = query
    
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer)
    }

    searchDebounceTimer = setTimeout(() => {
      updateFilters({ search: query || undefined })
    }, 300)
  }

  // Set tag filter
  function setTag(tag: string | null) {
    updateFilters({ tag: tag || undefined })
  }

  // Set favorite filter
  function setFavorite(favorite: boolean | null) {
    updateFilters({ favorite: favorite ?? undefined })
  }

  // Update single item in list (for local updates like favorites)
  function updateItem(id: string, updates: Partial<T>) {
    const index = items.value.findIndex((item: any) => item.id === id)
    if (index !== -1) {
      items.value[index] = { ...items.value[index], ...updates }
    }
  }

  // Remove item from list
  function removeItem(id: string) {
    items.value = items.value.filter((item: any) => item.id !== id)
  }

  // Add item to beginning of list
  function prependItem(item: T) {
    items.value = [item, ...items.value]
  }

  return {
    // State
    items,
    loading,
    loadingMore,
    error,
    hasMore,
    filters,
    searchQuery,
    
    // Actions
    loadMore,
    reset,
    updateFilters,
    setSearch,
    setTag,
    setFavorite,
    updateItem,
    removeItem,
    prependItem,
  }
}
