// Client-side pagination + infinite-scroll for an in-memory list. The full
// (filtered) list lives in the caller's reactive state — this composable only
// owns the "how many to show" cursor and the IntersectionObserver wiring.
//
// Pagination resets to PAGE_SIZE whenever any of `resetTriggers` change (e.g.
// a search query or active filter).
import type { ComputedRef, WatchSource } from 'vue'

interface Options<T> {
  items: ComputedRef<T[]>
  pageSize?: number
  resetTriggers?: WatchSource[]
}

export function usePaginatedList<T>({ items, pageSize = 25, resetTriggers = [] }: Options<T>) {
  const displayedCount = ref(pageSize)
  const loadingMore = ref(false)
  const sentinelRef = ref<HTMLElement | null>(null)

  const visible = computed(() => items.value.slice(0, displayedCount.value))
  const hasMore = computed(() => displayedCount.value < items.value.length)

  if (resetTriggers.length > 0) {
    watch(resetTriggers, () => {
      displayedCount.value = pageSize
    })
  }

  function loadMore() {
    if (!hasMore.value || loadingMore.value) return
    loadingMore.value = true
    displayedCount.value = Math.min(displayedCount.value + pageSize, items.value.length)
    loadingMore.value = false
  }

  let observer: IntersectionObserver | null = null
  watch(sentinelRef, (el) => {
    observer?.disconnect()
    observer = null
    if (!el) return
    observer = new IntersectionObserver(
      ([entry]) => { if (entry?.isIntersecting) loadMore() },
      { rootMargin: '200px' },
    )
    observer.observe(el)
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
    observer = null
  })

  return { visible, hasMore, loadingMore, loadMore, sentinelRef }
}
