<template>
  <div class="max-w-4xl mx-auto">
    <StickyToolbar v-if="!isNew && !editing" show-back back-label="Back to notes" back-to="/notes"
      :actions="toolbarActions" />

    <!-- Simple back button for new/editing mode -->
    <div v-else class="flex items-center mb-4">
      <button @click="handleBack" class="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
        :title="isNew ? 'Back to notes' : 'Cancel'">
        <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
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

    <!-- Note View/Edit -->
    <div v-else-if="note || isNew">
      <!-- Header -->
      <div class="mb-6">
        <!-- Title -->
        <div class="mb-4">
          <!-- View mode title (existing note, not editing) -->
          <div v-if="!isNew && !editing" @click="startEditing" class="group cursor-pointer">
            <h1 class="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors">
              {{ note?.title }}
            </h1>
          </div>
          <!-- Editor mode title (new or editing) -->
          <input v-else v-model="editorTitle" type="text" :placeholder="titlePlaceholder"
            class="w-full text-2xl md:text-3xl font-bold bg-transparent border-b-2 border-transparent focus:border-primary-500 focus:outline-none text-gray-900 dark:text-white placeholder-gray-400"
            @keydown.enter="saveNote" />
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
        <!-- Edit/Preview Toggle -->
        <div class="flex border-b border-gray-200 dark:border-gray-700">
          <button @click="showPreview = false" class="px-4 py-2 text-sm font-medium transition-colors" :class="!showPreview
            ? 'text-primary-600 border-b-2 border-primary-600'
            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'">
            Edit
          </button>
          <button @click="showPreview = true" class="px-4 py-2 text-sm font-medium transition-colors" :class="showPreview
            ? 'text-primary-600 border-b-2 border-primary-600'
            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'">
            Preview
          </button>
        </div>

        <!-- Content Area -->
        <div class="min-h-[300px]">
          <!-- Editor -->
          <div v-if="!showPreview" class="p-4">
            <textarea v-model="editorContent" placeholder="Write your markdown here..."
              class="w-full h-full min-h-[300px] resize-none bg-transparent border-none focus:outline-none font-mono text-sm text-gray-900 dark:text-white"
              autofocus></textarea>
          </div>

          <!-- Preview -->
          <div v-else class="p-4">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">{{ displayTitle }}</h2>
            <div class="prose dark:prose-invert max-w-none reader-content" v-html="renderedPreview"></div>
          </div>
        </div>

        <!-- Tags Section - Only shown when editing (not preview) -->
        <div v-if="!showPreview" class="border-t border-gray-200 dark:border-gray-700 p-4">
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

        <!-- Footer -->
        <div class="flex justify-between items-center p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div class="text-sm text-gray-500 dark:text-gray-400">
            {{ editorWordCount }} words
          </div>
          <div class="flex gap-2">
            <button v-if="!isNew && editing" @click="cancelEditing" class="btn-secondary">Cancel</button>
            <button @click="saveNote" class="btn-primary" :disabled="saving || (!isNew && editing && !hasChanges) || (!isNew && !editorTitle.trim())">
              {{ saving ? 'Saving...' : (isNew ? 'Save' : (hasChanges ? 'Save' : 'Saved')) }}
            </button>
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
import { formatDate } from '~/utils/date'
import { useTags } from '~/composables/useTags'

const route = useRoute()
const router = useRouter()
const { getNoteById, createNote, updateNote, deleteNote: deleteNoteFn, toggleFavorite: toggleFavoriteFn } = useOfflineNotes()
const { render } = useMarkdown()
const { getTagColor, loadAllTags } = useTagColors()
const { tags, getAllTags, handleCreateTag } = useTags()

// State
const note = ref<Note | null>(null)
const loading = ref(true)
const editing = ref(false)
const showPreview = ref(false)
const editorTitle = ref('')
const editorContent = ref('')
const editorTags = ref<string[]>([])
const newTag = ref('')
const saving = ref(false)

// Determine mode - use isNew computed property
const isNew = computed(() => route.params.id === 'new')

// Title placeholder for new notes
const titlePlaceholder = computed(() => {
  const today = new Date()
  const formatted = today.toISOString().split('T')[0]
  return `Untitled ${formatted}`
})

// Display title (for preview)
const displayTitle = computed(() => {
  if (isNew.value) {
    return editorTitle.value || titlePlaceholder.value
  }
  return editorTitle.value || 'Untitled'
})

// Computed properties
const renderedMarkdown = computed(() => render(note.value?.content || ''))
const renderedPreview = computed(() => render(editorContent.value))

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
  if (!note.value) return editorTitle.value.trim() || editorContent.value.trim()
  return editorTitle.value !== note.value.title ||
    editorContent.value !== note.value.content ||
    JSON.stringify(editorTags.value) !== JSON.stringify(note.value.tags || [])
})

// Suggested tags based on all available tags minus current editor tags
const suggestedTags = computed(() => {
  return tags.value
    .map(t => t.name)
    .filter(tag => !editorTags.value.includes(tag))
    .slice(0, 5)
})

// Initialize editor state for new note
function initNewNote() {
  editorTitle.value = ''
  editorContent.value = ''
  editorTags.value = []
  newTag.value = ''
  showPreview.value = false
  editing.value = true
  note.value = null
}

// Initialize editor state from existing note
function initFromNote() {
  if (note.value) {
    editorTitle.value = note.value.title
    editorContent.value = note.value.content
    editorTags.value = [...(note.value.tags || [])]
  }
  newTag.value = ''
  showPreview.value = false
}

// Load existing note
async function loadNote() {
  loading.value = true

  // Load tags first so colors are available
  await getAllTags(true)

  const id = route.params.id as string
  note.value = await getNoteById(id)
  loading.value = false

  if (note.value) {
    initFromNote()
  }
}

function startEditing() {
  editing.value = true
  showPreview.value = false
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
  if (!editorTitle.value.trim()) return

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
        title: editorTitle.value,
        content: editorContent.value,
        tags: editorTags.value,
      })

      if (noteToSave) {
        router.replace(`/notes/${noteToSave.id}`)
      }
    } else if (note.value) {
      // Update existing note
      await updateNote(note.value.id, {
        title: editorTitle.value,
        content: editorContent.value,
        tags: editorTags.value,
      })

      // Update local note
      note.value = {
        ...note.value,
        title: editorTitle.value,
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

  if (confirm(`Delete "${note.value.title}"?`)) {
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
    icon: 'trash' as const,
    title: 'Delete note',
    variant: 'danger' as const,
    handler: () => deleteNoteConfirm(),
  },
])

onMounted(async () => {
  await getAllTags(true)
  loadAllTags(true)
})
</script>
