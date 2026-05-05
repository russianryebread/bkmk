<template>
  <div ref="rootRef" class="relative">
    <div
      class="input flex flex-wrap items-center gap-1.5 min-h-[38px] cursor-text"
      :class="{ 'ring-2 ring-primary-500 border-transparent': focused }"
      @mousedown="onContainerMousedown"
    >
      <span
        v-for="tag in modelValue"
        :key="tag"
        class="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full whitespace-nowrap"
        :style="{ backgroundColor: getTagColor(tag).bg, color: getTagColor(tag).text }"
      >
        {{ tag }}
        <button
          type="button"
          tabindex="-1"
          class="hover:opacity-75"
          @mousedown.prevent
          @click.stop="removeTag(tag)"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </span>

      <input
        ref="inputRef"
        v-model="searchQuery"
        type="text"
        :placeholder="modelValue.length === 0 ? placeholder : ''"
        class="flex-1 min-w-[80px] bg-transparent border-none outline-none text-sm py-0.5"
        @focus="onFocus"
        @blur="onBlur"
        @keydown.down.prevent="navigateDown"
        @keydown.up.prevent="navigateUp"
        @keydown.enter.prevent="selectHighlighted"
        @keydown.tab="onTab"
        @keydown.escape="closeDropdown"
        @keydown.backspace="handleBackspace"
      />
    </div>

    <div
      v-if="showDropdown && (filteredTags.length > 0 || canCreate)"
      :class="[
        'absolute z-20 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-56 overflow-y-auto',
        dropUp ? 'bottom-full mb-1' : 'top-full mt-1',
      ]"
    >
      <button
        v-for="(tag, index) in filteredTags"
        :key="tag.id"
        type="button"
        @mousedown.prevent="selectTag(tag)"
        :class="[
          'w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700',
          index === highlightedIndex ? 'bg-gray-100 dark:bg-gray-700' : ''
        ]"
      >
        <span
          class="px-2 py-0.5 text-xs rounded-full"
          :style="{ backgroundColor: getTagColor(tag.name).bg, color: getTagColor(tag.name).text }"
        >
          {{ tag.name }}
        </span>
        <span v-if="tag.bookmarkCount" class="text-xs text-gray-500">
          {{ tag.bookmarkCount }} bookmark{{ tag.bookmarkCount !== 1 ? 's' : '' }}
        </span>
      </button>

      <button
        v-if="canCreate"
        type="button"
        @mousedown.prevent="createFromQuery"
        :class="[
          'w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
          highlightedIndex === filteredTags.length ? 'bg-gray-100 dark:bg-gray-700' : ''
        ]"
      >
        Create <span class="font-medium">"{{ searchQuery.trim() }}"</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTagSystem } from '~/composables/useTagSystem'
import type { TagType } from '~/composables/idb'

interface TagItem {
  id: string
  name: string
  bookmarkCount?: number
  color?: string
  type?: TagType
}

const props = withDefaults(defineProps<{
  modelValue: string[]
  placeholder?: string
  excludeCurrentTags?: boolean
  tagType?: TagType
}>(), {
  placeholder: 'Add tag...',
  excludeCurrentTags: true,
  tagType: 'both',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
  (e: 'createTag', name: string): void
}>()

const { tags, getTagColor } = useTagSystem()

const rootRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const searchQuery = ref('')
const focused = ref(false)
const showDropdown = ref(false)
const highlightedIndex = ref(0)
const dropUp = ref(false)

const DROPDOWN_MAX_HEIGHT = 224 // matches Tailwind max-h-56

function updateDropDirection() {
  const root = rootRef.value
  if (!root) return
  const rect = root.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom
  const spaceAbove = rect.top
  // Flip up only when there isn't enough room below AND there's more room above.
  dropUp.value = spaceBelow < DROPDOWN_MAX_HEIGHT && spaceAbove > spaceBelow
}

const allTags = computed<TagItem[]>(() => {
  let result = tags.value
  if (props.tagType && props.tagType !== 'both') {
    result = result.filter(t => t.type === props.tagType || t.type === 'both')
  }
  return result.map(t => ({
    id: t.id,
    name: t.name,
    bookmarkCount: t.bookmarkCount,
    color: t.color || undefined,
    type: t.type,
  }))
})

const filteredTags = computed<TagItem[]>(() => {
  let list = allTags.value
  if (props.excludeCurrentTags) {
    list = list.filter(t => !props.modelValue.includes(t.name))
  }
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(t => t.name.toLowerCase().includes(q))
  }
  return list.slice(0, 10)
})

const canCreate = computed(() => {
  const q = searchQuery.value.trim()
  if (!q) return false
  if (props.modelValue.some(t => t.toLowerCase() === q.toLowerCase())) return false
  if (filteredTags.value.some(t => t.name.toLowerCase() === q.toLowerCase())) return false
  return true
})

const totalOptions = computed(() => filteredTags.value.length + (canCreate.value ? 1 : 0))

watch(searchQuery, () => {
  highlightedIndex.value = 0
})

watch(filteredTags, () => {
  if (highlightedIndex.value >= totalOptions.value) {
    highlightedIndex.value = Math.max(0, totalOptions.value - 1)
  }
})

function onContainerMousedown(e: MouseEvent) {
  // Don't steal focus when clicking inside the input itself or pill close buttons
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.closest('button')) return
  e.preventDefault()
  inputRef.value?.focus()
}

function onFocus() {
  focused.value = true
  showDropdown.value = true
  updateDropDirection()
}

watch([searchQuery, filteredTags, canCreate], () => {
  if (showDropdown.value) updateDropDirection()
})

function onBlur() {
  focused.value = false
  // Delay so dropdown click can register
  setTimeout(() => {
    showDropdown.value = false
  }, 150)
}

function closeDropdown() {
  showDropdown.value = false
  inputRef.value?.blur()
}

function navigateDown() {
  showDropdown.value = true
  if (totalOptions.value === 0) return
  highlightedIndex.value = (highlightedIndex.value + 1) % totalOptions.value
}

function navigateUp() {
  showDropdown.value = true
  if (totalOptions.value === 0) return
  highlightedIndex.value = (highlightedIndex.value - 1 + totalOptions.value) % totalOptions.value
}

function selectTag(tag: TagItem) {
  if (!props.modelValue.includes(tag.name)) {
    emit('update:modelValue', [...props.modelValue, tag.name])
  }
  searchQuery.value = ''
  highlightedIndex.value = 0
  inputRef.value?.focus()
}

function addTagByName(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return
  if (!props.modelValue.includes(trimmed)) {
    emit('update:modelValue', [...props.modelValue, trimmed])
  }
  searchQuery.value = ''
  highlightedIndex.value = 0
}

function createFromQuery() {
  const q = searchQuery.value.trim()
  if (!q) return
  emit('createTag', q)
  addTagByName(q)
  inputRef.value?.focus()
}

function selectHighlighted() {
  if (totalOptions.value === 0) {
    // Empty dropdown but query present? Treat as create.
    if (canCreate.value) createFromQuery()
    return
  }
  if (highlightedIndex.value < filteredTags.value.length) {
    const tag = filteredTags.value[highlightedIndex.value]
    if (tag) selectTag(tag)
  } else {
    createFromQuery()
  }
}

function onTab(e: KeyboardEvent) {
  // Tab accepts the highlighted suggestion (if any) without leaving the field
  if (showDropdown.value && totalOptions.value > 0) {
    e.preventDefault()
    selectHighlighted()
  }
}

function removeTag(tag: string) {
  emit('update:modelValue', props.modelValue.filter(t => t !== tag))
  inputRef.value?.focus()
}

function handleBackspace() {
  if (searchQuery.value === '' && props.modelValue.length > 0) {
    emit('update:modelValue', props.modelValue.slice(0, -1))
  }
}
</script>
