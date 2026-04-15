<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="translate-y-full opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-full opacity-0"
  >
    <div
      v-if="showIndicator"
      :class="[
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full shadow-lg',
        statusClasses
      ]"
    >
      <!-- Status Icon -->
      <component :is="statusIcon" class="w-4 h-4" />
      
      <!-- Status Text -->
      <span class="text-sm font-medium">{{ statusText }}</span>
      
      <!-- Sync Indicator -->
      <span v-if="syncStatus === 'syncing'" class="ml-1">
        <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </span>
      
      <!-- Pending Changes Badge -->
      <span
        v-if="pendingChanges > 0 && !isOnline"
        class="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-white/20 whitespace-nowrap"
      >
        {{ pendingChanges }} pending
      </span>
      
      <!-- Retry Button -->
      <button
        v-if="!isOnline && pendingChanges > 0"
        @click="retrySync"
        class="ml-2 p-1 rounded-full hover:bg-white/20 transition-colors"
        title="Retry sync"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { SyncStatus } from '~/composables/useSync'

interface Props {
  isOnline?: boolean
  syncStatus?: SyncStatus
  pendingChanges?: number
  lastSyncTime?: Date | null
}

const props = withDefaults(defineProps<Props>(), {
  isOnline: true,
  syncStatus: 'idle',
  pendingChanges: 0,
  lastSyncTime: null,
})

const emit = defineEmits<{
  retry: []
}>()

// Only show indicator when offline or syncing
const showIndicator = computed(() => {
  return !props.isOnline || props.syncStatus === 'syncing' || props.syncStatus === 'error'
})

const statusClasses = computed(() => {
  if (!props.isOnline) {
    return 'bg-amber-500 text-white'
  }
  if (props.syncStatus === 'syncing') {
    return 'bg-blue-500 text-white'
  }
  if (props.syncStatus === 'error') {
    return 'bg-red-500 text-white'
  }
  return 'bg-gray-500 text-white'
})

const statusText = computed(() => {
  if (!props.isOnline) {
    return 'You are offline'
  }
  if (props.syncStatus === 'syncing') {
    return 'Syncing...'
  }
  if (props.syncStatus === 'error') {
    return 'Sync failed'
  }
  if (props.syncStatus === 'success' && props.lastSyncTime) {
    const diff = Date.now() - props.lastSyncTime.getTime()
    if (diff < 60000) return 'Synced'
    return `Synced ${formatTimeDiff(diff)} ago`
  }
  return 'Online'
})

const statusIcon = computed(() => {
  if (!props.isOnline) {
    return {
      template: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
      </svg>`
    }
  }
  if (props.syncStatus === 'syncing') {
    return {
      template: `<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
      </svg>`
    }
  }
  return {
    template: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
    </svg>`
  }
})

function formatTimeDiff(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function retrySync() {
  emit('retry')
}
</script>
