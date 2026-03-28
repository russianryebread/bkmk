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
