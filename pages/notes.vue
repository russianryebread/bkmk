<template>
  <div>
    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Notes</h1>
      <div class="flex gap-2">
        <ViewToggle />
        <button @click="startNewNote" class="btn-primary">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Offline Indicator -->
    <div v-if="offlineNotes.isOnline.value === false" class="mb-4 p-3 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-lg text-sm">
      <span class="font-medium">Offline Mode:</span> Changes will sync when you're back online.
    </div>

    <!-- Error message -->
    <div v-if="offlineNotes.offlineError.value" class="mb-4 p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-lg text-sm">
      {{ offlineNotes.offlineError.value }}
    </div>

    <!-- Tag Filter -->
    <div v-if="allTags.length > 0" class="mb-4 flex flex-wrap gap-2">
      <button
        @click="filterTag = ''"
        class="px-3 py-1 text-sm rounded-full transition-colors"
        :class="filterTag === '' 
          ? 'bg-primary-600 text-white' 
          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'"
      >
        All
      </button>
      <button
        v-for="tag in allTags"
        :key="tag.name"
        @click="filterTag = tag.name"
        class="px-3 py-1 text-sm rounded-full transition-colors"
        :class="filterTag === tag.name 
          ? 'bg-primary-600 text-white' 
          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'"
      >
        {{ tag.name }}
      </button>
    </div>

    <!-- Notes List -->
    <div v-if="loading" class="flex justify-center py-12">
      <svg class="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>

    <div v-else-if="notes.length === 0" class="card p-12 text-center">
      <svg class="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No notes yet</h3>
      <p class="text-gray-500 dark:text-gray-400 mb-4">Create your first markdown note</p>
      <button @click="startNewNote" class="btn-primary">Create Note</button>
    </div>

    <div v-else>
      <!-- Card View -->
      <div v-if="viewMode === 'card'" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="note in notes"
          :key="note.id"
          class="card p-4 hover:shadow-md transition-shadow cursor-pointer"
          @click="editNote(note)"
        >
          <div class="flex justify-between items-start mb-2">
            <h3 class="font-medium text-gray-900 dark:text-white">{{ note.title }}</h3>
            <button
              @click.stop="toggleFavorite(note)"
              class="p-1"
            >
              <svg
                class="w-5 h-5"
                :class="note.isFavorite ? 'text-yellow-500 fill-current' : 'text-gray-400'"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>
          </div>
          
          <!-- Tags display -->
          <div v-if="note.tags && note.tags.length > 0" class="flex flex-wrap gap-1 mb-2">
            <span
              v-for="tag in note.tags"
              :key="tag"
              class="px-2 py-0.5 text-xs rounded-full"
              :style="{ backgroundColor: getTagColor(tag).bg, color: getTagColor(tag).text }"
            >
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
        <div
          v-for="note in notes"
          :key="note.id"
          class="card p-4 hover:shadow-md transition-shadow cursor-pointer flex items-center gap-4"
          @click="editNote(note)"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="font-medium text-gray-900 dark:text-white truncate">{{ note.title }}</h3>
              <button
                @click.stop="toggleFavorite(note)"
                class="p-1 flex-shrink-0"
              >
                <svg
                  class="w-4 h-4"
                  :class="note.isFavorite ? 'text-yellow-500 fill-current' : 'text-gray-400'"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>
            </div>
            <div class="flex items-center text-sm text-gray-500 dark:text-gray-400">
              <span class="truncate font-mono">{{ note.content?.slice(0, 80) }}...</span>
            </div>
          </div>
          <div class="flex gap-2 flex-shrink-0">
            <button
              @click.stop="deleteNoteConfirm(note)"
              class="p-1 text-gray-400 hover:text-red-600"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Editor Modal - Full Screen on Mobile -->
    <div v-if="showEditor" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-0 md:p-4">
      <div class="card w-full h-full md:h-auto md:max-h-[95vh] md:max-w-4xl flex flex-col">
        <!-- Header with Save button on top -->
        <div class="flex items-center justify-between p-3 md:p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gray-50 dark:bg-gray-800">
          <div class="flex items-center gap-2 flex-1">
            <button @click="closeEditor" class="p-2 -ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <input
              v-model="editorTitle"
              type="text"
              placeholder="Note title..."
              class="text-lg md:text-xl font-bold bg-transparent border-none focus:outline-none text-gray-900 dark:text-white flex-1 min-w-0"
            />
          </div>
          <button 
            v-if="hasChanges"
            @click="saveNote" 
            class="btn-primary text-sm py-1.5 md:text-base md:py-2"
            :disabled="saving || !editorTitle.trim()"
            :class="{ 'opacity-50 cursor-not-allowed': saving || !editorTitle.trim() }"
          >
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </div>
        
        <!-- Editor/Preview toggle and content -->
        <div class="flex-1 overflow-hidden flex flex-col min-h-0">
          <!-- Toggle buttons -->
          <div class="flex border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <button
              @click="showPreview = false"
              class="px-4 py-2 text-sm font-medium transition-colors"
              :class="!showPreview 
                ? 'text-primary-600 border-b-2 border-primary-600' 
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'"
            >
              Edit
            </button>
            <button
              @click="showPreview = true"
              class="px-4 py-2 text-sm font-medium transition-colors"
              :class="showPreview 
                ? 'text-primary-600 border-b-2 border-primary-600' 
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'"
            >
              Preview
            </button>
          </div>
          
          <!-- Editor or Preview content -->
          <div class="flex-1 overflow-auto">
            <!-- Editor -->
            <div v-if="!showPreview" class="p-3 md:p-4">
              <textarea
                v-model="editorContent"
                placeholder="Write your markdown here..."
                class="w-full h-full min-h-[300px] resize-none bg-transparent border-none focus:outline-none font-mono text-sm text-gray-900 dark:text-white"
              ></textarea>
            </div>
            
            <!-- Preview -->
            <div v-else class="p-3 md:p-4">
              <h2 class="text-lg font-bold text-gray-900 dark:text-white mb-4">{{ editorTitle || 'Untitled' }}</h2>
              <div class="prose dark:prose-invert max-w-none reader-content" v-html="renderedPreview"></div>
            </div>
          </div>
        </div>
        
        <!-- Tags Section - Only shown when editing (not preview) -->
        <div v-if="!showPreview" class="border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div class="p-3 flex-shrink-0">
            <div class="flex items-center gap-3 flex-wrap">
              <!-- Tags label -->
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300 flex-shrink-0">Tags:</span>
              
              <!-- Current tags (horizontal list) -->
              <div class="flex flex-wrap gap-1 items-center">
                <span
                  v-for="tag in editorTags"
                  :key="tag"
                  class="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full flex-shrink-0"
                  :style="{ backgroundColor: getTagColor(tag).bg, color: getTagColor(tag).text }"
                >
                  {{ tag }}
                  <button
                    @click="removeTag(tag)"
                    class="hover:opacity-75 flex-shrink-0"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
                <span v-if="editorTags.length === 0" class="text-xs text-gray-400">
                  No tags
                </span>
              </div>
              
              <!-- Divider -->
              <div class="w-px h-4 bg-gray-300 dark:bg-gray-600 flex-shrink-0"></div>
              
              <!-- Add tag input -->
              <input
                v-model="newTag"
                type="text"
                placeholder="Add tag..."
                class="w-32 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary-500 focus:border-transparent flex-shrink-0"
                @keydown.enter.prevent="addTag"
              />
              <button
                @click="addTag"
                :disabled="!newTag.trim()"
                class="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                Add
              </button>
              
              <!-- Suggested tags -->
              <div v-if="suggestedTags.length > 0" class="flex items-center gap-1">
                <span class="text-xs text-gray-400 flex-shrink-0">Sug:</span>
                <button
                  v-for="tag in suggestedTags"
                  :key="tag"
                  @click="addSuggestedTag(tag)"
                  class="px-1.5 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 flex-shrink-0"
                >
                  {{ tag }}
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Footer - Close button only (Save is now in header) - hidden on mobile -->
        <div class="hidden md:flex justify-end gap-2 p-3 md:p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gray-50 dark:bg-gray-800">
          <button @click="closeEditor" class="btn-secondary">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useOfflineNotes } from '~/composables/useOfflineNotes'
import { useTagColors } from '~/composables/useTagColors'
import type { Note } from '~/composables/idb'

const { render } = useMarkdown()
const { allTags, loadAllTags, getTagColor } = useTagColors()
const offlineNotes = useOfflineNotes()
const { viewMode } = useViewMode()

const notes = ref<Note[]>([])
const loading = ref(true)
const showEditor = ref(false)
const showPreview = ref(false)
const editorTitle = ref('')
const editorContent = ref('')
const originalContent = ref('')
const editorTags = ref<string[]>([])
const editingNote = ref<Note | null>(null)
const newTag = ref('')
const filterTag = ref('')
const saving = ref(false)

const renderedPreview = computed(() => render(editorContent.value))

// Check if there are unsaved changes
const hasChanges = computed(() => {
  if (!editingNote.value) return editorTitle.value.trim() || editorContent.value.trim()
  return editorTitle.value !== editingNote.value.title ||
    editorContent.value !== editingNote.value.content ||
    JSON.stringify(editorTags.value) !== JSON.stringify(editingNote.value.tags || [])
})

// Suggested tags based on all available tags minus current editor tags
const suggestedTags = computed(() => {
  return allTags.value
    .map(t => t.name)
    .filter(tag => !editorTags.value.includes(tag))
    .slice(0, 5)
})

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

function editNote(note: Note) {
  editingNote.value = note
  editorTitle.value = note.title
  editorContent.value = note.content
  editorTags.value = [...(note.tags || [])]
  // When opening an existing note, start in preview mode
  showPreview.value = true
  showEditor.value = true
}

function startNewNote() {
  editingNote.value = null
  editorTitle.value = ''
  editorContent.value = ''
  editorTags.value = []
  // When creating a new note, start in edit mode
  showPreview.value = false
  showEditor.value = true
}

function closeEditor() {
  showEditor.value = false
  editorTitle.value = ''
  editorContent.value = ''
  editorTags.value = []
  editingNote.value = null
  newTag.value = ''
}

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

async function saveNote() {
  if (!editorTitle.value.trim()) return
  
  saving.value = true
  
  try {
    if (editingNote.value) {
      await offlineNotes.updateNote(editingNote.value.id, {
        title: editorTitle.value,
        content: editorContent.value,
        tags: editorTags.value,
      })
    } else {
      await offlineNotes.createNote({
        title: editorTitle.value,
        content: editorContent.value,
        tags: editorTags.value,
      })
    }
    closeEditor()
    loadNotes()
    // Force reload tags after saving in case new tags were created
    loadAllTags(true)
  } catch (e) {
    console.error('Failed to save note:', e)
  } finally {
    saving.value = false
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

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return date.toLocaleDateString()
}

// Watch for filter changes
watch(filterTag, () => {
  loadNotes()
})

onMounted(() => {
  loadNotes()
  loadAllTags()
  
  // Listen for online status to refresh data when coming back online
  window.addEventListener('online', () => {
    console.log('[Notes] Back online, refreshing data...')
    loadNotes()
    loadAllTags(true)
  })
})
</script>
