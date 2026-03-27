<template>
  <div class="relative">
    <!-- Selected tags -->
    <div v-if="modelValue && modelValue.length > 0" class="flex flex-wrap gap-2 mb-2">
      <span
        v-for="tag in modelValue"
        :key="tag"
        class="inline-flex items-center gap-1 px-2 py-1 text-sm rounded-full"
        :style="{ backgroundColor: getTagColor(tag).bg, color: getTagColor(tag).text }"
      >
        {{ tag }}
        <button @click="removeTag(tag)" class="hover:opacity-75">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </span>
    </div>

    <!-- Input with typeahead -->
    <div class="relative">
      <input
        v-model="searchQuery"
        type="text"
        :placeholder="placeholder"
        class="input w-full"
        @focus="showDropdown = true"
        @blur="handleBlur"
        @keydown.down.prevent="navigateDown"
        @keydown.up.prevent="navigateUp"
        @keydown.enter.prevent="selectHighlighted"
        @keydown.escape="showDropdown = false"
        @keydown.backspace="handleBackspace"
      />

      <!-- Dropdown -->
      <div
        v-if="showDropdown && filteredTags.length > 0"
        class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto"
      >
        <button
          v-for="(tag, index) in filteredTags"
          :key="tag.id"
          @mousedown.prevent="selectTag(tag)"
          :class="[
            'w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700',
            index === highlightedIndex ? 'bg-gray-100 dark:bg-gray-700' : ''
          ]"
        >
          <span
            class="px-2 py-0.5 text-xs rounded-full mr-2"
            :style="{ backgroundColor: getTagColor(tag.name).bg, color: getTagColor(tag.name).text }"
          >
            {{ tag.name }}
          </span>
          <span v-if="tag.bookmarkCount" class="text-xs text-gray-500">
            {{ tag.bookmarkCount }} bookmark{{ tag.bookmarkCount !== 1 ? 's' : '' }}
          </span>
        </button>
      </div>
    </div>

    <!-- No results hint -->
    <p v-if="showDropdown && searchQuery && filteredTags.length === 0" class="text-xs text-gray-500 mt-1">
      Press Enter to create "{{ searchQuery }}"
    </p>
  </div>
</template>

<script setup lang="ts">
import { useTagColors } from '~/composables/useTagColors'

interface Tag {
  id: string
  name: string
  bookmarkCount?: number
}

const props = defineProps<{
  modelValue: string[]
  placeholder?: string
  excludeCurrentTags?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
  (e: 'createTag', name: string): void
  (e: 'tagCreated', tag: { id: string; name: string }): void
}>()

const { allTags, getTagColor, loadAllTags } = useTagColors()

const searchQuery = ref('')
const showDropdown = ref(false)
const highlightedIndex = ref(-1)
const creatingTag = ref(false)

const filteredTags = computed(() => {
  if (!allTags.value) return []
  
  let tags = allTags.value
  
  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    tags = tags.filter(t => t.name.toLowerCase().includes(query))
  }
  
  // Exclude already selected tags if specified
  if (props.excludeCurrentTags !== false) {
    tags = tags.filter(t => !props.modelValue.includes(t.name))
  }
  
  return tags.slice(0, 10) // Limit to 10 results
})

function removeTag(tag: string) {
  emit('update:modelValue', props.modelValue.filter(t => t !== tag))
}

function selectTag(tag: Tag) {
  if (!props.modelValue.includes(tag.name)) {
    emit('update:modelValue', [...props.modelValue, tag.name])
  }
  searchQuery.value = ''
  showDropdown.value = false
  highlightedIndex.value = -1
}

async function createTag(name: string) {
  if (creatingTag.value) return
  creatingTag.value = true
  
  try {
    // Emit event to parent to handle tag creation
    emit('createTag', name)
    
    // Clear input
    searchQuery.value = ''
    showDropdown.value = false
    highlightedIndex.value = -1
  } finally {
    creatingTag.value = false
  }
}

// Expose method for parent to call when tag is created
function onTagCreated(tagInfo: { id: string; name: string }) {
  // Refresh the allTags list to include the new tag
  loadAllTags(true)
  
  // Add the tag to selected tags
  if (!props.modelValue.includes(tagInfo.name)) {
    emit('update:modelValue', [...props.modelValue, tagInfo.name])
  }
}

// Expose to parent
defineExpose({ onTagCreated })

function navigateDown() {
  if (filteredTags.value.length > 0) {
    highlightedIndex.value = Math.min(highlightedIndex.value + 1, filteredTags.value.length - 1)
  }
}

function navigateUp() {
  if (filteredTags.value.length > 0) {
    highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0)
  }
}

function selectHighlighted() {
  const query = searchQuery.value.trim()
  if (!query) return

  // Check if highlighted item exists
  if (highlightedIndex.value >= 0 && filteredTags.value[highlightedIndex.value]) {
    selectTag(filteredTags.value[highlightedIndex.value])
    return
  }

  // Check if exact match exists in the dropdown
  const exactMatch = filteredTags.value.find(t => t.name.toLowerCase() === query.toLowerCase())
  if (exactMatch) {
    selectTag(exactMatch)
    return
  }

  // No match found - create new tag
  createTag(query)
}

function handleBackspace() {
  if (!searchQuery.value && props.modelValue.length > 0) {
    // Remove last tag when backspace is pressed with empty input
    emit('update:modelValue', props.modelValue.slice(0, -1))
  }
}

function handleBlur() {
  // Delay to allow click on dropdown items
  setTimeout(() => {
    showDropdown.value = false
    highlightedIndex.value = -1
  }, 200)
}

// Watch for external changes to modelValue
watch(() => props.modelValue, (newVal) => {
  // Clear search if all tags are selected
  if (newVal.length === 0) {
    searchQuery.value = ''
  }
}, { deep: true })
</script>
