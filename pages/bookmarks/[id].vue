<template>
  <div>
    <div v-if="bookmark" class="max-w-6xl mx-auto">
      <!-- Header -->
      <div class="mb-6">
        <div class="flex items-start justify-between mb-4">
          <div>
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {{ bookmark.title }}
            </h1>
            <div class="flex items-center text-gray-500 dark:text-gray-400">
              <a :href="bookmark.url" target="_blank" rel="noopener" class="hover:text-primary-600">
                {{ bookmark.source_domain }}
              </a>
              <span class="mx-2">•</span>
              <span>Saved {{ formatDate(bookmark.saved_at) }}</span>
              <span v-if="bookmark.reading_time_minutes" class="mx-2">•</span>
              <span v-if="bookmark.reading_time_minutes">{{ bookmark.reading_time_minutes }} min read</span>
            </div>
          </div>
          
          <div class="flex items-center gap-2">
            <button
              @click="toggleFavorite"
              class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <svg
                class="w-6 h-6"
                :class="bookmark.is_favorite ? 'text-yellow-500 fill-current' : 'text-gray-400'"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>
            
            <button @click="showTagsModal = true" class="btn-secondary">
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Tags
            </button>
            
            <button @click="showEditModal = true" class="btn-primary">
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit
            </button>
            
            <a :href="bookmark.url" target="_blank" class="btn-secondary">
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open
            </a>
          </div>
        </div>

        <!-- Tags display with colors -->
        <div v-if="bookmark.tags && bookmark.tags.length > 0" class="flex flex-wrap gap-2">
          <span
            v-for="tag in bookmark.tags"
            :key="tag"
            class="px-2.5 py-0.5 text-xs rounded-full"
            :style="{ backgroundColor: getTagColor(tag).bg, color: getTagColor(tag).text }"
          >
            {{ tag }}
          </span>
        </div>
      </div>

      <!-- Reading Mode Tabs -->
      <div class="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav class="flex gap-4">
          <button
            v-for="mode in modes"
            :key="mode.id"
            @click="currentMode = mode.id"
            :class="[
              'pb-3 px-1 text-sm font-medium border-b-2 transition-colors',
              currentMode === mode.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            ]"
          >
            {{ mode.label }}
          </button>
        </nav>
      </div>

      <!-- Content -->
      <div class="prose dark:prose-invert max-w-none">
        <!-- Reader Mode -->
        <div 
          v-if="currentMode === 'reader'" 
          class="reader-content"
          :class="readerClasses"
          :style="{ fontSize: readerSettings.fontSize + 'px' }"
          v-html="renderedMarkdown"
        ></div>
        
        <!-- Snapshot Mode -->
        <div v-else-if="currentMode === 'snapshot'" class="card p-6">
          <div v-html="bookmark.original_html" class="max-w-none"></div>
        </div>
        
        <!-- Markdown Mode -->
        <div v-else class="card p-6">
          <pre class="whitespace-pre-wrap font-mono text-sm">{{ bookmark.cleaned_markdown }}</pre>
          <button @click="copyMarkdown" class="btn-secondary mt-4">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy
          </button>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-else-if="loading" class="flex justify-center py-12">
      <svg class="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>

    <!-- Error -->
    <div v-else class="text-center py-12">
      <p class="text-gray-500 dark:text-gray-400">Bookmark not found</p>
      <NuxtLink to="/" class="btn-primary mt-4">Go Back</NuxtLink>
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
        
        <!-- Current tags with colors -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Current Tags</label>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="tag in bookmarkTags"
              :key="tag"
              class="inline-flex items-center gap-1 px-2 py-1 text-sm rounded-full"
              :style="{ backgroundColor: getTagColor(tag).bg, color: getTagColor(tag).text }"
            >
              {{ tag }}
              <button @click="removeTag(tag)" class="hover:opacity-75">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
            <span v-if="bookmarkTags.length === 0" class="text-sm text-gray-400">
              No tags yet
            </span>
          </div>
        </div>
        
        <!-- Add tag input -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Add New Tag</label>
          <div class="flex gap-2">
            <input
              v-model="newTag"
              type="text"
              placeholder="Enter tag name..."
              class="flex-1 input"
              @keydown.enter.prevent="addTag"
            />
            <button @click="addTag" :disabled="!newTag.trim()" class="btn-primary">
              Add
            </button>
          </div>
        </div>
        
        <!-- Existing tags to select from -->
        <div v-if="allTags.length > 0">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Or Select Existing</label>
          <div class="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
            <button
              v-for="tag in availableTags"
              :key="tag.id"
              @click="selectExistingTag(tag)"
              class="px-2 py-1 text-sm rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              {{ tag.name }}
            </button>
          </div>
        </div>
        
        <div class="flex justify-end gap-2 mt-4 pt-4 border-t">
          <button @click="showTagsModal = false" class="btn-primary">Done</button>
        </div>
      </div>
    </div>

    <!-- Edit Modal - Full Screen -->
    <div v-if="showEditModal" class="fixed inset-0 bg-gray-900 flex flex-col z-50">
      <div class="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
        <h2 class="text-xl font-bold text-white">Edit Content</h2>
        <div class="flex gap-2">
          <button @click="showEditModal = false" class="px-4 py-2 text-gray-300 hover:text-white">
            Cancel
          </button>
          <button @click="saveEdit" class="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700" :disabled="saving">
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>
      
      <div class="flex-1 p-4 overflow-hidden">
        <textarea
          v-model="editContent"
          class="w-full h-full resize-none bg-gray-800 border border-gray-700 rounded-lg p-4 font-mono text-sm text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="Edit markdown content..."
        ></textarea>
      </div>
      
      <div class="p-4 bg-gray-800 border-t border-gray-700 flex justify-between items-center">
        <div class="text-sm text-gray-400">
          {{ wordCount }} words • {{ charCount }} characters
        </div>
        <div class="text-sm text-gray-400">
          Tip: Remove unwanted elements like navigation, ads, etc.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { fetchBookmark, updateBookmark } = useBookmarks()
const { loadAllTags, getTagColor } = useTagColors()

interface Tag {
  id: string
  name: string
}

const bookmark = ref<any>(null)
const loading = ref(true)
const currentMode = ref('reader')
const showEditModal = ref(false)
const showTagsModal = ref(false)
const editContent = ref('')
const saving = ref(false)
const bookmarkTags = ref<string[]>([])
const allTags = ref<Tag[]>([])
const newTag = ref('')

const modes = [
  { id: 'reader', label: 'Reader' },
  { id: 'snapshot', label: 'Snapshot' },
  { id: 'markdown', label: 'Markdown' },
]

const { render } = useMarkdown()

// Reader settings from localStorage
const readerSettings = ref({
  fontSize: 16,
  fontFamily: 'sans-serif',
  lineHeight: 'normal',
})

const renderedMarkdown = computed(() => {
  if (!bookmark.value?.cleaned_markdown) return ''
  return render(bookmark.value.cleaned_markdown)
})

const readerClasses = computed(() => {
  const classes = []
  if (readerSettings.value.fontFamily === 'serif') {
    classes.push('font-serif')
  } else {
    classes.push('font-sans')
  }
  if (readerSettings.value.lineHeight === 'compact') {
    classes.push('leading-tight')
  } else if (readerSettings.value.lineHeight === 'relaxed') {
    classes.push('leading-relaxed')
  } else {
    classes.push('leading-normal')
  }
  return classes.join(' ')
})

const wordCount = computed(() => {
  if (!editContent.value) return 0
  return editContent.value.split(/\s+/).filter((w: string) => w.length > 0).length
})

const charCount = computed(() => {
  return editContent.value?.length || 0
})

const availableTags = computed(() => {
  return allTags.value.filter(t => !bookmarkTags.value.includes(t.name))
})

function loadReaderSettings() {
  const saved = localStorage.getItem('readerSettings')
  if (saved) {
    const settings = JSON.parse(saved)
    readerSettings.value = {
      fontSize: settings.fontSize || 16,
      fontFamily: settings.fontFamily || 'sans-serif',
      lineHeight: settings.lineHeight || 'normal',
    }
  }
}

async function loadBookmark() {
  loading.value = true
  
  // Load tags first so colors are available
  await loadAllTags()
  
  const id = route.params.id as string
  bookmark.value = await fetchBookmark(id)
  loading.value = false
  
  if (bookmark.value) {
    editContent.value = bookmark.value.cleaned_markdown || ''
    bookmarkTags.value = bookmark.value.tags || []
  }
  
  // Mark as read
  if (bookmark.value && !bookmark.value.is_read) {
    await updateBookmark(id, { is_read: true })
    bookmark.value.is_read = true
  }
}

async function toggleFavorite() {
  if (!bookmark.value) return
  await updateBookmark(bookmark.value.id, { is_favorite: !bookmark.value.is_favorite })
  bookmark.value.is_favorite = !bookmark.value.is_favorite
}

function copyMarkdown() {
  if (!bookmark.value?.cleaned_markdown) return
  navigator.clipboard.writeText(bookmark.value.cleaned_markdown)
}

async function addTag() {
  const tag = newTag.value.trim()
  if (!tag || bookmarkTags.value.includes(tag)) return
  
  // Create tag if it doesn't exist
  let tagId: string | null = null
  const existingTag = allTags.value.find(t => t.name.toLowerCase() === tag.toLowerCase())
  
  if (existingTag) {
    tagId = existingTag.id
  } else {
    try {
      const response = await $fetch<{ tag: Tag }>('/api/tags', {
        method: 'POST',
        body: { name: tag },
      })
      tagId = response.tag.id
      allTags.value.push(response.tag)
    } catch (e) {
      console.error('Failed to create tag:', e)
      return
    }
  }
  
  // Add tag to bookmark
  if (tagId) {
    await $fetch(`/api/bookmarks/${bookmark.value.id}/tags`, {
      method: 'POST',
      body: { tag_ids: [tagId] },
    })
    bookmarkTags.value.push(tag)
    bookmark.value.tags = [...bookmarkTags.value]
  }
  
  newTag.value = ''
}

async function removeTag(tag: string) {
  const tagInfo = allTags.value.find(t => t.name === tag)
  if (!tagInfo) return
  
  await $fetch(`/api/bookmarks/${bookmark.value.id}/tags`, {
    method: 'DELETE',
    body: { tag_ids: [tagInfo.id] },
  })
  
  bookmarkTags.value = bookmarkTags.value.filter(t => t !== tag)
  bookmark.value.tags = [...bookmarkTags.value]
}

async function selectExistingTag(tag: Tag) {
  if (bookmarkTags.value.includes(tag.name)) return
  
  await $fetch(`/api/bookmarks/${bookmark.value.id}/tags`, {
    method: 'POST',
    body: { tag_ids: [tag.id] },
  })
  
  bookmarkTags.value.push(tag.name)
  bookmark.value.tags = [...bookmarkTags.value]
}

async function saveEdit() {
  if (!bookmark.value) return
  
  saving.value = true
  try {
    await updateBookmark(bookmark.value.id, { 
      cleaned_markdown: editContent.value 
    })
    bookmark.value.cleaned_markdown = editContent.value
    showEditModal.value = false
  } catch (e) {
    console.error('Failed to save:', e)
  } finally {
    saving.value = false
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

onMounted(() => {
  loadReaderSettings()
  loadBookmark()
})
</script>
