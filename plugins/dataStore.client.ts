// plugins/dataStore.client.ts
// Initializes the data store on app startup (client-only)

export default defineNuxtPlugin(() => {
  const dataStore = useDataStore()

  const { isAuthenticated } = useAuth()
  onNuxtReady(async () => {
    try {
      await dataStore.initialize()
      watch(isAuthenticated, (authenticated) => {
        if (authenticated) void dataStore.triggerSync()
      }, { immediate: true })
    } catch (error) {
      console.error('[Plugin] Local storage initialization failed:', error)
    }
  })

  console.log('[Plugin] DataStore initialization scheduled')

  return {
    provide: {
      dataStore,
    },
  }
})
