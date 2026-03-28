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

// Register service worker
onMounted(async () => {
  console.log('[App] Initializing services...')
  
  // Register PWA service worker
  if (import.meta.client && 'serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      })
      console.log('[App] Service worker registered:', registration.scope)
      
      // Update immediately if there's a new version
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[App] New service worker available, refreshing...')
              // Optionally prompt user to refresh
            }
          })
        }
      })
    } catch (e) {
      console.error('[App] Service worker registration failed:', e)
    }
  }
  
  try {
    await initAuth()
    await initializeIdb()

    if (isAuthenticated.value) {
      console.log('[App] Triggering initial sync in background')
      triggerSync() // Don't await - let it run in background
    }
  } catch (e) {
    console.error('[App] Failed to initialize services:', e)
  }
})
</script>
