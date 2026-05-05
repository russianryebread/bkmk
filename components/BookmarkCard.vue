<template>
  <div
    class="card p-4 hover:shadow-md transition-shadow cursor-pointer flex flex-col gap-2"
    @click="$emit('click')"
  >
    <div class="flex items-start justify-between gap-2">
      <h3 class="font-medium text-gray-900 dark:text-white line-clamp-2 flex-1 text-sm leading-snug">
        {{ bookmark.title }}
      </h3>
      <button
        @click.stop="$emit('favorite')"
        class="p-1 flex-shrink-0 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <svg
          class="w-4 h-4 transition-colors"
          :class="bookmark.isFavorite ? 'text-yellow-400 fill-current' : 'text-gray-300 dark:text-gray-600 hover:text-yellow-300'"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      </button>
    </div>

    <div class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
      <span class="truncate">{{ bookmark.sourceDomain }}</span>
      <span v-if="bookmark.readingTimeMinutes" class="flex-shrink-0">· {{ bookmark.readingTimeMinutes }}m</span>
      <span v-if="!bookmark.isRead" class="ml-auto flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary-500" title="Unread" />
    </div>

    <p v-if="bookmark.description" class="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
      {{ bookmark.description }}
    </p>

    <div v-if="bookmark.tags && bookmark.tags.length > 0" class="flex flex-wrap gap-1 mt-auto pt-1">
      <span
        v-for="tag in bookmark.tags.slice(0, 3)"
        :key="tag"
        class="px-1.5 py-0.5 text-xs rounded"
        :style="{ backgroundColor: getTagColor(tag).bg, color: getTagColor(tag).text }"
      >
        {{ tag }}
      </span>
      <span v-if="bookmark.tags.length > 3" class="text-xs text-gray-400 self-center">
        +{{ bookmark.tags.length - 3 }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Bookmark } from '~/composables/idb'

const props = defineProps<{
  bookmark: Bookmark
}>()

defineEmits<{ click: []; favorite: [] }>()

const { getTagColor } = useTagSystem()
</script>
