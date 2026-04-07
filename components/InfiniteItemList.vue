<template>
  <div class="infinite-item-list">
    <!-- Header with Search and Actions -->
    <div class="flex flex-col sm:flex-row gap-4 mb-6">
      <!-- Search -->
      <div class="flex-1">
        <div class="relative">
          <input
            ref="searchInputRef"
            v-model="localSearchQuery"
            type="text"
            :placeholder="searchPlaceholder"
            class="input pl-10"
            @input="handleSearchInput"
          />
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex gap-2">
        <ViewToggle />
        <slot name="actions"></slot>
      </div>
    </div>

    <!-- Filters -->
    <div v-if="showFilters" class="mb-6">
      <TagFilter
        :tags="availableTags"
        :selected-tag="selectedTag"
        :show-favorites="showFavorites"
        @update:selected-tag="handleTagChange"
      />
    </div>

    <!-- Loading State -->
    <div v-if="loading && items.length === 0" class="flex justify-center py-12">
      <svg class="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>

    <!-- Error State -->
    <div v-else-if="error && items.length === 0" class="card p-6 text-center">
      <p class="text-red-600 dark:text-red-400 mb-4">{{ error }}</p>
      <button @click="$emit('retry')" class="btn-secondary">Try Again</button>
    </div>

    <!-- Empty State -->
    <div v-else-if="items.length === 0" class="card p-12 text-center">
      <slot name="empty">
        <svg class="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">{{ emptyTitle }}</h3>
        <p class="text-gray-500 dark:text-gray-400">{{ emptyDescription }}</p>
      </slot>
    </div>

    <!-- Items -->
    <div v-else>
      <!-- Card View -->
      <div v-if="viewMode === 'card'" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <slot name="card" v-for="(item, index) in items" :item="item" :index="index"></slot>
      </div>

      <!-- List View -->
      <div v-else class="space-y-2">
        <slot name="list" v-for="(item, index) in items" :item="item" :index="index"></slot>
      </div>

      <!-- Loading More Indicator -->
      <div v-if="loadingMore" class="flex justify-center py-8">
        <svg class="animate-spin h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>

      <!-- Load More Button (fallback if intersection observer fails) -->
      <div v-else-if="hasMore" class="flex justify-center py-4">
        <button @click="$emit('loadMore')" class="btn-secondary">
          Load More
        </button>
      </div>

      <!-- End of List -->
      <div v-if="!hasMore && items.length > 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
        <slot name="endOfList">
          <p>You've reached the end</p>
        </slot>
      </div>
    </div>

    <!-- Intersection Observer Target for Infinite Scroll -->
    <div ref="sentinelRef" class="h-px" aria-hidden="true"></div>
  </div>
</template>

<script setup lang="ts">
import { useViewMode } from '~/composables/useViewMode'

interface Tag {
  id: string
  name: string
  type: string
  parentTagId?: string | null
}

const props = withDefaults(defineProps<{
  // Items to display
  items: any[]
  // Loading states
  loading?: boolean
  loadingMore?: boolean
  // Pagination
  hasMore?: boolean
  // Error
  error?: string | null
  // Tags for filtering
  availableTags?: Tag[]
  // Show filters
  showFilters?: boolean
  showFavorites?: boolean
  // Placeholders
  searchPlaceholder?: string
  emptyTitle?: string
  emptyDescription?: string
  // Initial selected tag
  selectedTag?: string
}>(), {
  items: () => [],
  loading: false,
  loadingMore: false,
  hasMore: true,
  error: null,
  availableTags: () => [],
  showFilters: true,
  showFavorites: true,
  searchPlaceholder: 'Search...',
  emptyTitle: 'No items found',
  emptyDescription: 'Try adjusting your search or filters',
  selectedTag: '',
})

const emit = defineEmits<{
  search: [query: string]
  tagChange: [tag: string | null]
  loadMore: []
  retry: []
}>()

const { viewMode } = useViewMode()
const searchInputRef = ref<HTMLInputElement | null>(null)
const sentinelRef = ref<HTMLElement | null>(null)
const localSearchQuery = ref('')

// Handle search input with debounce
function handleSearchInput() {
  emit('search', localSearchQuery.value)
}

// Handle tag change
function handleTagChange(tag: string) {
  emit('tagChange', tag || null)
}

// Focus search on mount if requested
onMounted(() => {
  // Listen for '/' key to focus search
  const handleGlobalKeydown = (e: KeyboardEvent) => {
    if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
      e.preventDefault()
      searchInputRef.value?.focus()
    }
  }

  window.addEventListener('keydown', handleGlobalKeydown)

  onUnmounted(() => {
    window.removeEventListener('keydown', handleGlobalKeydown)
  })
})

// Intersection Observer for infinite scroll
let observer: IntersectionObserver | null = null

onMounted(() => {
  if (sentinelRef.value) {
    observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting && props.hasMore && !props.loadingMore && !props.loading) {
          emit('loadMore')
        }
      },
      {
        rootMargin: '100px',
        threshold: 0.1,
      }
    )
    observer.observe(sentinelRef.value)
  }
})

onUnmounted(() => {
  if (observer) {
    observer.disconnect()
  }
})

// Expose methods for parent components
defineExpose({
  focusSearch: () => searchInputRef.value?.focus(),
  clearSearch: () => {
    localSearchQuery.value = ''
    emit('search', '')
  },
})
</script>

<style scoped>
.infinite-item-list {
  @apply w-full;
}
</style>
