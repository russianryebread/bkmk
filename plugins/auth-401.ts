export default defineNuxtPlugin((nuxtApp) => {
  // Handle 401 errors globally - redirect to login
  if (import.meta.client) {
    // Override fetch to catch 401
    const originalFetch = window.fetch
    
    window.fetch = async (...args) => {
      const response = await originalFetch(...args)
      
      // Check for 401 Unauthorized
      if (response.status === 401) {
        console.warn('[Auth] Received 401, clearing session...')
        localStorage.removeItem('bkmk_auth')
        
        // Only redirect if not already on login page
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login'
        }
      }
      
      return response
    }
  }
})