<template>
  <div class="max-w-4xl min-h-[calc(var(--dvh)-110px)] md:min-h-[calc(var(--dvh)-136px)] flex flex-col">
    <StickyToolbar v-if="!isNew && !editing" show-back back-label="Back to bookmarks" back-to="/bookmarks"
      :actions="toolbarActions" />

    <!-- Simple back button for new/editing mode -->
    <div v-else class="flex mb-4">
      <div class="flex-1">
        <button @click="cancelEditing"
          class="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all action-button"
          :title="isNew ? 'Back to bookmarks' : 'Cancel'">
          <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <div class="flex gap-4">
        <button @click="saveBookmark"
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
    <div v-if="loading" class="flex justify-center py-12">
      <svg class="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
        </path>
      </svg>
    </div>

    <!-- Bookmark View/Edit -->
    <div v-if="bookmark || isNew" class="flex-1 flex flex-col">
      <!-- Metadata and tags (view mode - existing bookmark) -->
      <template v-if="!isNew && !editing">
        <!-- Title -->
        <h1 class="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
          {{ bookmark.title }}
        </h1>

        <a :href="bookmark.url" target="_blank" rel="noopener"
          class="hover:text-primary-600 mb-2 inline-block text-sm text-gray-500 dark:text-gray-400">
          {{ bookmark.source_domain }}
        </a>

        <div class="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4">
          <span>Saved {{ formatDateFull(bookmark.saved_at) }}</span>
          <span v-if="bookmark.reading_time_minutes" class="mx-2">•</span>
          <span v-if="bookmark.reading_time_minutes">{{ bookmark.reading_time_minutes }} min read</span>
        </div>

        <div v-if="bookmark.tags && bookmark.tags.length > 0" class="flex flex-wrap gap-2">
          <span v-for="tag in bookmark.tags" :key="tag" class="px-2.5 py-0.5 text-xs rounded-full"
            :style="{ backgroundColor: getTagColor(tag).bg, color: getTagColor(tag).text }">
            {{ tag }}
          </span>
        </div>

        <hr class="my-4 border-gray-200 dark:border-gray-700" />

        <div class="prose dark:prose-invert max-w-none reader-content" v-html="renderedMarkdown"></div>
      </template>

      <!-- Editor mode (new or editing) -->
      <div v-else class="flex-1 flex flex-col">
        <div class="mb-4">
          <input v-model="editorUrl" type="url"
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary-500 focus:border-transparent"
            placeholder="https://..." v-if="isNew && bookmark" />
          <div v-else class="font-mono text-xs text-grey-500">{{ editorUrl }}</div>
        </div>

        <div class="mb-4">
          <input v-model="editorTitle" type="text"
            class="w-full text-2xl md:text-3xl font-bold bg-transparent border-none focus:outline-none text-gray-900 dark:text-white placeholder-gray-400"
          placeholder="Bookmark title..." />
        </div>

        <!-- Content Area -->
        <div class="flex-1">
          <textarea v-model="editorContent" placeholder="Write your markdown here..."
            class="w-full min-h-[calc(var(--dvh)-320px)] md:min-h-[calc(var(--dvh)-350px)] resize-none bg-transparent border-none focus:outline-none font-mono text-sm text-gray-900 dark:text-white"
            autofocus enterkeyhint="enter" inputmode="text"></textarea>
        </div>

        <!-- Footer -->
        <div
          class="flex justify-between items-center p-4 -mb-4 -mx-4 bg-gray-50 dark:bg-gray-800 sm:rounded-xl">
          <div class="text-sm text-gray-500 dark:text-gray-400 hidden md:block">
            {{ editorWordCount }} words
          </div>

          <!-- Tags Section -->
          <div class="">
            <div class="flex items-center gap-3 flex-wrap">
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300 flex-shrink-0 hidden md:block">Tags:</span>

              <!-- Current tags -->
              <div class="flex flex-wrap gap-1 items-center">
                <span v-for="tag in editorTags" :key="tag"
                  class="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full flex-shrink-0 whitespace-nowrap"
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
                class="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">
                Add
              </button>

              <!-- Suggested tags -->
              <div v-if="suggestedTags.length > 0" class="flex items-center gap-1">
                <span class="text-xs text-gray-400 flex-shrink-0">Sug:</span>
                <button v-for="tag in suggestedTags" :key="tag" @click="addSuggestedTag(tag)"
                  class="px-1.5 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 whitespace-nowrap">
                  {{ tag }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Error: Bookmark not found -->
    <div v-else class="text-center py-12">
      <p class="text-gray-500 dark:text-gray-400">Bookmark not found</p>
      <NuxtLink to="/bookmarks" class="btn-primary mt-4">Go Back</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatDateFull } from '~/utils/date'
import { useTagSystem } from '~/composables/useTagSystem'

const route = useRoute()
const router = useRouter()
const dataStore = useDataStore()
const { render } = useMarkdown()

const {
  tags,
  getTagColor,
  fetchTags,
  createTag,
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
const bookmark = ref<any>(null)
const loading = ref(true)
const tagsLoading = ref(true)
const editing = ref(false)
const editorTitle = ref('')
const editorUrl = ref('')
const editorContent = ref('')
const editorTags = ref<string[]>([])
const newTag = ref('')
const saving = ref(false)

// Determine mode - use isNew computed property
const isNew = computed(() => route.params.id === 'new')

// Computed properties
const renderedMarkdown = computed(() => {
  if (!bookmark.value?.cleaned_markdown) return ''
  return render(bookmark.value.cleaned_markdown)
})

const editorWordCount = computed(() => {
  if (!editorContent.value) return 0
  return editorContent.value.split(/\s+/).filter(w => w.length > 0).length
})

// Check if there are unsaved changes
const hasChanges = computed(() => {
  if (!bookmark.value) return editorContent.value.trim() || editorTitle.value.trim()
  return editorTitle.value !== bookmark.value.title ||
    editorContent.value !== (bookmark.value.cleaned_markdown || '') ||
    JSON.stringify(editorTags.value) !== JSON.stringify(bookmark.value.tags || [])
})

// Suggested tags based on all available tags minus current editor tags
const suggestedTags = computed(() => {
  return tags.value
    .filter(t => t.type === 'bookmark' || t.type === 'both')
    .map(t => t.name)
    .filter(tag => !editorTags.value.includes(tag))
    .slice(0, 5)
})

// Initialize editor state for new bookmark
function initNewBookmark() {
  editorTitle.value = ''
  editorUrl.value = ''
  editorContent.value = ''
  editorTags.value = []
  newTag.value = ''
  editing.value = true
  bookmark.value = null
}

// Initialize editor state from existing bookmark
function initFromBookmark() {
  if (bookmark.value) {
    editorTitle.value = bookmark.value.title || ''
    editorUrl.value = bookmark.value.url || ''
    editorContent.value = bookmark.value.cleaned_markdown || ''
    editorTags.value = [...(bookmark.value.tags || [])]
  }
  newTag.value = ''
}

// Load existing bookmark - instant from local, then sync in background
async function loadBookmark() {
  loading.value = true

  const id = route.params.id as string

  // Load from data store - reads from IndexedDB first (instant)
  bookmark.value = dataStore.getBookmarkById(id) ?? null
  loading.value = false

  if (bookmark.value) {
    initFromBookmark()
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
  initFromBookmark()
}

function cancelEditing() {
  if (hasChanges.value) {
    if (!confirm('You have unsaved changes. Are you sure you want to cancel?')) {
      return
    }
  }
  editing.value = false
  initFromBookmark()
}

// Unified save logic - handles both create and update
async function saveBookmark() {
  if (!editorContent.value.trim()) return

  saving.value = true

  try {
    // Handle tag creation for any new tags
    const newTags = editorTags.value.filter(tag => !tags.value.find(t => t.name.toLowerCase() === tag.toLowerCase()))
    for (const tagName of newTags) {
      await handleCreateTag(tagName)
    }

    if (isNew.value) {
      // Create new bookmark - need URL at minimum
      if (!editorUrl.value.trim()) {
        alert('Please enter a URL')
        saving.value = false
        return
      }

      // createBookmark only takes a URL and scrapes content
      const bookmarkToSave = await dataStore.createBookmark(editorUrl.value)

      if (bookmarkToSave) {
        // Update with user edits (title, content, tags)
        await dataStore.updateBookmark(bookmarkToSave.id, {
          title: editorTitle.value || editorUrl.value,
          cleaned_markdown: editorContent.value,
          tags: editorTags.value,
        })
        router.replace(`/bookmarks/${bookmarkToSave.id}`)
      }
    } else if (bookmark.value) {
      // Update existing bookmark
      await dataStore.updateBookmark(bookmark.value.id, {
        title: editorTitle.value,
        cleaned_markdown: editorContent.value,
        tags: [ ...editorTags.value ],
      })

      // Update local bookmark
      bookmark.value = {
        ...bookmark.value,
        title: editorTitle.value,
        cleaned_markdown: editorContent.value,
        tags: [ ...editorTags.value ],
        updated_at: new Date().toISOString(),
      }

      editing.value = false
      loadAllTags(true) // Refresh tags
    }
  } catch (e) {
    console.error('Failed to save bookmark:', e)
  } finally {
    saving.value = false
  }
}

async function toggleFavorite() {
  if (!bookmark.value) return
  await dataStore.toggleBookmarkFavorite(bookmark.value.id)
  bookmark.value.is_favorite = !bookmark.value.is_favorite
}

async function deleteBookmarkConfirm() {
  if (!bookmark.value) return

  if (confirm(`Delete "${bookmark.value.title}"?`)) {
    await dataStore.deleteBookmark(bookmark.value.id)
    router.push('/bookmarks')
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
    initNewBookmark()
    loading.value = false
  } else {
    await loadBookmark()
  }
}, { immediate: true })

// Toolbar actions for the sticky toolbar
interface Action {
  icon?: 'heart' | 'tag' | 'edit' | 'external' | 'trash' | 'copy' | 'plus' | 'close'
  title: string
  active?: boolean
  variant?: 'default' | 'danger'
  handler?: () => void
}

const toolbarActions = computed<Action[]>(() => [
  {
    icon: 'heart' as const,
    title: bookmark.value?.is_favorite ? 'Remove from favorites' : 'Add to favorites',
    active: bookmark.value?.is_favorite,
    handler: () => toggleFavorite(),
  },
  {
    icon: 'edit' as const,
    title: 'Edit bookmark',
    handler: () => startEditing(),
  },
  {
    icon: 'external' as const,
    title: 'Open original',
    handler: () => { window.open(bookmark.value?.url, '_blank') },
  },
  {
    icon: 'trash' as const,
    title: 'Delete bookmark',
    variant: 'danger' as const,
    handler: () => deleteBookmarkConfirm(),
  },
])

function setDvh() {
  document.documentElement.style.setProperty('--dvh', `${window.innerHeight}px`)
}

onMounted(() => {
  setDvh()
  window.addEventListener('resize', setDvh)
  window.addEventListener('orientationchange', setDvh)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', setDvh)
  window.removeEventListener('orientationchange', setDvh)
})

onBeforeRouteLeave((to, from) => {
  if (editing.value && hasChanges.value) {
    return confirm('You have unsaved changes. Are you sure you want to leave?')
  }
})
</script>
