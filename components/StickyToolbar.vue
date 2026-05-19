<template>
  <div class="sticky top-2 mb-4" :class="[isScrolled ? 'z-50' : '']">
    <!-- Glass effect toolbar -->
    <div
      class="flex items-center justify-between gap-2 py-2 mx-auto transition-all duration-200"
      :class="[
        isScrolled ? 'bg-white dark:bg-gray-800 rounded-xl' : '',
      ]"
    >
      <!-- Left slot (usually back button) + optional title -->
      <div v-if="$slots.left || showBack || title" class="flex items-center gap-2 min-w-0 flex-1">
        <slot name="left">
          <button
            v-if="showBack"
            @click="handleBack"
            class="flex-shrink-0 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95 transition-all"
            :title="backLabel"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </slot>
        <h1 v-if="title" class="font-bold text-gray-900 dark:text-white truncate">
          {{ title }}
        </h1>
      </div>

      <!-- Center buttons -->
      <div class="flex items-center gap-1 flex-shrink-0">
        <slot>
          <ActionButton
            v-for="(action, index) in actions"
            :key="index"
            v-bind="action"
            @click="action.handler?.()"
          />
        </slot>
      </div>

      <!-- Right slot -->
      <div v-if="$slots.right" class="flex-shrink-0">
        <slot name="right" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Action } from '~/utils/types'

const props = withDefaults(defineProps<{
  showBack?: boolean
  backLabel?: string
  backTo?: string
  title?: string
  actions?: Action[]
  compact?: boolean
}>(), {
  showBack: false,
  backLabel: 'Go back',
  backTo: undefined,
  title: undefined,
  actions: () => [],
  compact: false,
})

const emit = defineEmits<{
  back: []
}>()

const router = useRouter()
const isScrolled = ref(false)

function handleBack() {
  if (props.backTo) {
    router.push(props.backTo)
  } else {
    emit('back')
  }
}

onMounted(() => {
  const handleScroll = () => {
    isScrolled.value = window.scrollY > 50
  }
  window.addEventListener('scroll', handleScroll, { passive: true })

  onUnmounted(() => {
    window.removeEventListener('scroll', handleScroll)
  })
})
</script>
