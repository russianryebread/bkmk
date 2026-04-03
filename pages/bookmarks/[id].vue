<template>
  <div>
    <div v-if="bookmark" class="max-w-6xl mx-auto">
      <StickyToolbar show-back back-label="Back to bookmarks" back-to="/bookmarks" :actions="toolbarActions" />

      <!-- Header -->
      <div class="mb-6">

        <h1 class="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2" :class="fontFamily === 'serif' ? 'font-serif' : 'font-sans'">
          {{ bookmark.title }}
        </h1>

        <!-- Metadata -->

        <a :href="bookmark.url" target="_blank" rel="noopener"
          class="hover:text-primary-600 mb-2 inline-block text-sm text-gray-500 dark:text-gray-400">
          {{ bookmark.source_domain }}
        </a>

        <div class="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4">
          <span>Saved {{ formatDateFull(bookmark.saved_at) }}</span>
          <span v-if="bookmark.reading_time_minutes" class="mx-2">•</span>
          <span v-if="bookmark.reading_time_minutes">{{ bookmark.reading_time_minutes }} min read</span>
        </div>

        <!-- Tags display with colors -->
        <div v-if="bookmark.tags && bookmark.tags.length > 0" class="flex flex-wrap gap-2">
          <span v-for="tag in bookmark.tags" :key="tag" class="px-2.5 py-0.5 text-xs rounded-full"
            :style="{ backgroundColor: getTagColor(tag).bg, color: getTagColor(tag).text }">
            {{ tag }}
          </span>
        </div>
      </div>

      <!-- Reading Mode Tabs -->
      <div class="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav class="flex gap-4">
          <button v-for="mode in modes" :key="mode.id" @click="currentMode = mode.id" :class="[
            'pb-3 px-1 text-sm font-medium border-b-2 transition-colors',
            currentMode === mode.id
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]">
            {{ mode.label }}
          </button>
        </nav>
      </div>

      <!-- Content -->
      <div class="prose dark:prose-invert max-w-none">
        <!-- Video Embed (when URL is a video platform) -->
        <div v-if="videoInfo.isVideo && videoInfo.embedUrl" class="mb-6">
          <div class="relative w-full" style="padding-bottom: 56.25%;">
            <iframe
              :src="videoInfo.embedUrl"
              class="absolute inset-0 w-full h-full rounded-lg"
              frameborder="0"
              allowfullscreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            ></iframe>
          </div>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center capitalize">
            {{ videoInfo.platform }}
          </p>
        </div>

        <!-- URL Only Mode (no scraped content) -->
        <div v-else-if="!bookmark.cleaned_markdown && !bookmark.original_html" class="card p-6 text-center">
          <div class="mb-4">
            <p class="text-gray-500 dark:text-gray-400 mb-4">
              The content was not scraped or was removed.
            </p>
            <a :href="bookmark.url" target="_blank" class="btn-primary inline-flex items-center gap-2 truncate">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              <span class="truncate">{{ bookmark.url }}</span>
            </a>
          </div>
        </div>

        <!-- Reader Mode -->
        <div v-else-if="currentMode === 'reader'" class="reader-content"
          :class="[fontFamily === 'serif' ? 'font-serif' : 'font-sans', lineHeight === 'compact' ? 'leading-tight' : lineHeight === 'relaxed' ? 'leading-relaxed' : 'leading-normal']"
          :style="{ fontSize: fontSize + 'px' }" v-html="renderedMarkdown"></div>

        <!-- Snapshot Mode -->
        <div v-else-if="currentMode === 'snapshot'" class="card p-6">
          <!-- Sanitize HTML by removing script tags and inline event handlers -->
          <div class="max-w-none" v-html="sanitizeSnapshotHtml(bookmark.original_html)"></div>
        </div>

        <!-- Markdown Mode -->
        <div v-else class="card p-6">
          <pre class="whitespace-pre-wrap font-mono text-sm">{{ bookmark.cleaned_markdown }}</pre>
          <button @click="copyMarkdown" class="btn-secondary mt-4">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy
          </button>
        </div>

        <!-- Switch to URL Only button (when content exists) -->
        <div v-if="bookmark.cleaned_markdown || bookmark.original_html" class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button @click="switchToUrlOnly" class="btn-secondary text-sm">
            <svg class="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Switch to URL Only
          </button>
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

        <!-- Tag Input with typeahead -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tags</label>
          <TagInput ref="tagInputRef" v-model="bookmarkTags" placeholder="Search or create tags..."
            @update:model-value="handleTagsUpdate" @create-tag="handleCreateTag" />
        </div>

        <div class="flex justify-end gap-2 mt-4 pt-4">
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
          <button @click="saveEdit" class="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            :disabled="saving">
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>

      <div class="flex-1 p-4 overflow-hidden">
        <textarea v-model="editContent"
          class="w-full h-full resize-none bg-gray-800 border border-gray-700 rounded-lg p-4 font-mono text-sm text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="Edit markdown content..."></textarea>
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
import { formatDateFull } from '~/utils/date'
import { useTagSystem, type TagType } from '~/composables/useTagSystem'

const route = useRoute()
const router = useRouter()
const { fetchBookmark, updateBookmark, deleteBookmark } = useBookmarks()

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

interface Tag {
  id: string
  name: string
  type?: TagType
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
const tagInputRef = ref<any>(null)

const modes = [
  { id: 'reader', label: 'Reader' },
  { id: 'snapshot', label: 'Snapshot' },
  { id: 'markdown', label: 'Markdown' },
]

const { render } = useMarkdown()

// Reader settings with real-time reactivity
const { fontSize, fontFamily, lineHeight } = useReaderSettings()

const renderedMarkdown = computed(() => {
  if (!bookmark.value?.cleaned_markdown) return ''
  return render(bookmark.value.cleaned_markdown)
})

async function deleteBookmarkConfirm(bm: any) {
  if (confirm(`Delete "${bm.title}"?`)) {
    await deleteBookmark(bm.id)
    router.push('/bookmarks')
  }
}

// Detect video URL and return embed info
function detectVideo(url: string): { isVideo: boolean; embedUrl: string | null; platform: string | null } {
  // YouTube
  const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (youtubeMatch) {
    return {
      isVideo: true,
      embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}`,
      platform: 'youtube'
    }
  }

  // YouTube Shorts
  const youtubeShortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/)
  if (youtubeShortsMatch) {
    return {
      isVideo: true,
      embedUrl: `https://www.youtube.com/embed/${youtubeShortsMatch[1]}`,
      platform: 'youtube'
    }
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
  if (vimeoMatch) {
    return {
      isVideo: true,
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
      platform: 'vimeo'
    }
  }

  // Facebook
  const facebookMatch = url.match(/facebook\.com\/.*\/videos\/(\d+)/) || url.match(/facebook\.com\/watch\/?\?v=(\d+)/)
  if (facebookMatch) {
    return {
      isVideo: true,
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`,
      platform: 'facebook'
    }
  }

  // Instagram
  const instagramMatch = url.match(/instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/)
  if (instagramMatch) {
    return {
      isVideo: true,
      embedUrl: null, // Instagram requires oEmbed or embed script
      platform: 'instagram'
    }
  }

  return { isVideo: false, embedUrl: null, platform: null }
}

const videoInfo = computed(() => {
  if (!bookmark.value?.url) return { isVideo: false, embedUrl: null, platform: null }
  return detectVideo(bookmark.value.url)
})

// Switch to URL-only mode (remove scraped content)
async function switchToUrlOnly() {
  if (!bookmark.value) return

  if (confirm('This will remove the scraped content and keep only the URL and metadata. Continue?')) {
    try {
      await updateBookmark(bookmark.value.id, {
        original_html: null,
        cleaned_markdown: null,
      })
      bookmark.value.original_html = null
      bookmark.value.cleaned_markdown = null
    } catch (e) {
      console.error('Failed to switch to URL-only:', e)
    }
  }
}

// Sanitize snapshot HTML - remove scripts and event handlers
function sanitizeSnapshotHtml(html: string | null): string {
  if (!html) return ''
  
  // Create a temporary div to parse HTML
  const div = document.createElement('div')
  div.innerHTML = html
  
  // Remove all script tags
  const scripts = div.querySelectorAll('script')
  scripts.forEach(s => s.remove())
  
  // Remove inline event handlers (onclick, onload, etc.)
  const allElements = div.querySelectorAll('*')
  allElements.forEach(el => {
    const attributes = Array.from(el.attributes)
    attributes.forEach(attr => {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name)
      }
    })
    
    // Remove javascript: hrefs
    if (el.tagName === 'A') {
      const href = el.getAttribute('href')
      if (href?.startsWith('javascript:')) {
        el.removeAttribute('href')
        (el as HTMLElement).style.cursor = 'default'
      }
    }
  })
  
  return div.innerHTML
}

const wordCount = computed(() => {
  if (!editContent.value) return 0
  return editContent.value.split(/\s+/).filter((w: string) => w.length > 0).length
})

const charCount = computed(() => {
  return editContent.value?.length || 0
})

const availableTags = computed(() => {
  return allTags.value.filter((t: Tag) => !bookmarkTags.value.includes(t.name))
})

async function loadBookmark() {
  loading.value = true

  // Load tags first so colors are available
  await loadAllTags(true)

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

// Watch for tags modal open to ensure tags are loaded
watch(showTagsModal, async (isOpen) => {
  if (isOpen && allTags.value.length === 0) {
    await loadAllTags(true)
  }
})

// Handle tag updates from TagInput component
async function handleTagsUpdate(newTags: string[]) {
  if (!bookmark.value) return

  const oldTags: string[] = bookmark.value.tags || []

  // Use centralized sync function
  await syncItemTags(oldTags, newTags, bookmark.value.id, 'bookmark')

  // Update bookmark's tags
  bookmark.value.tags = newTags
}

// Handle creating a new tag - called when user presses Enter on a new tag name
async function handleCreateTag(name: string) {
  try {
    const newTag = await createTag({ name })

    if (newTag) {
      // Add to local tags list
      const tagData = allTags.value.find(t => t.id === newTag.id)
      if (!tagData) {
        allTags.value.push({ id: newTag.id, name: newTag.name, type: newTag.type })
      }

      // Call the TagInput component to add this tag to selected tags
      if (tagInputRef.value?.onTagCreated) {
        tagInputRef.value.onTagCreated({ id: newTag.id, name: newTag.name })
      }

      // Also add the tag to the bookmark
      if (bookmark.value) {
        await $fetch(`/api/bookmarks/${bookmark.value.id}/tags`, {
          method: 'POST',
          body: { tag_ids: [newTag.id] },
        })

        // Update local state
        if (!bookmarkTags.value.includes(newTag.name)) {
          bookmarkTags.value.push(newTag.name)
          bookmark.value.tags = [...bookmarkTags.value]
        }
      }
    }
  } catch (e) {
    console.error('Failed to create tag:', e)
  }
}

// Add tag by name (internal function) - uses centralized system
async function addTagByName(tagName: string) {
  // Import the function from the composable at the top level
  const tagSystem = useTagSystem()
  await tagSystem.addTagByName(tagName, bookmark.value.id, 'bookmark')
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

// Toolbar actions for the sticky toolbar - defined after all functions
const toolbarActions = computed(() => [
  {
    icon: 'heart' as const,
    title: bookmark.value?.is_favorite ? 'Remove from favorites' : 'Add to favorites',
    active: bookmark.value?.is_favorite,
    handler: () => toggleFavorite(),
  },
  {
    icon: 'tag' as const,
    title: 'Manage tags',
    handler: () => { showTagsModal.value = true },
  },
  {
    icon: 'edit' as const,
    title: 'Edit content',
    handler: () => { showEditModal.value = true },
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
    handler: () => { if (bookmark.value) deleteBookmarkConfirm(bookmark.value) },
  },
])

onMounted(() => {
  loadBookmark()
})
</script>
