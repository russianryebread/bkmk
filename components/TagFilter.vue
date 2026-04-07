<template>
  <div class="flex flex-wrap gap-2">
    <button
      @click="$emit('update:selectedTag', '')"
      class="px-3 py-1 text-sm rounded-full transition-colors"
      :class="selectedTag === ''
        ? 'bg-primary-600 text-white'
        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'"
    >
      All
    </button>
    <button
      v-if="showFavorites"
      @click="$emit('update:selectedTag', 'favorite')"
      class="px-3 py-1 text-sm rounded-full transition-colors flex items-center gap-1"
      :class="selectedTag === 'favorite'
        ? 'bg-primary-600 text-white'
        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'"
    >
      <svg class="w-4 h-4" :class="selectedTag === 'favorite' ? 'text-white' : 'text-gray-500'" fill="currentColor"
        viewBox="0 0 24 24">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
      Favorites
    </button>
    <button
      v-for="tag in tags"
      :key="tag.name"
      @click="$emit('update:selectedTag', tag.name)"
      class="px-3 py-1 text-sm rounded-full transition-colors"
      :style="selectedTag === tag.name ? {} : { backgroundColor: getTagColor(tag.name).bg, color: getTagColor(tag.name).text, borderColor: getTagColor(tag.name).bg }"
      :class="selectedTag === tag.name ? 'bg-primary-600 text-white' : ''"
    >
      {{ tag.name }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useTagSystem } from '~/composables/useTagSystem'

interface Tag {
  id: string
  name: string
  type: string
  parentTagId?: string | null
}

withDefaults(defineProps<{
  tags: Tag[]
  selectedTag: string
  showFavorites?: boolean
}>(), {
  showFavorites: false
})

defineEmits<{
  'update:selectedTag': [value: string]
}>()

const { getTagColor } = useTagSystem()
</script>
