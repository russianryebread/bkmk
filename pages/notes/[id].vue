<template>
  <div class="max-w-4xl mx-auto">
    <StickyToolbar v-if="!isNew && !editing" show-back back-label="Back to notes" back-to="/notes"
      :actions="toolbarActions" />

    <!-- Simple back button for new/editing mode -->
    <div v-else class="flex mb-4">
      <div class="flex-1">
        <button @click="handleBack" class="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
          :title="isNew ? 'Back to notes' : 'Cancel'">
          <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <div class="flex gap-4">
        <button v-if="!isNew && editing" @click="cancelEditing" class="btn-tertiary">Cancel</button>
        <button @click="saveNote" class="btn-primary"
          :disabled="saving || (!isNew && editing && !hasChanges) || (!isNew && !editorContent.trim())">
          {{ saving ? 'Saving...' : (isNew ? 'Save' : (hasChanges ? 'Save' : 'Saved')) }}
        </button>
      </div>
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

    <!-- Note View/Edit -->
    <div v-else-if="note || isNew">
      <!-- Header -->
      <div class="mb-6">
        <!-- Title - derived from first line of content -->
        <div class="mb-4">
          <h1 v-if="!isNew && !editing" class="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
            {{ deriveTitle(note?.content) }}
          </h1>
        </div>

        <!-- Metadata and tags (view mode - existing note) -->
        <template v-if="!isNew && !editing">
          <div class="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4">
            <span>Updated {{ formatDate(note?.updatedAt) }}</span>
            <span class="mx-2">•</span>
            <span>{{ wordCount }} words</span>
          </div>

          <div v-if="note?.tags && note.tags.length > 0" class="flex flex-wrap gap-2">
            <span v-for="tag in note.tags" :key="tag" class="px-2.5 py-0.5 text-xs rounded-full"
              :style="{ backgroundColor: getTagColor(tag).bg, color: getTagColor(tag).text }">
              {{ tag }}
            </span>
          </div>
        </template>

        <!-- Editor tags display (new or editing) -->
        <div v-else-if="editorTags.length > 0" class="flex flex-wrap gap-2 mb-4">
          <span v-for="tag in editorTags" :key="tag"
            class="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs rounded-full"
            :style="{ backgroundColor: getTagColor(tag).bg, color: getTagColor(tag).text }">
            {{ tag }}
            <button @click="removeTag(tag)" class="hover:opacity-75">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        </div>
      </div>

      <!-- View mode content (existing note, not editing) -->
      <template v-if="!isNew && !editing">
        <hr>
        <div class="prose dark:prose-invert max-w-none reader-content" v-html="renderedMarkdown"></div>
      </template>

      <!-- Editor mode (new or editing) -->
      <div v-else class="card">
        <!-- Content Area -->
        <div class="min-h-[300px]">
          <textarea v-model="editorContent" placeholder="Write your markdown here..."
            class="w-full h-full min-h-[300px] resize-none bg-transparent border-none focus:outline-none font-mono text-sm text-gray-900 dark:text-white p-4"
            autofocus></textarea>
        </div>

        <!-- Footer -->
        <div class="flex justify-between items-center p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div class="text-sm text-gray-500 dark:text-gray-400">
            {{ editorWordCount }} words
          </div>

          <!-- Tags Section -->
          <div class="">
            <div class="flex items-center gap-3 flex-wrap">
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300 flex-shrink-0">Tags:</span>

              <!-- Current tags -->
              <div class="flex flex-wrap gap-1 items-center">
                <span v-for="tag in editorTags" :key="tag"
                  class="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full flex-shrink-0"
                  :style="{ backgroundColor: getTagColor(tag).bg, color: getTagColor(tag).text }">
                  {{ tag }}
                  <button @click="removeTag(tag)" class="hover:opacity-75">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
                <span v-if="editorTags.length === 0" class="text-xs text-gray-400">No tags</span>
              </div>

              <div class="w-px h-4 bg-gray-300 dark:bg-gray-600 flex-shrink-0"></div>

              <!-- Tag input -->
              <div class="relative">
                <input v-model="newTag" type="text" placeholder="Add tag..."
                  class="w-32 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary-500 focus:border-transparent"
                  @keydown.enter.prevent="addTag" @keydown.comma.prevent="addTag" />
              </div>
              <button @click="addTag" :disabled="!newTag.trim()"
                class="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed">
                Add
              </button>

              <!-- Suggested tags -->
              <div v-if="suggestedTags.length > 0" class="flex items-center gap-1">
                <span class="text-xs text-gray-400 flex-shrink-0">Sug:</span>
                <button v-for="tag in suggestedTags" :key="tag" @click="addSuggestedTag(tag)"
                  class="px-1.5 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600">
                  {{ tag }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Error: Note not found -->
    <div v-else class="text-center py-12">
      <p class="text-gray-500 dark:text-gray-400">Note not found</p>
      <NuxtLink to="/notes" class="btn-primary mt-4">Go Back</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Note } from '~/composables/idb'
import { deriveTitle } from '~/composables/idb'
import { formatDate } from '~/utils/date'
import { useTagSystem, type TagType } from '~/composables/useTagSystem'

const route = useRoute()
const router = useRouter()
const { getNoteById, createNote, updateNote, deleteNote: deleteNoteFn, toggleFavorite: toggleFavoriteFn } = useOfflineNotes()
const { render } = useMarkdown()

const {
  tags,
  getTagColor,
  fetchTags,
  createTag,
  syncItemTags,
} = useTagSystem()

async function loadAllTags(forceRefresh = false) {
  await fetchTags(forceRefresh)
}

async function getAllTags(forceRefresh = false) {
  await fetchTags(forceRefresh)
}

async function handleCreateTag(name: string) {
  await createTag({ name })
}

// State
const note = ref<Note | null>(null)
const loading = ref(true)
const tagsLoading = ref(true)
const editing = ref(false)
const showPreview = ref(false)
const editorContent = ref('')
const editorTags = ref<string[]>([])
const newTag = ref('')
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

// Suggested tags based on all available tags minus current editor tags
const suggestedTags = computed(() => {
  return tags.value
    .filter(t => t.type === 'note' || t.type === 'both')
    .map(t => t.name)
    .filter(tag => !editorTags.value.includes(tag))
    .slice(0, 5)
})

// Initialize editor state for new note
function initNewNote() {
  editorContent.value = ''
  editorTags.value = []
  newTag.value = ''
  editing.value = true
  note.value = null
}

// Initialize editor state from existing note
function initFromNote() {
  if (note.value) {
    editorContent.value = note.value.content
    editorTags.value = [...(note.value.tags || [])]
  }
  newTag.value = ''
}

// Load existing note - instant from local, then sync in background
async function loadNote() {
  loading.value = true

  const id = route.params.id as string
  
  // Load from local cache FIRST - this is instant from IndexedDB
  const localNote = await getNoteById(id)
  note.value = localNote
  loading.value = false

  if (note.value) {
    initFromNote()
  }

  // Now load tags in background (non-blocking)
  getAllTags(false).then(() => {
    tagsLoading.value = false
  }).catch(() => {
    tagsLoading.value = false
  })
}

function startEditing() {
  editing.value = true
  initFromNote()
}

function cancelEditing() {
  editing.value = false
  initFromNote()
}

function handleBack() {
  if (isNew.value || editing.value) {
    // If creating or editing, go back to notes list
    router.push('/notes')
  } else {
    // Otherwise just stop editing
    cancelEditing()
  }
}

// Unified save logic - handles both create and update
async function saveNote() {
  if (!editorContent.value.trim()) return

  saving.value = true

  try {
    // Handle tag creation for any new tags
    const newTags = editorTags.value.filter(tag => !tags.value.find(t => t.name.toLowerCase() === tag.toLowerCase()))
    for (const tagName of newTags) {
      await handleCreateTag(tagName)
    }

    if (isNew.value) {
      // Create new note
      const noteToSave = await createNote({
        content: editorContent.value,
        tags: editorTags.value,
      })

      if (noteToSave) {
        router.replace(`/notes/${noteToSave.id}`)
      }
    } else if (note.value) {
      // Update existing note
      await updateNote(note.value.id, {
        content: editorContent.value,
        tags: editorTags.value,
      })

      // Update local note
      note.value = {
        ...note.value,
        content: editorContent.value,
        tags: editorTags.value,
        updatedAt: new Date().toISOString(),
      }

      editing.value = false
      loadAllTags(true) // Refresh tags
    }
  } catch (e) {
    console.error('Failed to save note:', e)
  } finally {
    saving.value = false
  }
}

async function toggleFavorite() {
  if (!note.value) return
  await toggleFavoriteFn(note.value.id)
  note.value.isFavorite = !note.value.isFavorite
}

async function deleteNoteConfirm() {
  if (!note.value) return

  if (confirm(`Delete "${deriveTitle(note.value.content)}"?`)) {
    await deleteNoteFn(note.value.id)
    router.push('/notes')
  }
}

// Unified tag management functions
function addTag() {
  const tag = newTag.value.trim()
  if (tag && !editorTags.value.includes(tag)) {
    editorTags.value.push(tag)
  }
  newTag.value = ''
}

function addSuggestedTag(tag: string) {
  if (!editorTags.value.includes(tag)) {
    editorTags.value.push(tag)
  }
}

function removeTag(tag: string) {
  editorTags.value = editorTags.value.filter(t => t !== tag)
}

// Watch for route changes to reload data
watch(() => route.params.id, async (newId) => {
  if (newId === 'new') {
    initNewNote()
    loading.value = false
  } else {
    await loadNote()
  }
}, { immediate: true })

// Toolbar actions for the sticky toolbar
const toolbarActions = computed(() => [
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
    icon: 'tag' as const,
    title: 'Manage tags',
    handler: () => { editing.value = true; initFromNote() },
  },
  {
    icon: 'trash' as const,
    title: 'Delete note',
    variant: 'danger' as const,
    handler: () => deleteNoteConfirm(),
  },
])

onMounted(() => {
  // Tags are loaded in background by loadNote() - no need to block here
})

onBeforeRouteLeave((to, from) => {
  if (editing.value && hasChanges.value) {
    return confirm('You have unsaved changes. Are you sure you want to leave?')
  }
})
</script>
