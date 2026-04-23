import type { Bookmark } from './idb'

export function useSearch() {
  const results = ref<Bookmark[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const searchQuery = ref('')

  let debounceTimeout: NodeJS.Timeout | null = null

  async function search(query: string): Promise<Bookmark[]> {
    if (!query || query.trim().length === 0) {
      results.value = []
      return []
    }

    loading.value = true
    error.value = null

    try {
      const response = await $fetch<{ bookmarks: Bookmark[] }>(`/api/bookmarks/search?q=${encodeURIComponent(query)}`)
      results.value = response.bookmarks
      return response.bookmarks
    } catch (e: any) {
      error.value = e.message || 'Search failed'
      return []
    } finally {
      loading.value = false
    }
  }

  function debouncedSearch(query: string, delay = 300) {
    searchQuery.value = query

    if (debounceTimeout) {
      clearTimeout(debounceTimeout)
    }

    debounceTimeout = setTimeout(() => {
      search(query)
    }, delay)
  }

  function clearSearch() {
    searchQuery.value = ''
    results.value = []
  }

  return {
    results,
    loading,
    error,
    searchQuery,
    search,
    debouncedSearch,
    clearSearch,
  }
}
