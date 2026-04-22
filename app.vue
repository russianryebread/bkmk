<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <OfflineIndicator
    v-if="isAuthenticated"
    :is-online="isOnline"
    :sync-status="syncStatus"
    :pending-changes="pendingChangesCount"
    :last-sync-time="lastSyncTime"
    @retry="triggerSync"
  />
</template>

<script setup lang="ts">
const dataStore = useDataStore()
const { init: initAuth, isAuthenticated } = useAuth()

const { isOnline, syncStatus, lastSyncTime, pendingChangesCount, triggerSync } = storeToRefs(dataStore)

onMounted(async () => {
  console.log('[App] Initializing services...')
  
  try {
    await initAuth()

    if (isAuthenticated.value) {
      console.log('[App] DataStore will auto-sync on init')
    }
  } catch (e) {
    console.error('[App] Failed to initialize services:', e)
  }
})
</script>