// Type definitions for our auth user
export interface AuthUser {
  id: string
  email: string
  role: 'user' | 'admin'
  avatarUrl?: string | null
  hasPassword: boolean  // true if user has set a password (not OAuth-only)
}

interface LoginCredentials {
  email: string
  password: string
}

interface SignupCredentials {
  email: string
  password: string
}

// Storage key for offline auth
const AUTH_STORAGE_KEY = 'bkmk_auth'

export const useAuth = () => {
  // Try to restore user from localStorage on client
  const getStoredAuth = (): AuthUser | null => {
    if (import.meta.client) {
      try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY)
        if (stored) {
          return JSON.parse(stored)
        }
      } catch (e) {
        console.warn('[Auth] Failed to parse stored auth:', e)
      }
    }
    return null
  }

  // Initialize from stored auth if available
  const storedUser = import.meta.client ? getStoredAuth() : null
  const user = useState<AuthUser | null>('auth-user', () => storedUser)
  const isAuthenticated = computed(() => user.value !== null)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const hasPassword = computed(() => user.value?.hasPassword ?? false)
  const isLoading = useState<boolean>('auth-loading', () => true)

  // Save user to localStorage for offline access
  const saveToStorage = (authUser: AuthUser | null) => {
    if (import.meta.client) {
      if (authUser) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser))
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY)
      }
    }
  }

  const fetchUser = async (): Promise<AuthUser | null> => {
    try {
      const response = await $fetch<{ user: AuthUser }>('/api/auth/me')
      user.value = response.user
      saveToStorage(response.user)
      return response.user
    } catch {
      // Check if we have cached user for offline
      const cached = getStoredAuth()
      if (cached) {
        user.value = cached
        return cached
      }
      user.value = null
      return null
    }
  }

  const login = async (credentials: LoginCredentials): Promise<AuthUser> => {
    isLoading.value = true
    try {
      const response = await $fetch<{ user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: credentials
      })
      user.value = response.user
      saveToStorage(response.user)
      return response.user
    } finally {
      isLoading.value = false
    }
  }

  const signup = async (credentials: SignupCredentials): Promise<AuthUser> => {
    isLoading.value = true
    try {
      const response = await $fetch<{ user: AuthUser }>('/api/auth/signup', {
        method: 'POST',
        body: credentials
      })
      user.value = response.user
      saveToStorage(response.user)
      return response.user
    } finally {
      isLoading.value = false
    }
  }

  const logout = async (): Promise<void> => {
    isLoading.value = true
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
      user.value = null
      saveToStorage(null)
      await navigateTo('/login')
    } finally {
      isLoading.value = false
    }
  }

  // Initialize auth state on client - try to use cached auth first for offline
  const init = async (): Promise<void> => {
    if (import.meta.client) {
      isLoading.value = true
      
      // First check for cached user (instant, works offline)
      const cached = getStoredAuth()
      if (cached) {
        user.value = cached
        isLoading.value = false
        
        // Then try to validate with server in background
        try {
          await fetchUser()
        } catch {
          // Keep using cached user if server fails (offline)
        }
        return
      }
      
      // No cached user, need to fetch from server
      await fetchUser()
      isLoading.value = false
    }
  }

  // For OAuth login - redirect to generic OAuth endpoint
  const signInWithOAuth = (provider: 'google' | 'github') => {
    // Redirect to OAuth endpoint (uses generic handler)
    window.location.href = `/api/auth/${provider}`
  }

  return {
    user: readonly(user),
    isAuthenticated,
    isAdmin,
    hasPassword,
    isLoading: readonly(isLoading),
    fetchUser,
    login,
    signup,
    logout,
    init,
    signInWithOAuth
  }
}