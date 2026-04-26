<template>
  <div
    class="infinite-item-list"
    ref="containerRef"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
  >
    <!-- Pull to Refresh Indicator -->
    <div
      class="pull-to-refresh-indicator"
      :class="{
        'pulling': isPulling,
        'ready': pullDistance >= pullThreshold && !isRefreshing,
        'refreshing': isRefreshing
      }"
      :style="{ height: `${pullDistance}px` }"
    >
      <div class="pull-indicator-content">
        <svg v-if="!isRefreshing" class="pull-arrow" :class="{ 'rotated': pullDistance >= pullThreshold }" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12l7-7 7 7" />
        </svg>
        <svg v-else class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span v-if="!isRefreshing" class="text-sm text-gray-500 dark:text-gray-400">
          {{ pullDistance >= pullThreshold ? 'Release to refresh' : 'Pull to refresh' }}
        </span>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">Refreshing...</span>
      </div>
    </div>

    <!-- Header with Search and Actions -->
    <div class="flex flex-row gap-4 mb-6">
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
      <div v-else class="card">
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
  // Enable pull to refresh
  pullToRefresh?: boolean
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
  pullToRefresh: true,
})

const emit = defineEmits<{
  search: [query: string]
  tagChange: [tag: string | null]
  loadMore: []
  retry: []
  refresh: []
}>()

const { viewMode } = useViewMode()
const searchInputRef = ref<HTMLInputElement | null>(null)
const sentinelRef = ref<HTMLElement | null>(null)
const localSearchQuery = ref('')

// Pull to refresh state
const containerRef = ref<HTMLElement | null>(null)
const pullDistance = ref(0)
const isPulling = ref(false)
const isRefreshing = ref(false)
const pullThreshold = 80
const startY = ref(0)
const currentY = ref(0)

// Handle search input with debounce
function handleSearchInput() {
  emit('search', localSearchQuery.value)
}

// Handle tag change
function handleTagChange(tag: string) {
  emit('tagChange', tag || null)
}

// Pull to refresh handlers
function handleTouchStart(e: TouchEvent) {
  if (!props.pullToRefresh) return
  if (isRefreshing.value) return

  // Only activate when scrolled near top
  if (containerRef.value && containerRef.value.scrollTop > 10) return

  isPulling.value = true
  startY.value = e.touches[0].clientY
  currentY.value = startY.value
}

function handleTouchMove(e: TouchEvent) {
  if (!props.pullToRefresh || !isPulling.value) return

  currentY.value = e.touches[0].clientY
  const diff = currentY.value - startY.value

  // Only allow pulling down (positive diff)
  if (diff > 0) {
    // Apply resistance to make it feel natural
    pullDistance.value = Math.min(diff * 0.5, pullThreshold * 1.5)
    e.preventDefault()
  }
}

function handleTouchEnd() {
  if (!props.pullToRefresh || !isPulling.value) return

  isPulling.value = false

  if (pullDistance.value >= pullThreshold && !isRefreshing.value) {
    // Trigger refresh
    triggerRefresh()
  } else {
    // Reset
    pullDistance.value = 0
  }
}

function triggerRefresh() {
  isRefreshing.value = true
  emit('refresh')

  // Reset after a delay (parent should call resetRefreshing when done)
  setTimeout(() => {
    if (isRefreshing.value) {
      isRefreshing.value = false
      pullDistance.value = 0
    }
  }, 2000)
}

// Called by parent to signal refresh is complete
function resetRefreshing() {
  isRefreshing.value = false
  pullDistance.value = 0
}

// Expose for parent components
defineExpose({
  focusSearch: () => searchInputRef.value?.focus(),
  clearSearch: () => {
    localSearchQuery.value = ''
    emit('search', '')
  },
  resetRefreshing,
})

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
</script>

<style scoped>
.infinite-item-list {
  @apply w-full;
  touch-action: pan-y;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* Pull to Refresh Indicator */
.pull-to-refresh-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  height: 0;
  transition: height 0.2s ease-out;
}

.pull-to-refresh-indicator.pulling {
  transition: none;
}

.pull-to-refresh-indicator.ready {
  height: 80px;
}

.pull-to-refresh-indicator.refreshing {
  height: 60px;
}

.pull-indicator-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.pull-arrow {
  transition: transform 0.2s ease;
  color: #6b7280;
}

.pull-arrow.rotated {
  transform: rotate(180deg);
}

.dark .pull-arrow {
  color: #9ca3af;
}
</style>
