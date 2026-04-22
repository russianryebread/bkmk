<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="isOpen" class="fixed inset-0 bg-black/50 flex items-start justify-center z-50 pt-[15vh]" @click.self="close">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
          <!-- Search Input -->
          <div class="p-4 border-b border-gray-200 dark:border-gray-700">
            <div class="relative">
              <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref="searchInputRef"
                v-model="searchQuery"
                type="text"
                placeholder="Search bookmarks and notes..."
                class="w-full pl-12 pr-4 py-3 bg-transparent border-none focus:outline-none text-lg text-gray-900 dark:text-white placeholder-gray-400"
                @keydown.escape="close"
                @keydown.down.prevent="navigateDown"
                @keydown.up.prevent="navigateUp"
                @keydown.enter.prevent="selectCurrent"
              />
              <div class="absolute right-4 top-1/2 -translate-y-1/2">
                <kbd class="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded text-gray-500 dark:text-gray-400">Esc</kbd>
              </div>
            </div>
          </div>

          <!-- Results -->
          <div class="max-h-[60vh] overflow-y-auto">
            <!-- Loading -->
            <div v-if="loading" class="p-8 text-center">
              <svg class="animate-spin h-8 w-8 text-primary-600 mx-auto" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>

            <!-- Results List -->
            <div v-else-if="results.length > 0" class="py-2">
              <button
                v-for="(result, index) in results"
                :key="`${result.type}-${result.id}`"
                @click="selectResult(result)"
                @mouseenter="selectedIndex = index"
                :class="[
                  'w-full px-4 py-3 flex items-center gap-3 text-left transition-colors',
                  selectedIndex === index ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                ]"
              >
                <!-- Type Icon -->
                <div :class="[
                  'p-2 rounded-lg flex-shrink-0',
                  result.type === 'bookmark' 
                    ? 'bg-blue-100 dark:bg-blue-900' 
                    : 'bg-green-100 dark:bg-green-900'
                ]">
                  <svg v-if="result.type === 'bookmark'" class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  <svg v-else class="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>

                <!-- Content -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-0.5">
                    <span :class="[
                      'text-xs px-1.5 py-0.5 rounded-full',
                      result.type === 'bookmark'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                        : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                    ]">
                      {{ result.type === 'bookmark' ? 'Bookmark' : 'Note' }}
                    </span>
                    <span v-if="result.type === 'bookmark' && result.source_domain" class="text-xs text-gray-400">
                      {{ result.source_domain }}
                    </span>
                  </div>
                  <p class="text-sm font-medium text-gray-900 dark:text-white truncate" v-html="result.title"></p>
                  <p v-if="result.description" class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5" v-html="result.description"></p>
                </div>

                <!-- Tags for bookmarks -->
                <div v-if="result.type === 'bookmark' && result.tags && result.tags.length > 0" class="flex gap-1 flex-shrink-0">
                  <span 
                    v-for="tag in result.tags.slice(0, 2)" 
                    :key="tag"
                    class="px-1.5 py-0.5 text-xs rounded-full"
                    :style="{ backgroundColor: getTagColor(tag).bg, color: getTagColor(tag).text }"
                  >
                    {{ tag }}
                  </span>
                </div>

                <!-- Arrow indicator -->
                <svg v-if="selectedIndex === index" class="w-4 h-4 text-primary-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <!-- No Results -->
            <div v-else-if="searchQuery && !loading" class="p-8 text-center">
              <svg class="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p class="text-gray-500 dark:text-gray-400 mb-4">No results found</p>
              
              <!-- Action Buttons -->
              <div class="flex justify-center gap-3">
                <button 
                  @click="addAsBookmark" 
                  class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  Add as Bookmark
                </button>
                <button 
                  @click="addAsNote" 
                  class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Add as Note
                </button>
              </div>
            </div>

            <!-- Empty State -->
            <div v-else class="p-8 text-center">
              <p class="text-gray-500 dark:text-gray-400">Start typing to search...</p>
            </div>
          </div>

          <!-- Footer -->
          <div class="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <div class="flex gap-4">
              <span><kbd class="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">↑</kbd><kbd class="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded ml-0.5">↓</kbd> Navigate</span>
              <span><kbd class="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">Enter</kbd> Open</span>
            </div>
            <span><kbd class="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">Esc</kbd> Close</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { useTagSystem } from '~/composables/useTagSystem'

interface SearchResult {
  id: string
  type: 'bookmark' | 'note'
  title: string
  description: string | null
  source_domain?: string | null
  tags?: string[]
  url?: string
}

const router = useRouter()
const { getTagColor } = useTagSystem()

const isOpen = ref(false)
const searchQuery = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)
const results = ref<SearchResult[]>([])
const loading = ref(false)
const selectedIndex = ref(0)

let debounceTimeout: NodeJS.Timeout | null = null

// Open the search modal
function open() {
  isOpen.value = true
  searchQuery.value = ''
  results.value = []
  selectedIndex.value = 0
  nextTick(() => {
    searchInputRef.value?.focus()
  })
}

// Close the search modal
function close() {
  isOpen.value = false
  searchQuery.value = ''
  results.value = []
}

// Perform search
async function performSearch() {
  if (!searchQuery.value.trim()) {
    results.value = []
    loading.value = false
    return
  }

  loading.value = true

  try {
    const query = searchQuery.value.toLowerCase()

    // Search locally first (instant)
    const { getAllBookmarks } = useIdb()
    const { getAllNotes } = useIdb()

    const [bookmarks, notes] = await Promise.all([
      getAllBookmarks(),
      getAllNotes(),
    ])

    // Filter bookmarks
    const bookmarkResults: SearchResult[] = bookmarks
      .filter(b =>
        b.title?.toLowerCase().includes(query) ||
        b.description?.toLowerCase().includes(query) ||
        b.source_domain?.toLowerCase().includes(query) ||
        b.tags?.some(t => t.toLowerCase().includes(query))
      )
      .slice(0, 5)
      .map(b => ({
        id: b.id,
        type: 'bookmark' as const,
        title: b.title,
        description: b.description,
        source_domain: b.source_domain,
        tags: b.tags,
      }))

    // Filter notes
    const noteResults: SearchResult[] = notes
      .filter(n =>
        n.title?.toLowerCase().includes(query) ||
        n.content?.toLowerCase().includes(query) ||
        n.tags?.some(t => t.toLowerCase().includes(query))
      )
      .slice(0, 5)
      .map(n => ({
        id: n.id,
        type: 'note' as const,
        title: n.title,
        description: n.content ? n.content.substring(0, 100) + (n.content.length > 100 ? '...' : '') : null,
      }))

    results.value = [...bookmarkResults, ...noteResults]
    selectedIndex.value = 0
  } catch (e) {
    console.error('Search failed:', e)
    results.value = []
  } finally {
    loading.value = false
  }
}

// Watch search query
watch(searchQuery, () => {
  selectedIndex.value = 0

  if (debounceTimeout) {
    clearTimeout(debounceTimeout)
  }

  if (!searchQuery.value.trim()) {
    results.value = []
    loading.value = false
    return
  }

  loading.value = true

  debounceTimeout = setTimeout(() => {
    performSearch()
  }, 150)
})

// Navigate down
function navigateDown() {
  if (results.value.length > 0) {
    selectedIndex.value = Math.min(selectedIndex.value + 1, results.value.length - 1)
  }
}

// Navigate up
function navigateUp() {
  if (results.value.length > 0) {
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
  }
}

// Select current result
function selectCurrent() {
  const current = results.value[selectedIndex.value]
  if (results.value.length > 0 && current) {
    selectResult(current)
  }
}

// Select a result
function selectResult(result: SearchResult) {
  close()

  if (result.type === 'bookmark') {
    router.push(`/bookmarks/${result.id}`)
  } else {
    // Navigate directly to the note page
    router.push(`/notes/${result.id}`)
  }
}

// Global keyboard shortcut
function handleKeydown(e: KeyboardEvent) {
  // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    if (isOpen.value) {
      close()
    } else {
      open()
    }
  }
}

// Listen for keyboard shortcut
onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

// Expose open function
defineExpose({ open })

// Add as bookmark - save current search query as a URL
async function addAsBookmark() {
  const url = searchQuery.value.trim()
  if (!url) return
  
  close()
  
  const dataStore = useDataStore()
  const bookmark = await dataStore.createBookmark(url)
  
  if (bookmark) {
    router.push(`/bookmarks/${bookmark.id}`)
  }
}

// Add as note - create a new note with the search query as title
async function addAsNote() {
  const title = searchQuery.value.trim()
  if (!title) return
  
  close()
  
  const dataStore = useDataStore()
  const note = await dataStore.createNote({
    content: `# ${title}\n\n`,
    tags: [],
    isFavorite: false,
  })
  
  if (note) {
    router.push(`/notes/${note.id}`)
  }
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-active > div,
.fade-leave-active > div {
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.fade-enter-from > div,
.fade-leave-to > div {
  transform: scale(0.95);
  opacity: 0;
}
</style>
