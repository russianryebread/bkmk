export default defineNuxtRouteMiddleware(async (to) => {
  const { isAuthenticated, init, isLoading } = useAuth()
  const publicRoutes = ['/login', '/signup']

  // Initialize auth state if not already done
  if (import.meta.client && isLoading.value) {
    await init()
  }

  // Allow public routes
  if (publicRoutes.includes(to.path)) {
    // If already authenticated, redirect to home
    if (isAuthenticated.value) {
      return navigateTo('/')
    }
    return
  }

  // Check authentication for protected routes
  if (!isAuthenticated.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})
