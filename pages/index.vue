<template>
  <div class="bg-gray-50 dark:bg-gray-900">
    <div class="max-w-6xl mx-auto">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">Dashboard</h1>
        <p class="text-gray-600 dark:text-gray-400">Your bookmarks at a glance</p>
      </div>

      <!-- Stats Section -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <NuxtLink to="/bookmarks" class="card p-4 hover:shadow-lg transition-shadow">
          <div class="flex items-center gap-3">
            <div class="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
            <div>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats.totalBookmarks }}</p>
              <p class="text-sm text-gray-500 dark:text-gray-400">Bookmarks</p>
            </div>
          </div>
        </NuxtLink>

        <NuxtLink to="/notes" class="card p-4 hover:shadow-lg transition-shadow">
          <div class="flex items-center gap-3">
            <div class="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
              <svg class="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats.totalNotes }}</p>
              <p class="text-sm text-gray-500 dark:text-gray-400">Notes</p>
            </div>
          </div>
        </NuxtLink>

        <NuxtLink to="/secrets" class="card p-4 hover:shadow-lg transition-shadow">
          <div class="flex items-center gap-3">
            <div class="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <svg class="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats.totalSecretNotes }}</p>
              <p class="text-sm text-gray-500 dark:text-gray-400">Secrets</p>
            </div>
          </div>
        </NuxtLink>

        <NuxtLink to="/tags" class="card p-4 hover:shadow-lg transition-shadow">
          <div class="flex items-center gap-3">
            <div class="p-3 bg-pink-100 dark:bg-pink-900 rounded-lg">
              <svg class="w-6 h-6 text-pink-600 dark:text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <div>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats.totalTags }}</p>
              <p class="text-sm text-gray-500 dark:text-gray-400">Tags</p>
            </div>
          </div>
        </NuxtLink>
      </div>

      <!-- Search Section -->
      <div class="mb-8">
        <div class="relative">
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            type="text"
            placeholder="Search bookmarks and notes... (Press / to focus)"
            class="input pl-12 pr-32 text-lg"
            @input="handleSearch"
            @keydown="handleKeydown"
          />
          <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <div v-if="searching" class="absolute right-24 top-1/2 -translate-y-1/2">
            <svg class="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <button
            v-else-if="searchQuery"
            @click="clearSearch"
            class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <!-- Keyboard hints -->
        <div class="flex gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
          <span><kbd class="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">↑</kbd> <kbd class="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">↓</kbd> Navigate</span>
          <span><kbd class="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">Enter</kbd> Open</span>
          <span><kbd class="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">Esc</kbd> Clear</span>
        </div>
      </div>

      <!-- Search Results -->
      <div v-if="searchQuery && searchResults.length > 0" class="space-y-3">
        <div
          v-for="(result, index) in searchResults"
          :key="`${result.type}-${result.id}`"
          :ref="el => setResultRef(el, index)"
          :class="[
            'card p-4 cursor-pointer transition-all',
            selectedIndex === index 
              ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20' 
              : 'hover:shadow-md'
          ]"
          @click="openResult(result)"
          @mouseenter="selectedIndex = index"
        >
          <div class="flex items-start gap-4">
            <!-- Type indicator -->
            <div :class="[
              'p-2 rounded-lg flex-shrink-0',
              result.type === 'bookmark' 
                ? 'bg-blue-100 dark:bg-blue-900' 
                : 'bg-green-100 dark:bg-green-900'
            ]">
              <svg v-if="result.type === 'bookmark'" class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <svg v-else class="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            
            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span :class="[
                  'text-xs px-2 py-0.5 rounded-full',
                  result.type === 'bookmark'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                    : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                ]">
                  {{ result.type === 'bookmark' ? 'Bookmark' : 'Note' }}
                </span>
                <span v-if="result.type === 'bookmark' && !result.is_read" class="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 rounded-full">
                  Unread
                </span>
              </div>
              <h3 class="font-medium text-gray-900 dark:text-white line-clamp-1" v-html="result.title"></h3>
              <p v-if="result.description" class="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mt-1" v-html="result.description"></p>
              <div v-if="result.type === 'bookmark'" class="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                <span>{{ result.source_domain }}</span>
                <span v-if="result.tags && result.tags.length > 0" class="flex gap-1">
                  <span 
                    v-for="tag in (result.tags ?? []).slice(0, 3)" 
                    :key="tag" 
                    class="px-2 py-0.5 text-xs rounded-full"
                    :style="{ backgroundColor: getTagColor(tag).bg, color: getTagColor(tag).text }"
                  >{{ tag }}</span>
                </span>
              </div>
              <div v-else class="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                <span>Updated {{ formatDate(result.updated_at ?? "") }}</span>
              </div>
            </div>
            
            <!-- Arrow indicator for selected -->
            <div v-if="selectedIndex === index" class="flex-shrink-0">
              <svg class="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- No results -->
      <div v-else-if="searchQuery && !searching" class="card p-8 text-center">
        <svg class="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-1">No results found</h3>
        <p class="text-gray-500 dark:text-gray-400 mb-4">Try a different search term</p>
        <button v-if="isUrl(searchQuery)" @click="scrapeUrl" class="btn-primary">
          Add this URL as bookmark
        </button>
      </div>

      <!-- Quick Links -->
      <div v-if="!searchQuery" class="grid md:grid-cols-2 gap-6">
        <NuxtLink to="/bookmarks" class="card p-6 hover:shadow-lg transition-shadow group">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <div class="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg group-hover:scale-110 transition-transform">
                <svg class="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </div>
              <div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Browse Bookmarks</h3>
                <p class="text-gray-500 dark:text-gray-400">View and manage all your saved links</p>
              </div>
            </div>
            <svg class="w-6 h-6 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </NuxtLink>

        <NuxtLink to="/notes" class="card p-6 hover:shadow-lg transition-shadow group">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <div class="p-3 bg-green-100 dark:bg-green-900 rounded-lg group-hover:scale-110 transition-transform">
                <svg class="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Markdown Notes</h3>
                <p class="text-gray-500 dark:text-gray-400">Create and edit markdown notes</p>
              </div>
            </div>
            <svg class="w-6 h-6 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const router = useRouter()
const { loadAllTags, getTagColor } = useTagColors()

// Stats
const stats = ref({
  totalBookmarks: 0,
  unreadBookmarks: 0,
  totalNotes: 0,
  totalSecretNotes: 0,
  totalTags: 0,
})

const searchQuery = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)
const selectedIndex = ref(0)
const searching = ref(false)

// Search results (combined bookmarks and notes)
interface SearchResult {
  id: string
  type: 'bookmark' | 'note'
  title: string
  description: string | null
  source_domain?: string | null
  tags?: string[]
  is_read?: boolean
  url?: string
  updated_at?: string
}

const searchResults = ref<SearchResult[]>([])

// Check if query is a URL
function isUrl(query: string): boolean {
  try {
    const url = new URL(query)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

// Fetch stats
async function fetchStats() {
  try {
    const response = await $fetch<typeof stats.value>('/api/stats')
    stats.value = response
  } catch (e) {
    console.error('Failed to fetch stats:', e)
  }
}

// Add bookmark from search
async function addBookmark() {
  const query = searchQuery.value.trim()
  
  if (isUrl(query)) {
    // Direct URL - scrape it
    try {
      searching.value = true
      const response = await $fetch<{ id: string }>('/api/scrape', {
        method: 'POST',
        body: { url: query },
      })
      router.push(`/bookmarks/${response.id}`)
    } catch (e) {
      console.error('Failed to scrape URL:', e)
      searching.value = false
    }
  } else if (query) {
    // Show bookmark creation dialog with URL
    router.push(`/bookmarks?url=${encodeURIComponent(query)}`)
  }
}

// Scrape URL from search
async function scrapeUrl() {
  const query = searchQuery.value.trim()
  if (!isUrl(query)) return
  
  try {
    searching.value = true
    const response = await $fetch<{ id: string }>('/api/scrape', {
      method: 'POST',
      body: { url: query },
    })
    router.push(`/bookmarks/${response.id}`)
  } catch (e) {
    console.error('Failed to scrape URL:', e)
    searching.value = false
  }
}

// Search handler with debounce
let debounceTimeout: NodeJS.Timeout | null = null

function handleSearch() {
  selectedIndex.value = 0
  
  if (debounceTimeout) {
    clearTimeout(debounceTimeout)
  }

  if (!searchQuery.value.trim()) {
    searchResults.value = []
    searching.value = false
    return
  }

  searching.value = true

  debounceTimeout = setTimeout(async () => {
    try {
      const query = encodeURIComponent(searchQuery.value)
      
      // Search bookmarks and notes in parallel
      const [bookmarkResponse, notesResponse] = await Promise.all([
        $fetch<{ bookmarks: any[] }>(`/api/bookmarks/search?q=${query}&limit=10`),
        $fetch<{ notes: any[] }>(`/api/notes/markdown/search?q=${query}&limit=10`)
      ])
      
      // Transform and combine results
      const bookmarkResults: SearchResult[] = bookmarkResponse.bookmarks.map(b => ({
        id: b.id,
        type: 'bookmark' as const,
        title: b.title,
        description: b.description,
        source_domain: b.source_domain,
        tags: b.tags,
        is_read: b.is_read,
        url: b.url,
        updated_at: b.updated_at,
      }))

      const noteResults: SearchResult[] = notesResponse.notes.map(n => ({
        id: n.id,
        type: 'note' as const,
        title: n.title,
        description: n.content ? n.content.substring(0, 150) + (n.content.length > 150 ? '...' : '') : null,
        updated_at: n.updated_at,
      }))

      // Interleave results (bookmarks first, then notes)
      searchResults.value = [...bookmarkResults, ...noteResults]
    } catch (e) {
      console.error('Search failed:', e)
      searchResults.value = []
    } finally {
      searching.value = false
    }
  }, 300)
}

// Keyboard navigation
function handleKeydown(e: KeyboardEvent) {
  if (!searchResults.value.length) return

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      selectedIndex.value = Math.min(selectedIndex.value + 1, searchResults.value.length - 1)
      scrollToSelected()
      break
    case 'ArrowUp':
      e.preventDefault()
      selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
      scrollToSelected()
      break
    case 'Enter':
      e.preventDefault()
      if (searchResults.value[selectedIndex.value]) {
        openResult(searchResults.value[selectedIndex.value])
      }
      break
    case 'Escape':
      e.preventDefault()
      clearSearch()
      break
  }
}

// Track result elements for scrolling
const resultRefs = ref<(HTMLElement | null)[]>([])

function setResultRef(el: any, index: number) {
  resultRefs.value[index] = el
}

function scrollToSelected() {
  const el = resultRefs.value[selectedIndex.value]
  if (el) {
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
}

// Clear search
function clearSearch() {
  searchQuery.value = ''
  searchResults.value = []
  selectedIndex.value = 0
}

// Open result
function openResult(result: SearchResult) {
  if (result.type === 'bookmark') {
    router.push(`/bookmarks/${result.id}`)
  } else {
    router.push(`/notes?id=${result.id}`)
  }
}

// Format date
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  return date.toLocaleDateString()
}

// Global keyboard shortcut to focus search
onMounted(() => {
  fetchStats()
  loadAllTags()
  
  // Auto-focus search on page load
  nextTick(() => {
    searchInputRef.value?.focus()
  })

  // Listen for '/' key to focus search
  const handleGlobalKeydown = (e: KeyboardEvent) => {
    if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
      e.preventDefault()
      searchInputRef.value?.focus()
    }
  }

  window.addEventListener('keydown', handleGlobalKeydown)

  onUnmounted(() => {
    window.removeEventListener('keydown', handleGlobalKeydown)
  })
})
</script>
