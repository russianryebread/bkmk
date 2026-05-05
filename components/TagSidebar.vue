<template>
  <!-- Mobile overlay -->
  <div
    v-if="mobileOpen"
    class="fixed inset-0 bg-black/40 z-20 md:hidden"
    @click="$emit('update:mobileOpen', false)"
  />

  <!-- Sidebar -->
  <aside
    class="fixed md:sticky top-0 left-0 h-screen md:h-[calc(100vh-64px)] w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-30 flex flex-col transition-transform duration-200"
    :class="mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'"
  >
    <!-- Mobile close button -->
    <div class="md:hidden flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
      <span class="font-semibold text-gray-900 dark:text-white text-sm">Navigation</span>
      <button @click="$emit('update:mobileOpen', false)" class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Nav content (scrollable) -->
    <nav class="flex-1 overflow-y-auto py-3 px-2">

      <!-- Section: Views -->
      <div class="mb-1">
        <!-- Inbox -->
        <button
          @click="select('inbox')"
          class="sidebar-item w-full"
          :class="isActive('inbox') ? 'sidebar-item-active' : 'sidebar-item-inactive'"
        >
          <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <span class="flex-1 text-left">Inbox</span>
          <span v-if="inboxCount !== null" class="sidebar-count">{{ inboxCount }}</span>
        </button>

        <!-- All -->
        <button
          @click="select('all')"
          class="sidebar-item w-full"
          :class="isActive('all') ? 'sidebar-item-active' : 'sidebar-item-inactive'"
        >
          <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span class="flex-1 text-left">All</span>
          <span v-if="totalCount !== null" class="sidebar-count">{{ totalCount }}</span>
        </button>

        <!-- Favorites -->
        <button
          @click="select('favorites')"
          class="sidebar-item w-full"
          :class="isActive('favorites') ? 'sidebar-item-active' : 'sidebar-item-inactive'"
        >
          <svg class="w-4 h-4 flex-shrink-0" :class="isActive('favorites') ? '' : 'text-yellow-400'" fill="currentColor" viewBox="0 0 24 24">
            <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          <span class="flex-1 text-left">Favorites</span>
        </button>
      </div>

      <!-- Divider + Tags heading -->
      <div class="px-2 py-2 flex items-center justify-between">
        <span class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Tags</span>
        <button
          @click="showNewTagInput = !showNewTagInput"
          class="p-0.5 rounded text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          title="New tag"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <!-- New tag input -->
      <div v-if="showNewTagInput" class="px-2 mb-2">
        <div class="flex gap-1">
          <input
            v-model="newTagName"
            ref="newTagInputRef"
            type="text"
            placeholder="Tag name..."
            class="flex-1 text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-primary-500"
            @keydown.enter="createTag"
            @keydown.escape="cancelNewTag"
          />
          <button @click="createTag" class="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700">Add</button>
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="loadingTags" class="px-4 py-2 text-sm text-gray-400">Loading tags...</div>

      <!-- Tag tree -->
      <div v-else-if="tagTree.length > 0">
        <TagSidebarNode
          v-for="node in tagTree"
          :key="node.id"
          :node="node"
          :active-tag="activeTag"
          :mode="mode"
          @select="select"
        />
      </div>

      <div v-else class="px-4 py-2 text-sm text-gray-400 dark:text-gray-500 italic">
        No tags yet
      </div>

    </nav>

    <!-- Footer -->
    <div class="border-t border-gray-200 dark:border-gray-700 p-2">
      <NuxtLink
        to="/tags"
        class="sidebar-item sidebar-item-inactive w-full"
      >
        <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
        <span class="flex-1 text-left">Manage Tags</span>
      </NuxtLink>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { TagNode, Tag } from '~/composables/idb'
import { tagColorsMap } from '~/utils/tagColors'

const props = withDefaults(defineProps<{
  mode: 'bookmark' | 'note'
  currentView: string
  activeTag: string
  mobileOpen?: boolean
  inboxCount?: number | null
  totalCount?: number | null
}>(), {
  mobileOpen: false,
  inboxCount: null,
  totalCount: null,
})

const emit = defineEmits<{
  'update:mobileOpen': [value: boolean]
  'change': [view: string, tag: string]
}>()

const loadingTags = ref(false)
const tagTree = ref<TagNode[]>([])
const showNewTagInput = ref(false)
const newTagName = ref('')
const newTagInputRef = ref<HTMLInputElement | null>(null)

const { fetchTags, createTag: createTagFn, buildTree } = useTagSystem()

function isActive(view: string) {
  return props.currentView === view
}

function select(view: string, tagName?: string) {
  emit('change', view, tagName || '')
}

async function loadTags() {
  loadingTags.value = true
  try {
    const tags = await fetchTags(true)
    const filtered = props.mode === 'bookmark'
      ? tags.filter(t => t.type === 'bookmark' || t.type === 'both')
      : tags.filter(t => t.type === 'note' || t.type === 'both')
    tagTree.value = buildTree(filtered)
  } finally {
    loadingTags.value = false
  }
}

async function createTag() {
  const name = newTagName.value.trim()
  if (!name) return

  const tag = await createTagFn({
    name,
    type: props.mode === 'bookmark' ? 'bookmark' : 'note',
  })

  if (tag) {
    newTagName.value = ''
    showNewTagInput.value = false
    await loadTags()
  }
}

function cancelNewTag() {
  newTagName.value = ''
  showNewTagInput.value = false
}

watch(showNewTagInput, async (val) => {
  if (val) {
    await nextTick()
    newTagInputRef.value?.focus()
  }
})

onMounted(loadTags)

// Reload tags when they change (e.g. after tagging a bookmark)
defineExpose({ reload: loadTags })
</script>

<style scoped>
.sidebar-item {
  @apply flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors;
}

.sidebar-item-active {
  @apply bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300;
}

.sidebar-item-inactive {
  @apply text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700;
}

.sidebar-count {
  @apply text-xs text-gray-400 dark:text-gray-500 tabular-nums;
}
</style>
