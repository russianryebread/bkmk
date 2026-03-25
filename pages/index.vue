<template>
  <div>
    <!-- Header with actions -->
    <div class="flex flex-col sm:flex-row gap-4 mb-6">
      <!-- Search -->
      <div class="flex-1">
        <div class="relative">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search bookmarks..."
            class="input pl-10"
            @input="handleSearch"
          />
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex gap-2">
        <select v-model="filters.sort" class="input w-auto" @change="loadBookmarks">
          <option value="created_at">Date Added</option>
          <option value="title">Title</option>
          <option value="saved_at">Date Saved</option>
        </select>
        
        <button @click="showAddModal = true" class="btn-primary">
          <svg class="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Bookmark
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-2 mb-6">
      <button
        @click="toggleFilter('favorite')"
        :class="['btn', filters.favorite ? 'btn-primary' : 'btn-secondary']"
      >
        <svg class="w-4 h-4 mr-1" :class="filters.favorite ? 'text-white' : 'text-gray-500'" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
        Favorites
      </button>
      
      <button
        @click="toggleFilter('unread')"
        :class="['btn', filters.unread ? 'btn-primary' : 'btn-secondary']"
      >
        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        Unread
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <svg class="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No bookmarks yet</h3>
      <p class="text-gray-500 dark:text-gray-400 mb-4">Add your first bookmark to get started</p>
      <button @click="showAddModal = true" class="btn-primary">Add Bookmark</button>
    </div>

    <!-- Bookmarks grid -->
    <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="bookmark in bookmarks"
        :key="bookmark.id"
        class="card p-4 hover:shadow-md transition-shadow cursor-pointer"
        @click="goToBookmark(bookmark.id)"
      >
        <div class="flex justify-between items-start mb-2">
          <h3 class="font-medium text-gray-900 dark:text-white line-clamp-2 flex-1">
            {{ bookmark.title }}
          </h3>
          <button
            @click.stop="toggleFavorite(bookmark.id)"
            class="ml-2 p-1"
          >
            <svg
              class="w-5 h-5"
              :class="bookmark.is_favorite ? 'text-yellow-500 fill-current' : 'text-gray-400'"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>
        </div>
        
        <div class="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-2">
          <span>{{ bookmark.source_domain }}</span>
          <span class="mx-2">•</span>
          <span>{{ formatDate(bookmark.created_at) }}</span>
          <span v-if="bookmark.reading_time_minutes" class="mx-2">•</span>
          <span v-if="bookmark.reading_time_minutes">{{ bookmark.reading_time_minutes }} min read</span>
        </div>

        <p v-if="bookmark.description" class="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-3">
          {{ bookmark.description }}
        </p>

        <div v-if="bookmark.tags.length > 0" class="flex flex-wrap gap-1">
          <span
            v-for="tag in bookmark.tags.slice(0, 3)"
            :key="tag"
            class="tag"
          >
            {{ tag }}
          </span>
          <span v-if="bookmark.tags.length > 3" class="text-xs text-gray-500">
            +{{ bookmark.tags.length - 3 }}
          </span>
        </div>

        <div class="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <span
            v-if="!bookmark.is_read"
            class="text-xs px-2 py-0.5 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded-full"
          >
            Unread
          </span>
          <span v-else class="text-xs text-gray-400">Read</span>
          
          <div class="flex gap-2">
            <button
              @click.stop="toggleRead(bookmark.id)"
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              :title="bookmark.is_read ? 'Mark as unread' : 'Mark as read'"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </button>
            <button
              @click.stop="deleteBookmarkConfirm(bookmark)"
              class="text-gray-400 hover:text-red-600"
              title="Delete"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="pagination.totalPages > 1" class="flex justify-center gap-2 mt-8">
      <button
        @click="goToPage(pagination.page - 1)"
        :disabled="pagination.page === 1"
        class="btn-secondary"
      >
        Previous
      </button>
      <span class="flex items-center px-4 text-gray-600 dark:text-gray-400">
        Page {{ pagination.page }} of {{ pagination.totalPages }}
      </span>
      <button
        @click="goToPage(pagination.page + 1)"
        :disabled="pagination.page === pagination.totalPages"
        class="btn-secondary"
      >
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
          <input
            v-model="newUrl"
            type="url"
            placeholder="https://example.com/article"
            class="input mb-4"
            required
          />
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
const { bookmarks, loading, error, pagination, fetchBookmarks, createBookmark, toggleFavorite, toggleRead, deleteBookmark } = useBookmarks()
const { results: searchResults, debouncedSearch, clearSearch } = useSearch()

const searchQuery = ref('')
const showAddModal = ref(false)
const newUrl = ref('')
const adding = ref(false)
const addError = ref('')

const filters = ref({
  sort: 'created_at',
  order: 'desc' as 'asc' | 'desc',
  favorite: false,
  unread: false,
})

function handleSearch() {
  if (searchQuery.value.length > 0) {
    debouncedSearch(searchQuery.value)
  } else {
    clearSearch()
  }
}

async function loadBookmarks() {
  await fetchBookmarks({
    sort: filters.value.sort,
    order: filters.value.order,
    favorite: filters.value.favorite || undefined,
    unread: filters.value.unread || undefined,
  })
}

function toggleFilter(filter: 'favorite' | 'unread') {
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

onMounted(() => {
  loadBookmarks()
})
</script>
