<template>
  <div>
    <button
      class="sidebar-item w-full group"
      :class="[
        isActive ? 'sidebar-item-active' : 'sidebar-item-inactive',
        `pl-${3 + node.depth * 3}`,
      ]"
      :style="{ paddingLeft: `${12 + node.depth * 12}px` }"
      @click="handleClick"
    >
      <!-- Expand/collapse chevron for nodes with children -->
      <button
        v-if="node.children.length > 0"
        class="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 flex-shrink-0 -ml-1"
        @click.stop="toggleExpand"
      >
        <svg
          class="w-3 h-3 transition-transform"
          :class="expanded ? 'rotate-90' : ''"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      <span v-else class="w-3 flex-shrink-0" />

      <!-- Color dot -->
      <span
        v-if="node.color"
        class="w-2 h-2 rounded-full flex-shrink-0"
        :style="{ backgroundColor: colorBg }"
      />
      <svg
        v-else
        class="w-3.5 h-3.5 flex-shrink-0 opacity-50"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>

      <span class="flex-1 text-left truncate">{{ node.name }}</span>

      <span v-if="count !== undefined && count !== null" class="sidebar-count">{{ count }}</span>
    </button>

    <!-- Children -->
    <div v-if="expanded && node.children.length > 0">
      <TagSidebarNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :active-tag="activeTag"
        :mode="mode"
        @select="$emit('select', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TagNode } from '~/composables/idb'
import { tagColorsMap } from '~/utils/tagColors'

const props = defineProps<{
  node: TagNode
  activeTag: string
  mode: 'bookmark' | 'note'
}>()

const emit = defineEmits<{
  select: [view: string, tagName?: string]
}>()

const expanded = ref(false)

const isActive = computed(() => props.activeTag === props.node.name)

const count = computed(() => {
  if (props.mode === 'bookmark') return props.node.bookmarkCount ?? null
  return (props.node as any).noteCount ?? null
})

const colorBg = computed(() => {
  if (!props.node.color) return null
  return tagColorsMap[props.node.color]?.bg || null
})

function handleClick() {
  emit('select', 'tag', props.node.name)
}

function toggleExpand() {
  expanded.value = !expanded.value
}
</script>

<style scoped>
.sidebar-item {
  @apply flex items-center gap-1.5 py-1.5 pr-3 rounded-lg text-sm font-medium transition-colors;
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
