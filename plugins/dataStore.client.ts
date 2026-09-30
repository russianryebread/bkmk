// plugins/dataStore.client.ts
// Initializes the data store on app startup (client-only)

export default defineNuxtPlugin(async () => {
  const dataStore = useDataStore()

  await dataStore.initialize()

  const { isAuthenticated } = useAuth()
  watch(isAuthenticated, (authenticated) => {
    if (authenticated) void dataStore.triggerSync()
  }, { immediate: true })

  console.log('[Plugin] DataStore initialized')

  return {
    provide: {
      dataStore,
    },
  }
})
