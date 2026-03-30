<template>
  <div>
    <div v-if="note" class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-4">
          <!-- Back button -->
          <button @click="$router.push('/notes')" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" title="Back to notes">
            <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div class="flex items-center gap-2">
            <button @click="toggleFavorite" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" title="Favorite">
              <svg class="w-5 h-5" :class="note.isFavorite ? 'text-yellow-500 fill-current' : 'text-gray-400'"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>

            <button @click="showTagsModal = true" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" title="Tags">
              <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </button>

            <button @click="startEditing" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" title="Edit">
              <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>

            <button @click="deleteNoteConfirm" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" title="Delete">
              <svg class="w-5 h-5 text-gray-500 dark:text-gray-400 hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        <h1 class="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {{ note.title }}
        </h1>

        <div class="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4">
          <span>Updated {{ formatDate(note.updatedAt) }}</span>
          <span class="mx-2">•</span>
          <span>{{ wordCount }} words</span>
        </div>

        <!-- Tags display with colors -->
        <div v-if="note.tags && note.tags.length > 0" class="flex flex-wrap gap-2">
          <span v-for="tag in note.tags" :key="tag" class="px-2.5 py-0.5 text-xs rounded-full"
            :style="{ backgroundColor: getTagColor(tag).bg, color: getTagColor(tag).text }">
            {{ tag }}
          </span>
        </div>
      </div>

      <!-- Reading Mode Tabs -->
      <div class="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav class="flex gap-4">
          <button @click="currentMode = 'preview'" :class="[
            'pb-3 px-1 text-sm font-medium border-b-2 transition-colors',
            currentMode === 'preview'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]">
            Preview
          </button>
          <button @click="currentMode = 'edit'" :class="[
            'pb-3 px-1 text-sm font-medium border-b-2 transition-colors',
            currentMode === 'edit'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]">
            Edit
          </button>
        </nav>
      </div>

      <!-- Content -->
      <div class="prose dark:prose-invert max-w-none">
        <!-- Preview Mode -->
        <div v-if="currentMode === 'preview'" class="reader-content">
          <h2 class="text-lg font-bold text-gray-900 dark:text-white mb-4">{{ note.title }}</h2>
          <div v-html="renderedMarkdown"></div>
        </div>

        <!-- Edit Mode -->
        <div v-else class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Title</label>
            <input v-model="editorTitle" type="text" class="input w-full" placeholder="Note title..." />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Content (Markdown)</label>
            <textarea v-model="editorContent" rows="20"
              class="input w-full font-mono text-sm resize-none"
              placeholder="Write your markdown here..."></textarea>
          </div>

          <div class="flex justify-between items-center">
            <div class="text-sm text-gray-500 dark:text-gray-400">
              {{ editorWordCount }} words
            </div>
            <div class="flex gap-2">
              <button @click="cancelEditing" class="btn-secondary">Cancel</button>
              <button @click="saveNote" class="btn-primary" :disabled="saving || !editorTitle.trim()">
                {{ saving ? 'Saving...' : 'Save' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-else-if="loading" class="flex justify-center py-12">
      <svg class="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
        </path>
      </svg>
    </div>

    <!-- Error -->
    <div v-else class="text-center py-12">
      <p class="text-gray-500 dark:text-gray-400">Note not found</p>
      <NuxtLink to="/notes" class="btn-primary mt-4">Go Back</NuxtLink>
    </div>

    <!-- Tags Modal -->
    <div v-if="showTagsModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="card max-w-md w-full p-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">Manage Tags</h2>
          <button @click="showTagsModal = false" class="text-gray-400 hover:text-gray-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Tag Input with typeahead -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tags</label>
          <TagInput v-model="editorTags" placeholder="Search or create tags..." />
        </div>

        <div class="flex justify-end gap-2 mt-4 pt-4 border-t">
          <button @click="showTagsModal = false" class="btn-primary">Done</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Note } from '~/composables/idb'
import { formatDate } from '~/utils/date'

const route = useRoute()
const router = useRouter()
const { getNoteById, updateNote, deleteNote: deleteNoteFn, toggleFavorite: toggleFavoriteFn } = useOfflineNotes()
const { render } = useMarkdown()
const { getTagColor, loadAllTags } = useTagColors()

const note = ref<Note | null>(null)
const loading = ref(true)
const currentMode = ref('preview')
const showTagsModal = ref(false)
const editorTitle = ref('')
const editorContent = ref('')
const editorTags = ref<string[]>([])
const saving = ref(false)

const renderedMarkdown = computed(() => render(note.value?.content || ''))

const wordCount = computed(() => {
  if (!note.value?.content) return 0
  return note.value.content.split(/\s+/).filter(w => w.length > 0).length
})

const editorWordCount = computed(() => {
  if (!editorContent.value) return 0
  return editorContent.value.split(/\s+/).filter(w => w.length > 0).length
})

async function loadNote() {
  loading.value = true

  // Load tags first so colors are available
  await loadAllTags(true)

  const id = route.params.id as string
  note.value = await getNoteById(id)
  loading.value = false

  if (note.value) {
    editorTitle.value = note.value.title
    editorContent.value = note.value.content
    editorTags.value = [...(note.value.tags || [])]
  }
}

function startEditing() {
  if (note.value) {
    editorTitle.value = note.value.title
    editorContent.value = note.value.content
    editorTags.value = [...(note.value.tags || [])]
    currentMode.value = 'edit'
  }
}

function cancelEditing() {
  currentMode.value = 'preview'
  if (note.value) {
    editorTitle.value = note.value.title
    editorContent.value = note.value.content
    editorTags.value = [...(note.value.tags || [])]
  }
}

async function saveNote() {
  if (!note.value || !editorTitle.value.trim()) return

  saving.value = true
  try {
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

    currentMode.value = 'preview'
    loadAllTags(true) // Refresh tags
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

// Watch for tags changes
watch(editorTags, async (newTags) => {
  if (!note.value) return

  // Only update if we have a note loaded
  const oldTags = note.value.tags || []
  if (JSON.stringify(newTags) !== JSON.stringify(oldTags)) {
    await updateNote(note.value.id, { tags: newTags })
    note.value.tags = newTags
    loadAllTags(true)
  }
}, { deep: true })

onMounted(() => {
  loadNote()
})
</script>
