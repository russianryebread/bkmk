<template>
  <div>
    <!-- Header with actions -->
    <div class="flex flex-col sm:flex-row gap-4 mb-6">
      <!-- Search -->
      <div class="flex-1">
        <div class="relative">
          <input ref="searchInputRef" v-model="searchQuery" type="text"
            placeholder="Search bookmarks... (Press / to focus)" class="input pl-10 pr-24" @input="handleSearch"
            @keydown.enter="handleEnter" />
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor"
            viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <button v-if="isUrl(searchQuery)" @click="addUrlAsBookmark"
            class="absolute right-2 top-1/2 -translate-y-1/2 btn-primary text-sm py-1">
            bkmk it!
          </button>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex gap-2">
        <ViewToggle />
        <button @click="showAddModal = true" class="btn-primary">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-2 mb-6">
      <button @click="toggleFilter('favorite')" :class="['btn', filters.favorite ? 'btn-primary' : 'btn-secondary']">
        <svg class="w-4 h-4 mr-1" :class="filters.favorite ? 'text-white' : 'text-gray-500'" fill="currentColor"
          viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
        Favorites
      </button>

      <!-- Top-level tag filters -->
      <button v-for="tag in topLevelTags" :key="tag.id" @click="toggleTagFilter(tag.name)"
        :class="['btn', filters.tag === tag.name ? 'btn-primary' : 'btn-secondary']"
        :style="filters.tag === tag.name ? {} : { backgroundColor: getTagColor(tag.name).bg, color: getTagColor(tag.name).text, borderColor: getTagColor(tag.name).bg }">
        {{ tag.name }}
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <svg class="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
        </path>
      </svg>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="card p-6 text-center">
      <p class="text-red-600 dark:text-red-400">{{ error }}</p>
      <button @click="loadBookmarks" class="btn-secondary mt-4">Try Again</button>
    </div>

    <!-- Empty state -->
    <div v-else-if="bookmarks.length === 0" class="card p-12 text-center">
      <svg class="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No bookmarks yet</h3>
      <p class="text-gray-500 dark:text-gray-400 mb-4">Add your first bookmark to get started</p>
      <button @click="showAddModal = true" class="btn-primary">Add Bookmark</button>
    </div>

    <!-- Bookmarks grid/list -->
    <div v-else>
      <!-- Card View -->
      <div v-if="viewMode === 'card'" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div v-for="bookmark in bookmarks" :key="bookmark.id"
          class="card p-4 hover:shadow-md transition-shadow cursor-pointer" @click="goToBookmark(bookmark.id)">
          <div class="flex justify-between items-start mb-2">
            <h3 class="font-medium text-gray-900 dark:text-white line-clamp-2 flex-1">
              {{ bookmark.title }}
            </h3>
            <button @click.stop="toggleFavorite(bookmark.id)" class="ml-2 p-1">
              <svg class="w-5 h-5" :class="bookmark.is_favorite ? 'text-yellow-500 fill-current' : 'text-gray-400'"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>
          </div>

          <div class="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-2">
            <span>{{ bookmark.source_domain }}</span>
            <span v-if="bookmark.reading_time_minutes" class="mx-2">•</span>
            <span v-if="bookmark.reading_time_minutes">{{ bookmark.reading_time_minutes }} min read</span>
          </div>

          <p v-if="bookmark.description" class="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-3">
            {{ bookmark.description }}
          </p>

          <div v-if="bookmark.tags && bookmark.tags.length > 0" class="flex flex-wrap gap-1">
            <span v-for="tag in (bookmark.tags as string[]).slice(0, 3)" :key="tag"
              class="px-2 py-0.5 text-xs rounded-full"
              :style="{ backgroundColor: getTagColor(tag).bg, color: getTagColor(tag).text }">
              {{ tag }}
            </span>
            <span v-if="bookmark.tags.length > 3" class="text-xs text-gray-500">
              +{{ bookmark.tags.length - 3 }}
            </span>
          </div>
        </div>
      </div>

      <!-- List View -->
      <div v-else class="space-y-2">
        <div v-for="bookmark in bookmarks" :key="bookmark.id"
          class="card py-2 px-3 hover:shadow-md transition-shadow cursor-pointer flex items-center gap-4"
          @click="goToBookmark(bookmark.id)">
          <div class="flex-1 min-w-0">
            <h3 class="font-medium text-gray-900 dark:text-white truncate">
              {{ bookmark.title }}
            </h3>
            <div class="flex items-center text-sm text-gray-500 dark:text-gray-400">
              <span>{{ bookmark.source_domain }}</span>
              <span v-if="bookmark.reading_time_minutes" class="mx-2">•</span>
              <span v-if="bookmark.reading_time_minutes">{{ bookmark.reading_time_minutes }} min</span>
            </div>
          </div>
          <div class="flex gap-2 flex-shrink-0">
            <button @click.stop="toggleFavorite(bookmark.id)" class="p-1 flex-shrink-0">
              <svg class="w-4 h-4" :class="bookmark.is_favorite ? 'text-yellow-500 fill-current' : 'text-gray-400'"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="pagination.totalPages > 1" class="flex justify-center gap-2 mt-8">
      <button @click="goToPage(pagination.page - 1)" :disabled="pagination.page === 1" class="btn-secondary">
        Previous
      </button>
      <span class="flex items-center px-4 text-gray-600 dark:text-gray-400">
        Page {{ pagination.page }} of {{ pagination.totalPages }}
      </span>
      <button @click="goToPage(pagination.page + 1)" :disabled="pagination.page === pagination.totalPages"
        class="btn-secondary">
        Next
      </button>
    </div>

    <!-- Add Bookmark Modal -->
    <div v-if="showAddModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="card max-w-md w-full p-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">Add Bookmark</h2>
          <button @click="showAddModal = false" class="text-gray-400 hover:text-gray-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form @submit.prevent="addBookmark">
          <input v-model="newUrl" type="url" placeholder="https://example.com/article" class="input mb-4" required />
          <p v-if="addError" class="text-red-600 text-sm mb-4">{{ addError }}</p>
          <div class="flex gap-2">
            <button type="button" @click="showAddModal = false" class="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" class="btn-primary flex-1" :disabled="adding">
              {{ adding ? 'Adding...' : 'Add' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const router = useRouter()
const { bookmarks, loading, error, pagination, fetchBookmarks, createBookmark, toggleFavorite, deleteBookmark } = useBookmarks()
const { results: searchResults, debouncedSearch, clearSearch } = useSearch()
const { loadAllTags, getTagColor } = useTagColors()
const { tags, getAllTags } = useTags()
const { viewMode } = useViewMode()

const searchQuery = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)
const showAddModal = ref(false)
const newUrl = ref('')
const adding = ref(false)
const addError = ref('')

const filters = ref({
  favorite: false,
  tag: '',
})

// Get all tags from centralized useTags
const allTags = computed(() => {
  return tags.value || []
})

// Filter top-level tags (tags without parentTagId)
const topLevelTags = computed(() => {
  return allTags.value.filter(t => !t.parentTagId)
})

// Toggle tag filter
function toggleTagFilter(tagName: string) {
  if (filters.value.tag === tagName) {
    filters.value.tag = ''
  } else {
    filters.value.tag = tagName
  }
  loadBookmarks()
}

// Check if query is a URL
function isUrl(query: string): boolean {
  try {
    const url = new URL(query)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function handleEnter() {
  if (isUrl(searchQuery.value)) {
    addUrlAsBookmark()
  }
}

async function addUrlAsBookmark() {
  const query = searchQuery.value.trim()
  if (!isUrl(query)) return

  adding.value = true
  addError.value = ''

  try {
    const bookmark = await createBookmark(query)
    if (bookmark) {
      searchQuery.value = ''
      router.push(`/bookmarks/${bookmark.id}`)
    }
  } catch (e: any) {
    addError.value = e.data?.message || 'Failed to add bookmark'
  } finally {
    adding.value = false
  }
}

function handleSearch() {
  if (searchQuery.value.length > 0) {
    debouncedSearch(searchQuery.value)
  } else {
    clearSearch()
  }
}

async function loadBookmarks() {
  await fetchBookmarks({
    sort: 'created_at',
    order: 'desc',
    favorite: filters.value.favorite || undefined,
    tag: filters.value.tag || undefined,
  })
}

function toggleFilter(filter: 'favorite') {
  filters.value[filter] = !filters.value[filter]
  loadBookmarks()
}

async function addBookmark() {
  if (!newUrl.value) return

  adding.value = true
  addError.value = ''

  try {
    const bookmark = await createBookmark(newUrl.value)
    if (bookmark) {
      showAddModal.value = false
      newUrl.value = ''
      router.push(`/bookmarks/${bookmark.id}`)
    }
  } catch (e: any) {
    addError.value = e.data?.message || 'Failed to add bookmark'
  } finally {
    adding.value = false
  }
}

function goToBookmark(id: string) {
  router.push(`/bookmarks/${id}`)
}

async function deleteBookmarkConfirm(bookmark: any) {
  if (confirm(`Delete "${bookmark.title}"?`)) {
    await deleteBookmark(bookmark.id)
  }
}

function goToPage(page: number) {
  fetchBookmarks({ page })
}

onMounted(() => {
  loadBookmarks()
  loadAllTags()

  // Focus search on mount
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

  // No auto-sync on online - we're local-first, data is always from IndexedDB

  onUnmounted(() => {
    window.removeEventListener('keydown', handleGlobalKeydown)
  })
})
</script>
