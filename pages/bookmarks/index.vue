<template>
  <div>
    <InfiniteItemList
      ref="infiniteListRef"
      :items="items"
      :loading="loading"
      :loading-more="loadingMore"
      :has-more="hasMore"
      :error="error"
      :available-tags="topLevelTags"
      :selected-tag="selectedTag"
      search-placeholder="Search bookmarks... (Press / to focus)"
      empty-title="No bookmarks yet"
      empty-description="Add your first bookmark to get started"
      @search="handleSearch"
      @tag-change="handleTagChange"
      @load-more="loadMore"
      @retry="reset"
      @refresh="handleRefresh"
    >
      <!-- Add button -->
      <template #actions>
        <button @click="showAddModal = true" class="btn-primary">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </template>

      <!-- Empty state override -->
      <template #empty>
        <svg class="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No bookmarks yet</h3>
        <p class="text-gray-500 dark:text-gray-400 mb-4">Add your first bookmark to get started</p>
        <button @click="showAddModal = true" class="btn-primary">Add Bookmark</button>
      </template>

      <!-- Card view slot -->
      <template #card="{ item }">
        <div
          class="card p-4 hover:shadow-md transition-shadow cursor-pointer"
          @click="goToBookmark(item.id)"
        >
          <div class="flex justify-between items-start mb-2">
            <h3 class="font-medium text-gray-900 dark:text-white line-clamp-2 flex-1">
              {{ item.title }}
            </h3>
            <button @click.stop="toggleFavorite(item.id)" class="ml-2 p-1">
              <svg class="w-5 h-5" :class="item.isFavorite ? 'text-yellow-500 fill-current' : 'text-gray-400'"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>
          </div>

          <div class="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-2">
            <span>{{ item.sourceDomain }}</span>
            <span v-if="item.readingTimeMinutes" class="mx-2">•</span>
            <span v-if="item.readingTimeMinutes">{{ item.readingTimeMinutes }} min read</span>
          </div>

          <p v-if="item.description" class="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-3">
            {{ item.description }}
          </p>

          <div v-if="item.tags && item.tags.length > 0" class="flex flex-wrap gap-1">
            <span v-for="tag in item.tags.slice(0, 3)" :key="tag"
              class="px-2 py-0.5 text-xs rounded-full"
              :style="{ backgroundColor: getTagColor(tag).bg, color: getTagColor(tag).text }">
              {{ tag }}
            </span>
            <span v-if="item.tags.length > 3" class="text-xs text-gray-500">
              +{{ item.tags.length - 3 }}
            </span>
          </div>
        </div>
      </template>

      <!-- List view slot -->
      <template #list="{ item }">
        <div
          class="card py-2 px-3 hover:shadow-md transition-shadow cursor-pointer flex items-center gap-4"
          @click="goToBookmark(item.id)"
        >
          <div class="flex-1 min-w-0">
            <h3 class="font-medium text-gray-900 dark:text-white truncate">
              {{ item.title }}
            </h3>
            <div class="flex items-center text-sm text-gray-500 dark:text-gray-400">
              <span>{{ item.sourceDomain }}</span>
              <span v-if="item.reading_time_minutes" class="mx-2">•</span>
              <span v-if="item.reading_time_minutes">{{ item.reading_time_minutes }} min</span>
            </div>
          </div>
          <div class="flex gap-2 flex-shrink-0">
            <button @click.stop="toggleFavorite(item.id)" class="p-1 flex-shrink-0">
              <svg class="w-4 h-4" :class="item.is_favorite ? 'text-yellow-500 fill-current' : 'text-gray-400'"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>
          </div>
        </div>
      </template>
    </InfiniteItemList>

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
          <input v-model="newUrl" type="url" placeholder="https://example.com/article" class="input mb-4" required autofocus ref="urlInput" />
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
import type { Bookmark, Tag } from '~/composables/idb'

const router = useRouter()
const dataStore = useDataStore()
const idb = useIdb()

// Infinite scroll state
const infiniteListRef = ref<InstanceType<typeof import('~/components/InfiniteItemList.vue').default> | null>(null)
const cursor = ref<string | null>(null)
const items = ref<Bookmark[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const error = ref<string | null>(null)
const hasMore = ref(true)
const filters = ref({
  search: '',
  tag: '',
  favorite: false,
})

const tags = ref<Tag[]>([])
const selectedTag = computed(() => filters.value.tag)
const topLevelTags = computed(() => tags.value.filter((t: Tag) => !t.parentTagId))

// Modal state
const showAddModal = ref(false)
const newUrl = ref('')
const urlInput = ref(null);
const adding = ref(false)
const addError = ref('')


watch(showAddModal, async (val) => {
  if (val) {
    await nextTick();
    urlInput.value?.focus();
  }
});

// Load bookmarks with cursor-based pagination
async function loadMore(isRefresh = false) {
  if (loading.value || loadingMore.value) return
  if (!hasMore.value && !isRefresh) return

  if (isRefresh) {
    loading.value = true
    cursor.value = null
  } else {
    loadingMore.value = true
  }
  error.value = null

  try {
    const result = dataStore.getBookmarksPaginated(
      isRefresh ? null : cursor.value,
      {
        search: filters.value.search || undefined,
        tag: filters.value.tag || undefined,
        favorite: filters.value.tag === 'favorite' ? true : undefined,
        sort: 'saved_at',
        order: 'desc',
      }
    )

    if (isRefresh) {
      items.value = result.bookmarks
    } else {
      items.value = [...items.value, ...result.bookmarks]
    }

    cursor.value = result.nextCursor
    hasMore.value = result.hasMore
  } catch (e: any) {
    error.value = e.message || 'Failed to load bookmarks'
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

// Reset and reload
async function reset() {
  items.value = []
  cursor.value = null
  hasMore.value = true
  await loadMore(true)
}

// Handle search
function handleSearch(query: string) {
  filters.value.search = query
  // Debounce is handled in the component
  reset()
}

// Handle tag change
function handleTagChange(tag: string | null) {
  filters.value.tag = tag || ''
  reset()
}

// Handle pull to refresh
async function handleRefresh() {
  await dataStore.triggerSync() // Ensure we get the latest data from the server
  await reset()
  infiniteListRef.value?.resetRefreshing()
}

// Toggle favorite
async function toggleFavorite(id: string) {
  const bookmark = items.value.find(b => b.id === id)
  if (!bookmark) return

  const newValue = !bookmark.isFavorite
  await dataStore.updateBookmark(id, { isFavorite: newValue })

  // Update local state
  const index = items.value.findIndex(b => b.id === id)
  if (index !== -1 && items.value[index]) {
    items.value[index]!.isFavorite = newValue
  }
}

// Navigate to bookmark
function goToBookmark(id: string) {
  router.push(`/bookmarks/${id}`)
}

// Add bookmark
async function addBookmark() {
  if (!newUrl.value) return

  adding.value = true
  addError.value = ''

  try {
    const bookmark = await dataStore.createBookmark(newUrl.value)
    if (bookmark) {
      showAddModal.value = false
      newUrl.value = ''
      router.push(`/bookmarks/${bookmark.id}`)
      dataStore.bookmarks.push(bookmark)
    }
  } catch (e: any) {
    addError.value = e.data?.message || 'Failed to add bookmark'
  } finally {
    adding.value = false
  }
}

onMounted(async () => {
  tags.value = await idb.getTagsByType('bookmark')
  loadMore(true)
})
</script>
