// plugins/dataStore.client.ts
// Initializes the data store on app startup (client-only)

export default defineNuxtPlugin(async () => {
  const dataStore = useDataStore()

  await dataStore.initialize()

  console.log('[Plugin] DataStore initialized')

  return {
    provide: {
      dataStore,
    },
  }
})