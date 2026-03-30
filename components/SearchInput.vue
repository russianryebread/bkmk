<template>
  <div class="relative">
    <input
      ref="searchInputRef"
      v-model="localQuery"
      type="text"
      :placeholder="placeholder"
      class="input pl-10 pr-24"
      @input="handleInput"
      @keydown.enter="handleEnter"
    />
    <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
    <button v-if="showActionButton && isUrl(localQuery)" @click="handleAction" class="absolute right-2 top-1/2 -translate-y-1/2 btn-primary text-sm py-1">
      {{ actionButtonText }}
    </button>
  </div>
</template>

<script setup lang="ts">
interface Props {
  modelValue?: string
  placeholder?: string
  showActionButton?: boolean
  actionButtonText?: string
  autoFocus?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: 'Search...',
  showActionButton: true,
  actionButtonText: 'bkmk it!',
  autoFocus: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'search', value: string): void
  (e: 'enter'): void
  (e: 'action', value: string): void
}>()

const searchInputRef = ref<HTMLInputElement | null>(null)
const localQuery = ref(props.modelValue)

watch(() => props.modelValue, (newVal) => {
  localQuery.value = newVal
})

function isUrl(query: string): boolean {
  try {
    const url = new URL(query)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function handleInput() {
  emit('update:modelValue', localQuery.value)
  emit('search', localQuery.value)
}

function handleEnter() {
  emit('enter')
}

function handleAction() {
  emit('action', localQuery.value)
}

// Expose focus method
function focus() {
  searchInputRef.value?.focus()
}

defineExpose({ focus, searchInputRef })

onMounted(() => {
  if (props.autoFocus) {
    nextTick(() => {
      searchInputRef.value?.focus()
    })
  }
})
</script>
