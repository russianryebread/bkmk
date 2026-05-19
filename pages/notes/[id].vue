<template>
  <div class="min-h-[calc(var(--dvh)-100px)] md:min-h-[calc(var(--dvh)-156px)] flex flex-col">
    <StickyToolbar v-if="!isNew && !editing" show-back back-label="Back to notes" back-to="/notes"
      :title="deriveTitle(note?.content)" :actions="toolbarActions" />

    <!-- Simple back button for new/editing mode -->
    <div v-else class="flex mb-4">
      <div class="flex-1">
        <button @click="cancelEditing"
          class="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all action-button"
          :title="isNew ? 'Back to notes' : 'Cancel'">
          <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <div class="flex gap-4">
        <button @click="saveNote"
          class="text-green-500 disabled:text-gray-500 p-2 rounded-xl flex items-center justify-center action-button"
          :disabled="saving || (!isNew && editing && !hasChanges) || (!isNew && !editorContent.trim())">
          <span v-if="saving"
            class="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></span>
          <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" key="loading" class="flex justify-center py-12">
      <svg class="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
        </path>
      </svg>
    </div>

    <!-- Note View/Edit -->
    <div v-else-if="note || isNew" key="content" class="flex-1 flex flex-col">

      <!-- Metadata and tags (view mode - existing note) -->
      <template v-if="!isNew && !editing">
        <div class="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4">
          <span>Updated {{ formatDate(note?.updatedAt) }}</span>
          <span class="mx-2">•</span>
          <span>{{ wordCount }} words</span>
        </div>

        <div v-if="note?.tags && note.tags.length > 0" class="flex flex-wrap gap-2 mb-4">
          <span v-for="tag in note.tags" :key="tag" class="px-2.5 py-0.5 text-xs rounded-full"
            :style="{ backgroundColor: getTagColor(tag).bg, color: getTagColor(tag).text }">
            {{ tag }}
          </span>
        </div>
      </template>

      <!-- View mode content (existing note, not editing) -->
      <template v-if="!isNew && !editing">
        <hr class="mb-4 border-gray-200 dark:border-gray-700" />
        <div class="prose dark:prose-invert max-w-none reader-content" v-html="renderedMarkdown"></div>
      </template>

      <!-- Editor mode (new or editing) -->
      <div v-else class="md:card flex-1 flex flex-col min-h-0 -mt-6">
        <hr class="mb-4 border-gray-200 dark:border-gray-700" />
        <!-- Content Area -->
        <div class="flex-1 min-h-0 h-full">
          <textarea v-model="editorContent" placeholder="Write your markdown here..."
            class="w-full min-h-[calc(var(--dvh)-256px)] md:min-h-[calc(var(--dvh)-266px)] resize-none bg-transparent border-none focus:outline-none font-mono text-sm text-gray-900 dark:text-white p-4"
            autofocus enterkeyhint="default" inputmode="text"></textarea>
        </div>

        <!-- Footer -->
        <div
          class="flex justify-between items-center gap-8 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-b-xl">
          <div class="text-sm text-gray-500 dark:text-gray-400 hidden md:block">
            {{ editorWordCount }} words
          </div>

          <!-- Tags Section -->
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <TagInput
              v-model="editorTags"
              tag-type="note"
              placeholder="Add tag..."
              class="flex-1 min-w-[180px]"
              @createTag="handleCreateTag"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Error: Note not found -->
    <div v-else key="notfound" class="text-center py-12">
      <p class="text-gray-500 dark:text-gray-400">Note not found</p>
      <NuxtLink to="/notes" class="btn-primary mt-4">Go Back</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Action } from '~/utils/types'
import type { Note } from '~/composables/idb'
import { deriveTitle } from '~/composables/idb'
import { formatDate } from '~/utils/date'
import { useTagSystem } from '~/composables/useTagSystem'
import { useViewportHeight } from '~/composables/useViewportHeight'

const route = useRoute()
const router = useRouter()
const dataStore = useDataStore()
const { render } = useMarkdown()

const {
  getTagColor,
  createTag,
} = useTagSystem()

async function handleCreateTag(name: string) {
  await createTag({ name })
}

// State
const note = ref<Note | null>(null)
const loading = ref(true)
const editing = ref(false)
const editorContent = ref('')
const editorTags = ref<string[]>([])
const saving = ref(false)

// Determine mode - use isNew computed property
const isNew = computed(() => route.params.id === 'new')

// Computed properties
const renderedMarkdown = computed(() => render(note.value?.content || ''))

const wordCount = computed(() => {
  if (!note.value?.content) return 0
  return note.value.content.split(/\s+/).filter(w => w.length > 0).length
})

const editorWordCount = computed(() => {
  if (!editorContent.value) return 0
  return editorContent.value.split(/\s+/).filter(w => w.length > 0).length
})

// Check if there are unsaved changes
const hasChanges = computed(() => {
  if (!note.value) return editorContent.value.trim()
  return editorContent.value !== note.value.content ||
    JSON.stringify(editorTags.value) !== JSON.stringify(note.value.tags || [])
})

// Initialize editor state for new note
function initNewNote() {
  editorContent.value = ''
  editorTags.value = []
  editing.value = true
  note.value = null
}

// Initialize editor state from existing note
function initFromNote() {
  if (note.value) {
    editorContent.value = note.value.content
    editorTags.value = [...(note.value.tags || [])]
  }
}

// Load existing note - instant from local, then sync in background
async function loadNote() {
  loading.value = true

  const id = route.params.id as string

  // Load from data store - reads from IndexedDB first (instant)
  note.value = dataStore.getNoteById(id) ?? null
  loading.value = false

  if (note.value) {
    initFromNote()
  }
}

function startEditing() {
  editing.value = true
  initFromNote()
}

function cancelEditing() {
  if (hasChanges.value) {
    if (!confirm('You have unsaved changes. Are you sure you want to cancel?')) {
      return
    }
  }
  editing.value = false
  initFromNote()
}

// Unified save logic - handles both create and update
async function saveNote() {
  if (!editorContent.value.trim()) return

  saving.value = true

  try {
    if (isNew.value) {
      // Create new note
      const noteToSave = await dataStore.createNote({
        content: editorContent.value,
        tags: [ ...editorTags.value ],
      })

      if (noteToSave) {
        router.replace(`/notes/${noteToSave.id}`)
      }
    } else if (note.value) {
      // Update existing note
      await dataStore.updateNote(note.value.id, {
        content: editorContent.value,
        tags: [ ...editorTags.value ],
      })

      // Update local note
      note.value = {
        ...note.value,
        content: editorContent.value,
        tags: [ ...editorTags.value ],
        updatedAt: new Date().toISOString(),
      }

      editing.value = false
    }
  } catch (e) {
    console.error('Failed to save note:', e)
  } finally {
    saving.value = false
  }
}

async function toggleFavorite() {
  if (!note.value) return
  await dataStore.toggleNoteFavorite(note.value.id)
  note.value.isFavorite = !note.value.isFavorite
}

async function deleteNoteConfirm() {
  if (!note.value) return

  if (confirm(`Delete "${deriveTitle(note.value.content)}"?`)) {
    await dataStore.deleteNote(note.value.id)
    router.push('/notes')
  }
}

async function loadForRoute(id: string | string[] | undefined) {
  if (id === 'new') {
    initNewNote()
    loading.value = false
  } else {
    await loadNote()
  }
}

// Load on the client only. The note data lives in IndexedDB, so server-side
// rendering can never resolve it — running the load during SSR would render
// the "not found" branch and corrupt hydration. Both SSR and the first client
// render show the loading branch; the keyed branch swap then happens on mount.
onMounted(() => loadForRoute(route.params.id))

// Watch for route changes to reload data (client-side navigation between notes)
watch(() => route.params.id, (newId) => loadForRoute(newId))

// Toolbar actions for the sticky toolbar
const toolbarActions = computed<Action[]>(() => [
  {
    icon: 'heart' as const,
    title: note.value?.isFavorite ? 'Remove from favorites' : 'Add to favorites',
    active: note.value?.isFavorite,
    handler: () => toggleFavorite(),
  },
  {
    icon: 'edit' as const,
    title: 'Edit note',
    handler: () => startEditing(),
  },
  {
    icon: 'trash' as const,
    title: 'Delete note',
    variant: 'danger' as const,
    handler: () => deleteNoteConfirm(),
  },
])

useViewportHeight()

onBeforeRouteLeave((to, from) => {
  if (editing.value && hasChanges.value) {
    return confirm('You have unsaved changes. Are you sure you want to leave?')
  }
})
</script>
