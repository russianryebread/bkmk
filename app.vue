<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <OfflineIndicator
    v-if="isAuthenticated"
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
const { init: initAuth, isAuthenticated, isLoading: authLoading } = useAuth()

// Initialize auth state
onMounted(async () => {
  console.log('[App] Initializing services...')
  
  try {
    // Initialize auth first
    await initAuth()
    console.log('[App] Auth initialized')
    
    // Then initialize IndexedDB
    await initializeIdb()
    console.log('[App] IndexedDB initialized')
  } catch (e) {
    console.error('[App] Failed to initialize services:', e)
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
