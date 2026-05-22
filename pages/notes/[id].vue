<template>
  <div class="min-h-[calc(var(--dvh)-100px)] md:min-h-[calc(var(--dvh)-156px)] flex flex-col">
    <StickyToolbar v-if="!isNew && !editing" show-back back-label="Back to notes" back-to="/notes"
      :title="deriveTitle(note?.content ?? '')" :actions="toolbarActions" />

    <!-- Editor mode top bar: back button + auto-save status -->
    <div v-else class="flex items-center mb-4">
      <button @click="exitEditor"
        class="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all action-button"
        :title="isNew ? 'Back to notes' : 'Done editing'">
        <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div class="flex-1" />

      <!-- Auto-save status indicator. Click to force-save immediately. -->
      <button @click="flushSave"
        class="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        :title="saveTitle">
        <!-- pending -->
        <svg v-if="saveStatus === 'pending'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <!-- saving -->
        <svg v-else-if="saveStatus === 'saving'" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        <!-- saved -->
        <svg v-else-if="saveStatus === 'saved'" class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <!-- error -->
        <svg v-else-if="saveStatus === 'error'" class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z" />
        </svg>
        <!-- idle: pencil hint -->
        <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
        <span class="hidden sm:inline">{{ saveLabel }}</span>
      </button>
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
      <div v-else class="md:card flex-1 flex flex-col min-h-0">
        <!-- Content Area -->
        <div class="flex-1 min-h-0 h-full">
          <textarea v-model="editorContent" placeholder="Write your markdown here..."
            class="w-full min-h-[calc(var(--dvh)-256px)] md:min-h-[calc(var(--dvh)-266px)] resize-none bg-transparent border-none focus:outline-none font-mono text-sm text-gray-900 dark:text-white p-4"
            autofocus enterkeyhint="enter" inputmode="text"></textarea>
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
import { storeToRefs } from 'pinia'
import type { Action } from '~/utils/types'
import type { Note } from '~/composables/idb'
import { deriveTitle } from '~/composables/idb'
import { formatDate } from '~/utils/date'
import { useTagSystem } from '~/composables/useTagSystem'
import { useViewportHeight } from '~/composables/useViewportHeight'

// Keep a single component instance across /notes/new → /notes/<uuid> so the
// editor doesn't unmount when auto-save promotes a draft to a real note via
// router.replace. (By default Nuxt keys the page by route path, which would
// remount it and drop in-progress typing.)
definePageMeta({ key: 'notes-detail' })

const route = useRoute()
const router = useRouter()
const dataStore = useDataStore()
const { isOnline } = storeToRefs(dataStore)
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

// ==================== AUTO-SAVE ====================
// Debounced auto-save: edits land in the IndexedDB store immediately via
// dataStore.{create,update}Note, which queues them for sync. Works offline.
type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'
const saveStatus = ref<SaveStatus>('idle')
const SAVE_DEBOUNCE_MS = 2000
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
let savedFadeTimer: ReturnType<typeof setTimeout> | null = null
// Set right before router.replace from a freshly-created note so the
// route-id watcher doesn't reinitialize the editor and clobber typing.
let skipNextRouteLoad = false

const saveLabel = computed(() => {
  switch (saveStatus.value) {
    case 'pending': return 'Unsaved'
    case 'saving': return 'Saving…'
    case 'saved': return isOnline.value ? 'Saved' : 'Saved offline'
    case 'error': return 'Save failed'
    default: return 'Auto-save'
  }
})
const saveTitle = computed(() => {
  switch (saveStatus.value) {
    case 'pending': return 'Unsaved changes — click to save now'
    case 'saving': return 'Saving…'
    case 'saved': return isOnline.value
      ? 'All changes saved'
      : 'Saved locally — will sync when online'
    case 'error': return 'Save failed — click to retry'
    default: return 'Changes auto-save as you type'
  }
})

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

// Leave the editor. Any debounced edits are flushed first so we never lose
// what the user just typed — no "discard changes" prompt needed.
async function exitEditor() {
  await flushSave()
  if (isNew.value) {
    // New note with nothing typed → back to list.
    router.push('/notes')
    return
  }
  editing.value = false
  initFromNote()
}

// Debounce: arm a single timer; subsequent keystrokes push it out.
function scheduleAutoSave() {
  if (!hasChanges.value) return
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  saveStatus.value = 'pending'
  autoSaveTimer = setTimeout(() => {
    autoSaveTimer = null
    void autoSave()
  }, SAVE_DEBOUNCE_MS)
}

// Save immediately, bypassing the debounce. Used by the indicator click and
// by flushSave() on cancel / route leave / tab hide.
async function autoSave() {
  if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null }
  if (savedFadeTimer) { clearTimeout(savedFadeTimer); savedFadeTimer = null }
  // Don't create empty new notes.
  if (isNew.value && !editorContent.value.trim()) {
    saveStatus.value = 'idle'
    return
  }
  if (!hasChanges.value && !isNew.value) return

  saveStatus.value = 'saving'
  try {
    if (isNew.value) {
      const created = await dataStore.createNote({
        content: editorContent.value,
        tags: [...editorTags.value],
      })
      if (created) {
        note.value = created
        skipNextRouteLoad = true
        await router.replace(`/notes/${created.id}`)
      }
    } else if (note.value) {
      await dataStore.updateNote(note.value.id, {
        content: editorContent.value,
        tags: [...editorTags.value],
      })
      note.value = {
        ...note.value,
        content: editorContent.value,
        tags: [...editorTags.value],
        updatedAt: new Date().toISOString(),
      }
    }
    saveStatus.value = 'saved'
    savedFadeTimer = setTimeout(() => {
      if (saveStatus.value === 'saved') saveStatus.value = 'idle'
    }, 2000)
    // Push to the server promptly — auto-save's 2s typing debounce naturally
    // limits the sync rate, and we don't want the background sync's 60s
    // throttle to delay the user's typed changes from reaching the server.
    if (isOnline.value) void dataStore.triggerSync()
  } catch (e) {
    console.error('Auto-save failed:', e)
    saveStatus.value = 'error'
  }
}

// Flush any pending save now (no-op if nothing pending).
async function flushSave() {
  if (saveStatus.value === 'pending') {
    await autoSave()
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

// Watch for route changes to reload data (client-side navigation between notes).
// Skip once after a fresh create — router.replace from autoSave changes the id
// from 'new' to a real UUID, and we don't want to reload (and clobber the
// editor) when we already have the note in hand.
watch(() => route.params.id, (newId) => {
  if (skipNextRouteLoad) {
    skipNextRouteLoad = false
    return
  }
  loadForRoute(newId)
})

// Trigger debounced auto-save whenever the editor content or tags change in
// edit / create mode.
watch([editorContent, editorTags], () => {
  if (!editing.value && !isNew.value) return
  scheduleAutoSave()
}, { deep: true })

// Flush pending changes when the tab is hidden / the page unmounts so we
// never lose what the user just typed.
function handleVisibility() {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    void flushSave()
  }
}
onMounted(() => {
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibility)
  }
})
onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibility)
  }
  void flushSave()
})

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

onBeforeRouteLeave(async () => {
  await flushSave()
})
</script>
