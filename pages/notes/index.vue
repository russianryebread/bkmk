<template>
  <div class="flex h-full min-h-[calc(100vh-64px)]">
    <!-- Tag Sidebar -->
    <TagSidebar
      ref="sidebarRef"
      mode="note"
      :current-view="currentView"
      :active-tag="activeTag"
      :mobile-open="sidebarOpen"
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

        <!-- New note -->
        <button @click="router.push('/notes/new')" class="btn-primary text-sm py-1.5 px-3 flex items-center gap-1.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span class="hidden sm:inline">New</span>
        </button>
      </div>

      <!-- Content area -->
      <div class="flex-1 overflow-y-auto p-4">
        <!-- Loading -->
        <div v-if="loading && notes.length === 0" class="flex justify-center py-16">
          <svg class="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>

        <!-- Error -->
        <div v-else-if="error && notes.length === 0" class="card p-8 text-center">
          <p class="text-red-600 dark:text-red-400 mb-4">{{ error }}</p>
          <button @click="dataStore.triggerSync()" class="btn-secondary">Try Again</button>
        </div>

        <!-- Empty -->
        <div v-else-if="!loading && notes.length === 0" class="card p-12 text-center">
          <svg class="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {{ currentView === 'tag' ? `No notes tagged "${activeTag}"` : 'No notes yet' }}
          </h3>
          <p class="text-gray-500 dark:text-gray-400 mb-4">Create your first markdown note</p>
          <button @click="router.push('/notes/new')" class="btn-primary">Create Note</button>
        </div>

        <!-- Notes list -->
        <div v-else>
          <!-- Card view -->
          <div v-if="viewMode === 'card'" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div
              v-for="note in notes"
              :key="note.id"
              class="card p-4 hover:shadow-md transition-shadow cursor-pointer flex flex-col gap-2"
              @click="router.push(`/notes/${note.id}`)"
            >
              <div class="flex items-start justify-between gap-2">
                <h3 class="font-medium text-gray-900 dark:text-white text-sm leading-snug flex-1">
                  {{ deriveTitle(note.content) }}
                </h3>
                <div class="flex gap-1 flex-shrink-0">
                  <button @click.stop="toggleFavorite(note)" class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                    <svg class="w-4 h-4" :class="note.isFavorite ? 'text-yellow-400 fill-current' : 'text-gray-300 dark:text-gray-600'"
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </button>
                  <button @click.stop="deleteNote(note)" class="p-1 rounded text-gray-300 dark:text-gray-600 hover:text-red-500">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              <div v-if="note.tags && note.tags.length > 0" class="flex flex-wrap gap-1">
                <span v-for="tag in note.tags.slice(0, 3)" :key="tag"
                  class="px-1.5 py-0.5 text-xs rounded"
                  :style="{ backgroundColor: getTagColor(tag).bg, color: getTagColor(tag).text }">
                  {{ tag }}
                </span>
                <span v-if="note.tags.length > 3" class="text-xs text-gray-400 self-center">
                  +{{ note.tags.length - 3 }}
                </span>
              </div>

              <p class="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 font-mono">
                {{ note.content }}
              </p>
              <div class="text-xs text-gray-400 mt-auto">{{ formatDate(note.updatedAt) }}</div>
            </div>
          </div>

          <!-- List view -->
          <div v-else class="card divide-y divide-gray-200 dark:divide-gray-700">
            <div
              v-for="note in notes"
              :key="note.id"
              class="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
              @click="router.push(`/notes/${note.id}`)"
            >
              <div class="flex-1 min-w-0">
                <h3 class="font-medium text-gray-900 dark:text-white truncate text-sm">
                  {{ deriveTitle(note.content) }}
                </h3>
                <div class="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  <span>{{ formatDate(note.updatedAt) }}</span>
                  <div v-if="note.tags && note.tags.length > 0" class="flex gap-1">
                    <span v-for="tag in note.tags.slice(0, 2)" :key="tag"
                      class="px-1.5 py-0.5 rounded"
                      :style="{ backgroundColor: getTagColor(tag).bg, color: getTagColor(tag).text }">
                      {{ tag }}
                    </span>
                    <span v-if="note.tags.length > 2" class="text-gray-400">+{{ note.tags.length - 2 }}</span>
                  </div>
                </div>
              </div>
              <div class="flex gap-1 flex-shrink-0">
                <button @click.stop="toggleFavorite(note)" class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                  <svg class="w-4 h-4" :class="note.isFavorite ? 'text-yellow-400 fill-current' : 'text-gray-300 dark:text-gray-600'"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </button>
                <button @click.stop="deleteNote(note)" class="p-1 rounded text-gray-300 dark:text-gray-600 hover:text-red-500">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Load more -->
          <div v-if="hasMore" ref="sentinelRef" class="flex justify-center py-8">
            <svg v-if="loadingMore" class="animate-spin h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <button v-else @click="loadMore" class="btn-secondary text-sm">Load more</button>
          </div>

          <div v-if="!hasMore && notes.length > 0" class="text-center py-6 text-sm text-gray-400 dark:text-gray-500">
            All caught up
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { deriveTitle } from '~/composables/idb'
import type { Note } from '~/composables/idb'
import { useViewMode } from '~/composables/useViewMode'
import { useDataStore } from '~/stores/useDataStore'

const router = useRouter()
const route = useRoute()
const { viewMode } = useViewMode()
const { getTagColor } = useTagSystem()
const dataStore = useDataStore()
const { notes: storeNotes, syncStatus } = storeToRefs(dataStore)

const sidebarRef = ref<any>(null)
const sidebarOpen = ref(false)

const PAGE_SIZE = 25

const currentView = computed(() => {
  if (route.query.tag) return 'tag'
  if (route.query.view === 'favorites') return 'favorites'
  return 'all'
})

const activeTag = computed(() => (route.query.tag as string) || '')

const viewTitle = computed(() => {
  if (currentView.value === 'all') return 'All Notes'
  if (currentView.value === 'favorites') return 'Favorites'
  if (currentView.value === 'tag') return `#${activeTag.value}`
  return 'Notes'
})

const searchQuery = ref('')
const debouncedSearch = ref('')
const displayedCount = ref(PAGE_SIZE)
const error = ref<string | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
const sentinelRef = ref<HTMLElement | null>(null)

function formatDate(dateStr: string) {
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(dateStr))
  } catch {
    return dateStr
  }
}

const filteredNotes = computed<Note[]>(() => {
  void storeNotes.value.length
  let results = dataStore.searchNotes(debouncedSearch.value)
  if (currentView.value === 'favorites') results = results.filter(n => n.isFavorite)
  if (currentView.value === 'tag' && activeTag.value) {
    results = results.filter(n => n.tags?.some(t => t.toLowerCase() === activeTag.value.toLowerCase()))
  }
  return [...results].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
})

const notes = computed(() => filteredNotes.value.slice(0, displayedCount.value))
const hasMore = computed(() => displayedCount.value < filteredNotes.value.length)
const loading = computed(() => syncStatus.value === 'syncing' && storeNotes.value.length === 0)
const loadingMore = ref(false)

const totalCount = computed(() => storeNotes.value.filter(n => !n.deletedAt).length)

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
  displayedCount.value = Math.min(displayedCount.value + PAGE_SIZE, filteredNotes.value.length)
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
  else if (view === 'favorites') query.view = 'favorites'
  router.push({ path: '/notes', query })
  sidebarOpen.value = false
}

async function toggleFavorite(note: Note) {
  await dataStore.toggleNoteFavorite(note.id)
}

async function deleteNote(note: Note) {
  if (!confirm('Delete this note?')) return
  await dataStore.deleteNote(note.id)
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
