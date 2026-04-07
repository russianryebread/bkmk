<template>
  <div>
    <InfiniteItemList
      :items="items"
      :loading="loading"
      :loading-more="loadingMore"
      :has-more="hasMore"
      :error="error"
      :available-tags="allTags"
      :selected-tag="selectedTag"
      search-placeholder="Search notes... (Press / to focus)"
      empty-title="No notes yet"
      empty-description="Create your first markdown note"
      @search="handleSearch"
      @tag-change="handleTagChange"
      @load-more="loadMore"
      @retry="reset"
    >
      <!-- Add button -->
      <template #actions>
        <button @click="router.push('/notes/new')" class="btn-primary">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </template>

      <!-- Empty state override -->
      <template #empty>
        <svg class="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No notes yet</h3>
        <p class="text-gray-500 dark:text-gray-400 mb-4">Create your first markdown note</p>
        <button @click="router.push('/notes/new')" class="btn-primary">Create Note</button>
      </template>

      <!-- Card view slot -->
      <template #card="{ item }">
        <div
          class="card p-4 hover:shadow-md transition-shadow cursor-pointer"
          @click="openNote(item)"
        >
          <div class="flex justify-between items-start mb-2">
            <h3 class="font-medium text-gray-900 dark:text-white">{{ deriveTitle(item.content) }}</h3>
            <div>
              <button @click.stop="toggleFavorite(item)" class="p-1">
                <svg class="w-5 h-5"
                  :class="item.isFavorite ? 'text-yellow-500 fill-current' : 'text-gray-400 hover:text-yellow-300'"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>
              <button @click.stop="deleteNoteConfirm(item)" class="p-1 text-gray-400 hover:text-red-600 flex-shrink-0">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Tags display -->
          <div v-if="item.tags && item.tags.length > 0" class="flex flex-wrap gap-1 mb-2">
            <span v-for="tag in item.tags" :key="tag" class="px-2 py-0.5 text-xs rounded-full"
              :style="{ backgroundColor: getTagColor(tag).bg, color: getTagColor(tag).text }">
              {{ tag }}
            </span>
          </div>

          <p class="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 mb-2 font-mono">
            {{ item.content }}
          </p>

          <div class="text-xs text-gray-400">
            Updated {{ formatDate(item.updatedAt) }}
          </div>
        </div>
      </template>

      <!-- List view slot -->
      <template #list="{ item }">
        <div
          class="card p-4 hover:shadow-md transition-shadow cursor-pointer flex items-center gap-4"
          @click="openNote(item)"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="font-medium text-gray-900 dark:text-white truncate">{{ deriveTitle(item.content) }}</h3>
              <button @click.stop="toggleFavorite(item)" class="p-1 flex-shrink-0">
                <svg class="w-4 h-4" :class="item.isFavorite ? 'text-yellow-500 fill-current' : 'text-gray-400'"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>
            </div>
            <div class="flex items-center text-sm text-gray-500 dark:text-gray-400">
              <span class="truncate font-mono">{{ item.content?.slice(0, 80) }}...</span>
            </div>
          </div>
          <div class="flex gap-2 flex-shrink-0">
            <button @click.stop="deleteNoteConfirm(item)" class="p-1 text-gray-400 hover:text-red-600">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </template>
    </InfiniteItemList>
  </div>
</template>

<script setup lang="ts">
import type { Note } from '~/composables/idb'
import { useOfflineNotes } from '~/composables/useOfflineNotes'
import { useTagSystem } from '~/composables/useTagSystem'
import { deriveTitle } from '~/composables/idb'
import { formatDate } from '~/utils/date'

const router = useRouter()
const offlineNotes = useOfflineNotes()
const { getTagColor, fetchTags, getTagsByType } = useTagSystem()
const { triggerSync } = useSync()

// Get all tags filtered by type (note tags only)
const allTags = computed(() => getTagsByType('note'))

// Infinite scroll state
const cursor = ref<string | null>(null)
const items = ref<Note[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const error = ref<string | null>(null)
const hasMore = ref(true)
const filters = ref({
  search: '',
  tag: '',
  favorite: false,
})

const selectedTag = computed(() => filters.value.tag)

// Load notes with cursor-based pagination
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
    const result = await offlineNotes.getNotesPaginated(
      isRefresh ? null : cursor.value,
      {
        search: filters.value.search || undefined,
        tag: filters.value.tag || undefined,
        favorite: filters.value.tag === 'favorite' ? true : undefined,
        sort: 'updatedAt',
        order: 'desc',
      }
    )

    if (isRefresh) {
      items.value = result.notes
    } else {
      items.value = [...items.value, ...result.notes]
    }

    cursor.value = result.nextCursor
    hasMore.value = result.hasMore
  } catch (e: any) {
    error.value = e.message || 'Failed to load notes'
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
  reset()
}

// Handle tag change
function handleTagChange(tag: string | null) {
  filters.value.tag = tag || ''
  reset()
}

// Toggle favorite
async function toggleFavorite(note: Note) {
  await offlineNotes.toggleFavorite(note.id)
  // Update local state
  const index = items.value.findIndex(n => n.id === note.id)
  if (index !== -1) {
    items.value[index] = { ...items.value[index], isFavorite: !note.isFavorite }
  }
}

// Delete note
async function deleteNoteConfirm(note: Note) {
  if (confirm(`Delete "${deriveTitle(note.content)}"?`)) {
    await offlineNotes.deleteNote(note.id)
    items.value = items.value.filter(n => n.id !== note.id)
  }
}

// Open note
function openNote(note: Note) {
  router.push(`/notes/${note.id}`)
}

onMounted(async () => {
  await fetchTags()
  loadMore(true)

  // Listen for online status to refresh data when coming back online
  window.addEventListener('online', () => {
    console.log('[Notes] Back online, triggering full sync...')
    triggerSync()
  })
})
</script>
