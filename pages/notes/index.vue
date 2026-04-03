<template>
  <div>
    <!-- Header -->
    <!-- Header with actions -->
    <div class="flex flex-col sm:flex-row gap-4 mb-6">
      <!-- Search -->
      <div class="flex-1">
        <div class="relative">
          <input ref="searchInputRef" v-model="searchQuery" type="text"
            placeholder="Search notes... (Press / to focus)" class="input pl-10 pr-24" @input="handleSearch" />
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor"
            viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex gap-2">
        <ViewToggle />
        <button @click="router.push('/notes/new')" class="btn-primary">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>

    <div class="mb-4">
      <TagFilter
        :tags="allTags"
        :selected-tag="filterTag"
        @update:selected-tag="filterTag = $event"
      />
    </div>

    <!-- Notes List -->
    <div v-if="loading" class="flex justify-center py-12">
      <svg class="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
        </path>
      </svg>
    </div>

    <div v-else-if="notes.length === 0" class="card p-12 text-center">
      <svg class="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No notes yet</h3>
      <p class="text-gray-500 dark:text-gray-400 mb-4">Create your first markdown note</p>
      <button @click="router.push('/notes/new')" class="btn-primary">Create Note</button>
    </div>

    <div v-else>
      <!-- Card View -->
      <div v-if="viewMode === 'card'" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div v-for="note in filteredNotes" :key="note.id"
          class="card p-4 hover:shadow-md transition-shadow cursor-pointer" @click="openNote(note)">
          <div class="flex justify-between items-start mb-2">
            <h3 class="font-medium text-gray-900 dark:text-white">{{ note.title }}</h3>
            <div>
              <button @click.stop="toggleFavorite(note)" class="p-1">
                <svg class="w-5 h-5"
                  :class="note.isFavorite ? 'text-yellow-500 fill-current' : 'text-gray-400 hover:text-yellow-300'"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>
              <button @click.stop="deleteNoteConfirm(note)" class="p-1 text-gray-400 hover:text-red-600 flex-shrink-0">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Tags display -->
          <div v-if="note.tags && note.tags.length > 0" class="flex flex-wrap gap-1 mb-2">
            <span v-for="tag in note.tags" :key="tag" class="px-2 py-0.5 text-xs rounded-full"
              :style="{ backgroundColor: getTagColor(tag).bg, color: getTagColor(tag).text }">
              {{ tag }}
            </span>
          </div>

          <p class="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 mb-2 font-mono">
            {{ note.content }}
          </p>

          <div class="text-xs text-gray-400">
            Updated {{ formatDate(note.updatedAt) }}
          </div>
        </div>
      </div>

      <!-- List View -->
      <div v-else class="space-y-2">
        <div v-for="note in filteredNotes" :key="note.id"
          class="card p-4 hover:shadow-md transition-shadow cursor-pointer flex items-center gap-4"
          @click="openNote(note)">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="font-medium text-gray-900 dark:text-white truncate">{{ note.title }}</h3>
              <button @click.stop="toggleFavorite(note)" class="p-1 flex-shrink-0">
                <svg class="w-4 h-4" :class="note.isFavorite ? 'text-yellow-500 fill-current' : 'text-gray-400'"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>
            </div>
            <div class="flex items-center text-sm text-gray-500 dark:text-gray-400">
              <span class="truncate font-mono">{{ note.content?.slice(0, 80) }}...</span>
            </div>
          </div>
          <div class="flex gap-2 flex-shrink-0">
            <button @click.stop="deleteNoteConfirm(note)" class="p-1 text-gray-400 hover:text-red-600">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useOfflineNotes } from '~/composables/useOfflineNotes'
import { useTagSystem, type TagType } from '~/composables/useTagSystem'
import type { Note } from '~/composables/idb'
import { formatDate } from '~/utils/date'

const router = useRouter()
const offlineNotes = useOfflineNotes()
const { viewMode } = useViewMode()

const {
  tags,
  getTagColor,
  fetchTags,
  getTagsByType,
} = useTagSystem()

async function loadAllTags(forceRefresh = false) {
  await fetchTags(forceRefresh)
}

async function getAllTags(forceRefresh = false) {
  await fetchTags(forceRefresh)
}

// Get all tags filtered by type (note tags only)
const allTags = computed(() => {
  return getTagsByType('note')
})

const notes = ref<Note[]>([])
const loading = ref(true)
const filterTag = ref('')
const searchQuery = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)

async function loadNotes() {
  loading.value = true
  try {
    notes.value = await offlineNotes.getNotes({ tag: filterTag.value || undefined })
  } catch (e) {
    console.error('Failed to load notes:', e)
  } finally {
    loading.value = false
  }
}

async function toggleFavorite(note: Note) {
  await offlineNotes.toggleFavorite(note.id)
  note.isFavorite = !note.isFavorite
}

async function deleteNoteConfirm(note: Note) {
  if (confirm(`Delete "${note.title}"?`)) {
    await offlineNotes.deleteNote(note.id)
    notes.value = notes.value.filter(n => n.id !== note.id)
  }
}

// Filter notes based on search query
const filteredNotes = computed(() => {
  if (!searchQuery.value.trim()) return notes.value

  const query = searchQuery.value.toLowerCase()
  return notes.value.filter(note =>
    note.title.toLowerCase().includes(query) ||
    note.content.toLowerCase().includes(query) ||
    note.tags?.some(tag => tag.toLowerCase().includes(query))
  )
})

function handleSearch() {
  // Search is handled by computed property
}

function openNote(note: Note) {
  router.push(`/notes/${note.id}`)
}

// Watch for filter changes
watch(filterTag, () => {
  loadNotes()
})

onMounted(async () => {
  await getAllTags()
  loadNotes()

  // Focus search on mount
  nextTick(() => {
    searchInputRef.value?.focus()
  })

  // Listen for online status to refresh data when coming back online
  window.addEventListener('online', () => {
    console.log('[Notes] Back online, refreshing data...')
    loadNotes()
    getAllTags(true)
  })

  // Listen for '/' key to focus search
  const handleGlobalKeydown = (e: KeyboardEvent) => {
    if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
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
