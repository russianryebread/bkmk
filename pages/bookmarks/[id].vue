<template>
  <div class="min-h-[calc(var(--dvh)-110px)] md:min-h-[calc(var(--dvh)-136px)] flex flex-col">
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
          :disabled="saving || (!isNew && editing && !hasChanges)">
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

    <!-- Bookmark View/Edit -->
    <div v-if="bookmark || isNew" key="content" class="flex-1 flex flex-col">
      <!-- Metadata and tags (view mode - existing bookmark) -->
      <template v-if="!isNew && !editing">
        <!-- Title -->
        <h1 class="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
          {{ bookmark.title }}
        </h1>

        <a :href="bookmark.url" target="_blank" rel="noopener"
          class="hover:text-primary-600 mb-2 inline-block text-sm text-gray-500 dark:text-gray-400">
          {{ bookmark.sourceDomain }}
        </a>

        <div class="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4">
          <span>Saved {{ formatDateFull(bookmark.savedAt) }}</span>
          <span v-if="bookmark.readingTimeMinutes" class="mx-2">•</span>
          <span v-if="bookmark.readingTimeMinutes">{{ bookmark.readingTimeMinutes }} min read</span>
        </div>

        <div v-if="bookmark.tags && bookmark.tags.length > 0" class="flex flex-wrap gap-2">
          <span v-for="tag in bookmark.tags" :key="tag" class="px-2.5 py-0.5 text-xs rounded-full"
            :style="{ backgroundColor: getTagColor(tag).bg, color: getTagColor(tag).text }">
            {{ tag }}
          </span>
        </div>

        <hr class="my-4 border-gray-200 dark:border-gray-700" />

        <div class="prose dark:prose-invert max-w-none reader-content"
          :class="[fontFamily === 'serif' ? 'font-serif' : 'font-sans']"
          :style="{ fontSize: fontSize + 'px' }"
          v-html="renderedMarkdown"></div>
      </template>

      <!-- Editor mode (new or editing) -->
      <div v-else class="flex-1 flex flex-col">
        <div class="mb-4">
          <input v-model="editorUrl" type="url"
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary-500 focus:border-transparent"
            placeholder="https://..." v-if="isNew && bookmark" />
          <div v-else class="font-mono text-xs text-gray-500">{{ editorUrl }}</div>
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
          class="flex justify-between items-center gap-8 p-4 -mb-4 -mx-4 bg-gray-50 dark:bg-gray-800 sm:rounded-xl">
          <div class="text-sm text-gray-500 dark:text-gray-400 hidden md:block">
            {{ editorWordCount }} words
          </div>

          <!-- Tags Section -->
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <TagInput
              v-model="editorTags"
              tag-type="bookmark"
              placeholder="Add tag..."
              class="flex-1 min-w-[180px]"
              @createTag="handleCreateTag"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Error: Bookmark not found -->
    <div v-else key="notfound" class="text-center py-12">
      <p class="text-gray-500 dark:text-gray-400">Bookmark not found</p>
      <NuxtLink to="/bookmarks" class="btn-primary mt-4">Go Back</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Action } from '~/utils/types'
import type { Bookmark } from '~/composables/idb'

import { formatDateFull } from '~/utils/date'
import { useTagSystem } from '~/composables/useTagSystem'
import { useViewportHeight } from '~/composables/useViewportHeight'
import { useDataStore } from '~/stores/useDataStore'

const route = useRoute()
const router = useRouter()
const { render } = useMarkdown()
const { fontSize, fontFamily } = useReaderSettings()
const dataStore = useDataStore()

const {
  getTagColor,
  createTag,
} = useTagSystem()

async function handleCreateTag(name: string) {
  await createTag({ name })
}

// State
const bookmark = ref<Bookmark | null>(null)
const loading = ref(true)
const editing = ref(false)
const editorTitle = ref('')
const editorUrl = ref('')
const editorContent = ref('')
const editorTags = ref<string[]>([])
const saving = ref(false)

const isNew = computed(() => route.params.id === 'new')

const renderedMarkdown = computed(() => {
  if (!bookmark.value?.cleanedMarkdown) return ''
  return render(bookmark.value.cleanedMarkdown)
})

const editorWordCount = computed(() => {
  if (!editorContent.value) return 0
  return editorContent.value.split(/\s+/).filter(w => w.length > 0).length
})

const hasChanges = computed(() => {
  if (!bookmark.value) return editorContent.value.trim() || editorTitle.value.trim()
  return editorTitle.value !== bookmark.value.title ||
    editorContent.value !== (bookmark.value.cleanedMarkdown || '') ||
    JSON.stringify(editorTags.value) !== JSON.stringify(bookmark.value.tags || [])
})

function initNewBookmark() {
  editorTitle.value = ''
  editorUrl.value = ''
  editorContent.value = ''
  editorTags.value = []
  editing.value = true
  bookmark.value = null
}

function initFromBookmark() {
  if (bookmark.value) {
    editorTitle.value = bookmark.value.title || ''
    editorUrl.value = bookmark.value.url || ''
    editorContent.value = bookmark.value.cleanedMarkdown || ''
    editorTags.value = [...(bookmark.value.tags || [])]
  }
}

// Show the locally cached bookmark immediately (it carries cleanedMarkdown, so
// it renders fully offline), then refresh from the server in the background.
async function loadBookmark() {
  loading.value = true
  const id = route.params.id as string

  const local = dataStore.getBookmarkById(id)
  if (local) {
    bookmark.value = { ...local }
    initFromBookmark()
    loading.value = false
  }

  try {
    const fresh = await $fetch<Bookmark>(`/api/bookmarks/${id}`)
    bookmark.value = fresh
    initFromBookmark()
    // Persist the freshest content so it stays available offline.
    await dataStore.cacheBookmark(fresh)
  } catch {
    if (!local) bookmark.value = null
  } finally {
    loading.value = false
  }

  // Viewing the detail page counts as reading — clear the unread indicator.
  if (bookmark.value && !bookmark.value.isRead) {
    await dataStore.markBookmarkRead(id)
    bookmark.value.isRead = true
    bookmark.value.readAt = new Date().toISOString()
  }
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

async function saveBookmark() {
  saving.value = true
  try {
    if (isNew.value) {
      if (!editorUrl.value.trim()) {
        alert('Please enter a URL')
        return
      }
      const created = await dataStore.createBookmark(editorUrl.value)
      if (created?.id) {
        await dataStore.updateBookmark(created.id, {
          title: editorTitle.value || editorUrl.value,
          cleanedMarkdown: editorContent.value,
          tags: [...editorTags.value],
        })
        router.replace(`/bookmarks/${created.id}`)
      }
    } else if (bookmark.value) {
      const id = bookmark.value.id
      await dataStore.updateBookmark(id, {
        title: editorTitle.value,
        cleanedMarkdown: editorContent.value,
        tags: [...editorTags.value],
      })
      bookmark.value = {
        ...bookmark.value,
        title: editorTitle.value,
        cleanedMarkdown: editorContent.value,
        tags: [...editorTags.value],
        updatedAt: new Date().toISOString(),
      }
      editing.value = false
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
  bookmark.value.isFavorite = !bookmark.value.isFavorite
}

async function deleteBookmarkConfirm() {
  if (!bookmark.value) return
  if (confirm(`Delete "${bookmark.value.title}"?`)) {
    await dataStore.deleteBookmark(bookmark.value.id)
    router.push('/bookmarks')
  }
}

async function loadForRoute(id: string | string[]) {
  if (id === 'new') {
    initNewBookmark()
    loading.value = false
  } else {
    await loadBookmark()
  }
}

// Load on the client only. Bookmark data lives in IndexedDB, so server-side
// rendering can never resolve it — running the load during SSR would render
// the "not found" branch and corrupt hydration. Both SSR and the first client
// render show the loading branch; the keyed branch swap then happens on mount.
onMounted(() => loadForRoute(route.params.id))

// Watch for route changes to reload data (client-side navigation)
watch(() => route.params.id, (newId) => loadForRoute(newId))

async function convertToLink() {
  if (!bookmark.value) return
  if (!confirm('Convert this to a plain link? Reader content and images will be permanently discarded.')) {
    return
  }
  const ok = await dataStore.convertBookmarkToLink(bookmark.value.id)
  if (ok) {
    const updated = dataStore.getBookmarkById(bookmark.value.id)
    if (updated) {
      bookmark.value = { ...updated }
      initFromBookmark()
    }
  }
}

const toolbarActions = computed<Action[]>(() => {
  const hasReaderContent =
    bookmark.value?.readingTimeMinutes != null || bookmark.value?.wordCount != null

  return [
    {
      icon: 'heart' as const,
      title: bookmark.value?.isFavorite ? 'Remove from favorites' : 'Add to favorites',
      active: bookmark.value?.isFavorite,
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
    ...(hasReaderContent
      ? [{
          icon: 'link' as const,
          title: 'Convert to link',
          handler: () => convertToLink(),
        }]
      : []),
    {
      icon: 'trash' as const,
      title: 'Delete bookmark',
      variant: 'danger' as const,
      handler: () => deleteBookmarkConfirm(),
    },
  ]
})

useViewportHeight()

onBeforeRouteLeave((to, from) => {
  if (editing.value && hasChanges.value) {
    return confirm('You have unsaved changes. Are you sure you want to leave?')
  }
})
</script>
