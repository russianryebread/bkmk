import { useIdb, type Secret } from './idb'

export function useOfflineSecrets() {
  const { saveSecret, saveSecrets, getSecret, getAllSecrets, deleteSecret: idbDeleteSecret, addToSyncQueue } = useIdb()
  
  const isOnline = ref(true)
  const offlineError = ref<string | null>(null)

  // Initialize online status
  onMounted(() => {
    isOnline.value = navigator.onLine
    
    window.addEventListener('online', () => {
      console.log('[OfflineSecrets] Back online')
      isOnline.value = true
      offlineError.value = null
    })
    
    window.addEventListener('offline', () => {
      console.log('[OfflineSecrets] Gone offline')
      isOnline.value = false
    })
  })

  // Get secrets - try online first, fallback to IndexedDB
  async function getSecrets(): Promise<Secret[]> {
    offlineError.value = null

    // Try online fetch first
    if (isOnline.value) {
      try {
        console.log('[OfflineSecrets] Fetching secrets from server')
        const response = await $fetch<{ notes: any[] }>('/api/notes/secret')
        
        if (response.notes && response.notes.length > 0) {
          const secrets: Secret[] = response.notes.map(s => ({
            id: s.id,
            title: s.title,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
            lastAccessedAt: s.lastAccessedAt,
          }))
          
          // Cache in IndexedDB
          await saveSecrets(secrets)
          console.log('[OfflineSecrets] Cached', secrets.length, 'secrets')
          return secrets
        }
        
        return []
      } catch (e: any) {
        console.warn('[OfflineSecrets] Server fetch failed, falling back to IndexedDB:', e.message)
        offlineError.value = 'Using cached data (server unavailable)'
      }
    }

    // Fallback to IndexedDB
    console.log('[OfflineSecrets] Fetching secrets from IndexedDB')
    try {
      const secrets = await getAllSecrets()
      console.log('[OfflineSecrets] Returning', secrets.length, 'secrets from IndexedDB')
      return secrets
    } catch (e: any) {
      console.error('[OfflineSecrets] IndexedDB fetch failed:', e)
      offlineError.value = 'Failed to load secrets'
      return []
    }
  }

  // Get single secret metadata
  async function getSecretById(id: string): Promise<Secret | null> {
    offlineError.value = null
    
    // Try online first
    if (isOnline.value) {
      try {
        const response = await $fetch<any>(`/api/notes/secret/${id}`)
        const secret: Secret = {
          id: response.id,
          title: response.title,
          createdAt: response.createdAt,
          updatedAt: response.updatedAt,
          lastAccessedAt: response.lastAccessedAt,
        }
        // Cache in IndexedDB
        await saveSecret(secret)
        return secret
      } catch (e: any) {
        console.warn('[OfflineSecrets] Server fetch failed, falling back to IndexedDB:', e.message)
      }
    }

    // Fallback to IndexedDB
    try {
      return await getSecret(id)
    } catch (e: any) {
      console.error('[OfflineSecrets] IndexedDB fetch failed:', e)
      return null
    }
  }

  // Unlock secret and get content
  async function unlockSecret(id: string, password: string): Promise<{ content: string } | null> {
    try {
      const response = await $fetch<{ content: string }>(`/api/notes/secret/${id}?password=${encodeURIComponent(password)}`)
      return { content: response.content }
    } catch (e: any) {
      throw new Error(e.data?.message || 'Invalid password')
    }
  }

  // Create secret - save locally and queue sync
  async function createSecret(data: { title: string; content?: string; password: string }): Promise<Secret | null> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    
    const secret: Secret = {
      id,
      title: data.title,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: null,
      passwordHash: data.password, // Store hash locally for offline verification
    }

    try {
      // Save to IndexedDB immediately
      await saveSecret(secret)
      console.log('[OfflineSecrets] Created secret locally:', id)
      
      // Queue for sync if online
      if (isOnline.value) {
        try {
          const response = await $fetch<any>('/api/notes/secret', {
            method: 'POST',
            body: { title: secret.title, content: data.content || '', password: data.password }
          })
          
          // Update with server ID if different
          if (response.note && response.note.id !== id) {
            // Delete local with temp ID and save with server ID
            await idbDeleteSecret(id)
            secret.id = response.note.id
            delete secret.passwordHash // Don't cache password hash
            await saveSecret(secret)
          }
          console.log('[OfflineSecrets] Synced secret to server')
        } catch (e) {
          console.warn('[OfflineSecrets] Failed to sync secret, queuing for later:', e)
          await addToSyncQueue({
            id,
            action: 'create',
            entity: 'secret',
            data: { title: secret.title, content: data.content || '', password: data.password },
            timestamp: Date.now(),
          })
        }
      } else {
        // Queue for sync when back online
        await addToSyncQueue({
          id,
          action: 'create',
          entity: 'secret',
          data: { title: secret.title, content: data.content || '', password: data.password },
          timestamp: Date.now(),
        })
      }
      
      return secret
    } catch (e: any) {
      console.error('[OfflineSecrets] Failed to create secret:', e)
      return null
    }
  }

  // Delete secret - save locally and queue sync
  async function deleteSecret(id: string, password: string): Promise<boolean> {
    try {
      // Remove from IndexedDB
      await idbDeleteSecret(id)
      console.log('[OfflineSecrets] Deleted secret from IndexedDB:', id)

      // Queue for sync if online
      if (isOnline.value) {
        try {
          await $fetch(`/api/notes/secret/${id}`, { 
            method: 'DELETE',
            body: { password }
          })
          console.log('[OfflineSecrets] Synced secret deletion to server')
        } catch (e) {
          console.warn('[OfflineSecrets] Failed to sync secret deletion, queuing for later:', e)
          await addToSyncQueue({
            id,
            action: 'delete',
            entity: 'secret',
            data: { password },
            timestamp: Date.now(),
          })
        }
      } else {
        // Queue for sync when back online
        await addToSyncQueue({
          id,
          action: 'delete',
          entity: 'secret',
          data: { password },
          timestamp: Date.now(),
        })
      }
      
      return true
    } catch (e: any) {
      console.error('[OfflineSecrets] Failed to delete secret:', e)
      return false
    }
  }

  return {
    isOnline,
    offlineError,
    getSecrets,
    getSecretById,
    unlockSecret,
    createSecret,
    deleteSecret,
  }
}
