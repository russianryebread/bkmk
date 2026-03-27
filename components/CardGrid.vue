<template>
  <div>
    <!-- Grid View -->
    <div v-if="viewMode === 'card'" class="grid gap-4" :class="gridClasses">
      <slot name="card" :item="item" :index="index" v-for="(item, index) in items"></slot>
    </div>

    <!-- List View -->
    <div v-else class="space-y-2">
      <slot name="list" :item="item" :index="index" v-for="(item, index) in items"></slot>
    </div>

    <!-- Empty State -->
    <div v-if="items.length === 0 && $slots.empty" class="py-12">
      <slot name="empty"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ViewMode } from '~/composables/useViewMode'

const props = withDefaults(defineProps<{
  items: any[]
  viewMode: ViewMode
  gridCols?: string
}>(), {
  gridCols: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
})

const gridClasses = computed(() => props.gridCols)
</script>
