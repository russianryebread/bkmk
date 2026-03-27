<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <OfflineIndicator
    :is-online="isOnline"
    :sync-status="syncStatus"
    :pending-changes="pendingChanges"
    :last-sync-time="lastSyncTime"
    @retry="triggerSync"
  />
</template>

<script setup lang="ts">
const { initialize: initializeIdb } = useIdb()
const { isOnline, syncStatus, pendingChanges, lastSyncTime, triggerSync } = useSync()

// Initialize services on app mount
onMounted(async () => {
  console.log('[App] Initializing offline services...')
  
  try {
    // Initialize IndexedDB first
    await initializeIdb()
    console.log('[App] IndexedDB initialized')
  } catch (e) {
    console.error('[App] Failed to initialize IndexedDB:', e)
  }
})

// Handle PWA installation
const { $pwaInfo } = useNuxtApp()

// Register service worker updates
if (import.meta.client && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    console.log('[App] Service worker registration available')
  })
}
</script>
