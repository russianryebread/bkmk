<template>
  <div>
    <div v-if="bookmark" class="max-w-4xl mx-auto">
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
            
            <a :href="bookmark.url" target="_blank" class="btn-secondary">
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open Original
            </a>
          </div>
        </div>

        <!-- Tags -->
        <div v-if="bookmark.tags.length > 0" class="flex flex-wrap gap-2">
          <span
            v-for="tag in bookmark.tags"
            :key="tag"
            class="tag"
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
        <div v-if="currentMode === 'reader'" class="reader-content" v-html="renderedMarkdown"></div>
        
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
            Copy Markdown
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
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { fetchBookmark, updateBookmark } = useBookmarks()
const { render } = useMarkdown()

const bookmark = ref<any>(null)
const loading = ref(true)
const currentMode = ref('reader')

const modes = [
  { id: 'reader', label: 'Reader' },
  { id: 'snapshot', label: 'Snapshot' },
  { id: 'markdown', label: 'Markdown' },
]

const renderedMarkdown = computed(() => {
  if (!bookmark.value?.cleaned_markdown) return ''
  return render(bookmark.value.cleaned_markdown)
})

async function loadBookmark() {
  loading.value = true
  const id = route.params.id as string
  bookmark.value = await fetchBookmark(id)
  loading.value = false
  
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

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

onMounted(() => {
  loadBookmark()
})
</script>
