export default defineNuxtRouteMiddleware(async (to) => {
  const { isAuthenticated, init, isLoading } = useAuth()
  const publicRoutes = ['/login', '/signup', '/forgot-password', '/reset-password', '/docs']

  // On the server, validate the auth cookie and seed the shared auth state
  // BEFORE any other check so that:
  //   - public-route redirects (e.g. /login → /) see the right value, and
  //   - SSR renders the same authed/unauthed UI as the client first paint
  //     (avoiding hydration mismatches in the layout / OfflineIndicator).
  if (import.meta.server) {
    const event = useRequestEvent()
    if (event) {
      const { getCurrentUser } = await import('~/server/utils/auth')
      const serverUser = await getCurrentUser(event)
      if (serverUser) {
        // useState with the same key shares the ref with the composable.
        const userState = useState<typeof serverUser | null>('auth-user', () => null)
        userState.value = serverUser
        useState<boolean>('auth-loading', () => true).value = false
      }
    }
  }

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

  if (import.meta.server) {
    // If SSR didn't find a valid session, redirect to login.
    // (PWA offline requests carrying the service-worker header are allowed
    // through so the SW can serve the app shell.)
    if (!isAuthenticated.value) {
      const event = useRequestEvent()
      const swHeader = event?.node.req.headers['service-worker']
      if (!swHeader) {
        return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
      }
    }
  }

  // Client-side: Initialize auth state if not already done
  if (isLoading.value && isOnline) {
    await init()
  }

  // Offline mode: allow access to the app shell. Real auth is re-validated
  // by init()/fetchUser() once the client is back online.
  if (!isOnline) {
    return
  }

  // Check authentication for protected routes
  if (!isAuthenticated.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})
