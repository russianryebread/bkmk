<template>
  <div class="flex h-full min-h-[calc(100vh-64px)]">
    <!-- Tag Sidebar -->
    <TagSidebar
      ref="sidebarRef"
      mode="bookmark"
      :current-view="currentView"
      :active-tag="activeTag"
      :mobile-open="sidebarOpen"
      :inbox-count="inboxCount"
      :total-count="totalCount"
      @update:mobile-open="sidebarOpen = $event"
      @change="handleSidebarChange"
    />

    <!-- Main content -->
    <div class="flex-1 min-w-0 flex flex-col">
      <!-- Toolbar -->
      <div class="sticky top-16 z-10 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3">
        <!-- Mobile sidebar toggle -->
        <button
          class="md:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
          @click="sidebarOpen = true"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <!-- View title -->
        <h1 class="text-base font-semibold text-gray-900 dark:text-white">
          {{ viewTitle }}
        </h1>

        <div class="flex-1" />

        <!-- Search -->
        <div class="relative">
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            type="text"
            placeholder="Search... (/)"
            class="input text-sm py-1.5 pl-8 pr-3 w-48 md:w-64"
            @input="handleSearchInput"
          />
          <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <!-- Add bookmark -->
        <button @click="showAddModal = true" class="btn-primary text-sm py-1.5 px-3 flex items-center gap-1.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span class="hidden sm:inline">Add</span>
        </button>
      </div>

      <!-- Content area -->
      <div class="flex-1 overflow-y-auto p-4">
        <!-- Loading -->
        <div v-if="loading && bookmarks.length === 0" class="flex justify-center py-16">
          <svg class="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>

        <!-- Error -->
        <div v-else-if="error && bookmarks.length === 0" class="card p-8 text-center">
          <p class="text-red-600 dark:text-red-400 mb-4">{{ error }}</p>
          <button @click="dataStore.triggerSync()" class="btn-secondary">Try Again</button>
        </div>

        <!-- Empty -->
        <div v-else-if="!loading && bookmarks.length === 0" class="card p-12 text-center">
          <svg v-if="currentView === 'inbox'" class="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <svg v-else class="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {{ currentView === 'inbox' ? 'Inbox is empty' : currentView === 'tag' ? `No bookmarks tagged "${activeTag}"` : 'No bookmarks yet' }}
          </h3>
          <p class="text-gray-500 dark:text-gray-400 mb-4">
            {{ currentView === 'inbox' ? 'Newly saved bookmarks appear here until you tag them.' : 'Add your first bookmark to get started.' }}
          </p>
          <button @click="showAddModal = true" class="btn-primary">Add Bookmark</button>
        </div>

        <!-- Bookmark list/grid -->
        <div v-else>
          <!-- Card view -->
          <div v-if="viewMode === 'card'" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <BookmarkCard
              v-for="bookmark in bookmarks"
              :key="bookmark.id"
              :bookmark="bookmark"
              @click="goToBookmark(bookmark.id)"
              @favorite="toggleFavorite(bookmark)"
            />
          </div>

          <!-- List view -->
          <div v-else class="card divide-y divide-gray-200 dark:divide-gray-700">
            <BookmarkListItem
              v-for="bookmark in bookmarks"
              :key="bookmark.id"
              :bookmark="bookmark"
              @click="goToBookmark(bookmark.id)"
              @favorite="toggleFavorite(bookmark)"
            />
          </div>

          <!-- Load more -->
          <div v-if="hasMore" ref="sentinelRef" class="flex justify-center py-8">
            <svg v-if="loadingMore" class="animate-spin h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <button v-else @click="loadMore" class="btn-secondary text-sm">Load more</button>
          </div>

          <div v-if="!hasMore && bookmarks.length > 0" class="text-center py-6 text-sm text-gray-400 dark:text-gray-500">
            All caught up
          </div>
        </div>
      </div>
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
            ref="urlInputRef"
            type="url"
            placeholder="https://example.com/article"
            class="input mb-4"
            required
            autofocus
          />
          <p v-if="addError" class="text-red-600 text-sm mb-4">{{ addError }}</p>
          <div class="flex gap-2">
            <button type="button" @click="showAddModal = false" class="btn-secondary flex-1">Cancel</button>
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
import { storeToRefs } from 'pinia'
import { useViewMode } from '~/composables/useViewMode'
import { useDataStore } from '~/stores/useDataStore'
import type { Bookmark } from '~/composables/idb'

const router = useRouter()
const route = useRoute()
const { viewMode } = useViewMode()
const dataStore = useDataStore()
const { bookmarks: storeBookmarks, syncStatus } = storeToRefs(dataStore)

// Sidebar state
const sidebarRef = ref<any>(null)
const sidebarOpen = ref(false)

const PAGE_SIZE = 25

const currentView = computed(() => {
  if (route.query.tag) return 'tag'
  if (route.query.view === 'favorites') return 'favorites'
  if (route.query.view === 'all') return 'all'
  return 'inbox'
})

const activeTag = computed(() => (route.query.tag as string) || '')

const viewTitle = computed(() => {
  if (currentView.value === 'inbox') return 'Inbox'
  if (currentView.value === 'all') return 'All Bookmarks'
  if (currentView.value === 'favorites') return 'Favorites'
  if (currentView.value === 'tag') return `#${activeTag.value}`
  return 'Bookmarks'
})

const searchQuery = ref('')
const debouncedSearch = ref('')
const displayedCount = ref(PAGE_SIZE)
const error = ref<string | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
const sentinelRef = ref<HTMLElement | null>(null)

const filteredBookmarks = computed<Bookmark[]>(() => {
  const filters: Parameters<typeof dataStore.searchBookmarks>[1] = {
    sort: 'savedAt',
    order: 'desc',
  }
  if (currentView.value === 'inbox') filters.untagged = true
  if (currentView.value === 'favorites') filters.favorite = true
  if (currentView.value === 'tag' && activeTag.value) filters.tag = activeTag.value
  // touch storeBookmarks so this computed re-runs when the store array updates
  void storeBookmarks.value.length
  return dataStore.searchBookmarks(debouncedSearch.value, filters)
})

const bookmarks = computed(() => filteredBookmarks.value.slice(0, displayedCount.value))
const hasMore = computed(() => displayedCount.value < filteredBookmarks.value.length)
const loading = computed(() => syncStatus.value === 'syncing' && storeBookmarks.value.length === 0)
const loadingMore = ref(false)

const inboxCount = computed(() =>
  dataStore.searchBookmarks('', { untagged: true }).length,
)
const totalCount = computed(() =>
  storeBookmarks.value.filter((b) => !b.deletedAt).length,
)

// Reset pagination when filters change
watch(
  () => [currentView.value, activeTag.value, debouncedSearch.value],
  () => {
    displayedCount.value = PAGE_SIZE
  },
)

watch(
  () => [route.query.tag, route.query.view],
  () => {
    searchQuery.value = ''
    debouncedSearch.value = ''
  },
)

function loadMore() {
  if (!hasMore.value || loadingMore.value) return
  loadingMore.value = true
  displayedCount.value = Math.min(displayedCount.value + PAGE_SIZE, filteredBookmarks.value.length)
  loadingMore.value = false
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
function handleSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    debouncedSearch.value = searchQuery.value
  }, 300)
}

function handleSidebarChange(view: string, tag: string) {
  const query: Record<string, string> = {}
  if (view === 'tag') query.tag = tag
  else if (view === 'all') query.view = 'all'
  else if (view === 'favorites') query.view = 'favorites'
  router.push({ path: '/bookmarks', query })
  sidebarOpen.value = false
}

async function toggleFavorite(bookmark: Bookmark) {
  await dataStore.toggleBookmarkFavorite(bookmark.id)
}

function goToBookmark(id: string) {
  router.push(`/bookmarks/${id}`)
}

// Modal
const showAddModal = ref(false)
const newUrl = ref('')
const urlInputRef = ref<HTMLInputElement | null>(null)
const adding = ref(false)
const addError = ref('')

watch(showAddModal, async (val) => {
  if (val) {
    await nextTick()
    urlInputRef.value?.focus()
  }
})

async function addBookmark() {
  if (!newUrl.value) return
  adding.value = true
  addError.value = ''
  try {
    const created = await dataStore.createBookmark(newUrl.value)
    const bookmarkId = created?.id
    showAddModal.value = false
    newUrl.value = ''
    if (bookmarkId) router.push(`/bookmarks/${bookmarkId}`)
  } catch (e: any) {
    addError.value = e.data?.message || e.message || 'Failed to add bookmark'
  } finally {
    adding.value = false
  }
}

let observer: IntersectionObserver | null = null
watch(sentinelRef, (el) => {
  if (observer) observer.disconnect()
  if (!el) return
  observer = new IntersectionObserver(
    ([entry]) => { if (entry.isIntersecting) loadMore() },
    { rootMargin: '200px' }
  )
  observer.observe(el)
})

onUnmounted(() => observer?.disconnect())

onMounted(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
      e.preventDefault()
      searchInputRef.value?.focus()
    }
  }
  window.addEventListener('keydown', handler)
  onUnmounted(() => window.removeEventListener('keydown', handler))
})
</script>
