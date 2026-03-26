<template>
  <div>
    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Markdown Notes</h1>
      <button @click="showEditor = true" class="btn-primary">
        <svg class="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        New Note
      </button>
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
        :key="tag"
        @click="filterTag = tag"
        class="px-3 py-1 text-sm rounded-full transition-colors"
        :class="filterTag === tag 
          ? 'bg-primary-600 text-white' 
          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'"
      >
        {{ tag }}
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
      <button @click="showEditor = true" class="btn-primary">Create Note</button>
    </div>

    <div v-else class="space-y-4">
      <div
        v-for="note in notes"
        :key="note.id"
        class="card p-4 hover:shadow-md transition-shadow cursor-pointer"
        @click="editNote(note)"
      >
        <div class="flex justify-between items-start mb-2">
          <h3 class="font-medium text-gray-900 dark:text-white">{{ note.title }}</h3>
          <div class="flex items-center gap-2">
            <button
              @click.stop="toggleFavorite(note)"
              class="p-1"
            >
              <svg
                class="w-5 h-5"
                :class="note.is_favorite ? 'text-yellow-500 fill-current' : 'text-gray-400'"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>
            <button
              @click.stop="deleteNoteConfirm(note)"
              class="p-1 text-gray-400 hover:text-red-600"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
        
        <!-- Tags display -->
        <div v-if="note.tags && note.tags.length > 0" class="flex flex-wrap gap-1 mb-2">
          <span
            v-for="tag in note.tags"
            :key="tag"
            class="px-2 py-0.5 text-xs rounded-full bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300"
          >
            {{ tag }}
          </span>
        </div>
        
        <p class="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 mb-2 font-mono">
          {{ note.content }}
        </p>
        
        <div class="text-xs text-gray-400">
          Updated {{ formatDate(note.updated_at) }}
        </div>
      </div>
    </div>

    <!-- Editor Modal -->
    <div v-if="showEditor" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="card max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div class="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <input
            v-model="editorTitle"
            type="text"
            placeholder="Note title..."
            class="text-xl font-bold bg-transparent border-none focus:outline-none text-gray-900 dark:text-white flex-1"
          />
          <button @click="closeEditor" class="text-gray-400 hover:text-gray-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <!-- Tag Management -->
        <div class="p-4 border-b border-gray-200 dark:border-gray-700">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tags</label>
          
          <!-- Current tags -->
          <div class="flex flex-wrap gap-2 mb-2">
            <span
              v-for="tag in editorTags"
              :key="tag"
              class="inline-flex items-center gap-1 px-2 py-1 text-sm rounded-full bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300"
            >
              {{ tag }}
              <button
                @click="removeTag(tag)"
                class="hover:text-red-600 dark:hover:text-red-400"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
            <span v-if="editorTags.length === 0" class="text-sm text-gray-400">
              No tags added
            </span>
          </div>
          
          <!-- Add tag input -->
          <div class="flex gap-2">
            <input
              v-model="newTag"
              type="text"
              placeholder="Add a tag..."
              class="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              @keydown.enter.prevent="addTag"
            />
            <button
              @click="addTag"
              :disabled="!newTag.trim()"
              class="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
          
          <!-- Suggested tags -->
          <div v-if="suggestedTags.length > 0" class="mt-2">
            <span class="text-xs text-gray-500 dark:text-gray-400">Suggested:</span>
            <div class="flex flex-wrap gap-1 mt-1">
              <button
                v-for="tag in suggestedTags"
                :key="tag"
                @click="addSuggestedTag(tag)"
                class="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {{ tag }}
              </button>
            </div>
          </div>
        </div>
        
        <div class="flex-1 overflow-hidden flex">
          <!-- Editor -->
          <div class="flex-1 p-4">
            <textarea
              v-model="editorContent"
              placeholder="Write your markdown here..."
              class="w-full h-full resize-none bg-transparent border-none focus:outline-none font-mono text-sm text-gray-900 dark:text-white"
            ></textarea>
          </div>
          
          <!-- Preview -->
          <div class="flex-1 p-4 border-l border-gray-200 dark:border-gray-700 overflow-auto">
            <h2 class="text-lg font-bold text-gray-900 dark:text-white mb-4">{{ editorTitle || 'Untitled' }}</h2>
            <div class="prose dark:prose-invert max-w-none reader-content" v-html="renderedPreview"></div>
          </div>
        </div>
        
        <div class="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button @click="closeEditor" class="btn-secondary">Cancel</button>
          <button @click="saveNote" class="btn-primary">Save</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { render } = useMarkdown()

interface Note {
  id: string
  title: string
  content: string
  is_favorite: boolean
  tags: string[]
  created_at: string
  updated_at: string
}

const notes = ref<Note[]>([])
const loading = ref(true)
const showEditor = ref(false)
const editorTitle = ref('')
const editorContent = ref('')
const editorTags = ref<string[]>([])
const editingNote = ref<Note | null>(null)
const newTag = ref('')
const filterTag = ref('')
const allTags = ref<string[]>([])

const renderedPreview = computed(() => render(editorContent.value))

// Suggested tags based on all available tags minus current editor tags
const suggestedTags = computed(() => {
  return allTags.value.filter(tag => !editorTags.value.includes(tag)).slice(0, 5)
})

async function loadNotes() {
  loading.value = true
  try {
    const url = filterTag.value 
      ? `/api/notes/markdown?tag=${encodeURIComponent(filterTag.value)}`
      : '/api/notes/markdown'
    const response = await $fetch<{ notes: Note[] }>(url)
    notes.value = response.notes
    
    // Extract all unique tags
    const tagSet = new Set<string>()
    response.notes.forEach(note => {
      note.tags?.forEach(tag => tagSet.add(tag))
    })
    allTags.value = Array.from(tagSet).sort()
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
  
  try {
    if (editingNote.value) {
      await $fetch(`/api/notes/markdown/${editingNote.value.id}`, {
        method: 'PUT',
        body: {
          title: editorTitle.value,
          content: editorContent.value,
          tags: editorTags.value,
        },
      })
    } else {
      await $fetch('/api/notes/markdown', {
        method: 'POST',
        body: {
          title: editorTitle.value,
          content: editorContent.value,
          tags: editorTags.value,
        },
      })
    }
    closeEditor()
    loadNotes()
  } catch (e) {
    console.error('Failed to save note:', e)
  }
}

async function toggleFavorite(note: Note) {
  try {
    await $fetch(`/api/notes/markdown/${note.id}`, {
      method: 'PUT',
      body: { is_favorite: !note.is_favorite },
    })
    note.is_favorite = !note.is_favorite
  } catch (e) {
    console.error('Failed to toggle favorite:', e)
  }
}

async function deleteNoteConfirm(note: Note) {
  if (confirm(`Delete "${note.title}"?`)) {
    try {
      await $fetch(`/api/notes/markdown/${note.id}`, { method: 'DELETE' })
      notes.value = notes.value.filter(n => n.id !== note.id)
      // Update allTags
      const tagSet = new Set<string>()
      notes.value.forEach(n => {
        n.tags?.forEach(tag => tagSet.add(tag))
      })
      allTags.value = Array.from(tagSet).sort()
    } catch (e) {
      console.error('Failed to delete note:', e)
    }
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
})
</script>
