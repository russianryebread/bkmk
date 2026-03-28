export default defineNuxtRouteMiddleware(async (to) => {
  const { isAuthenticated, init, isLoading, user } = useAuth()
  const publicRoutes = ['/login', '/signup', '/forgot-password', '/reset-password']

  // Allow public routes
  if (publicRoutes.includes(to.path)) {
    // If already authenticated, redirect to home
    if (isAuthenticated.value) {
      return navigateTo('/')
    }
    return
  }

  // Check if we're online
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
  
  // On server, we need to check auth from cookies directly
  if (import.meta.server) {
    // Check if this might be a PWA offline request
    // For PWA, the service worker handles routing before we get here
    
    const event = useRequestEvent()
    if (event) {
      const { getCurrentUser } = await import('~/server/utils/auth')
      const serverUser = await getCurrentUser(event)
      
      if (serverUser) {
        // Update the client state with server auth
        user.value = serverUser
        isLoading.value = false
        return
      }
    }
    
    // Not authenticated on server, redirect to login
    // BUT allow offline PWA requests through - service worker will handle them
    const header = event?.node.req.headers['service-worker']
    if (!header) {
      return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
    }
  }

  // Client-side: Initialize auth state if not already done
  if (isLoading.value && isOnline) {
    await init()
  }

  // Offline mode: Check if we have cached auth state
  if (!isOnline) {
    // For offline access, check localStorage for auth token
    if (import.meta.client) {
      const cachedToken = localStorage.getItem('auth_token')
      if (cachedToken) {
        // We have a cached session, allow access
        // The auth state will be re-validated when online
        return
      }
    }
    // No cached session and offline - show offline page or login
    // For PWA, we want to allow access to app shell
    return
  }

  // Check authentication for protected routes
  if (!isAuthenticated.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})
