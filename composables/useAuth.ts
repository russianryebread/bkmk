interface AuthUser {
  id: string
  email: string
  role: 'user' | 'admin'
}

interface LoginCredentials {
  email: string
  password: string
}

interface SignupCredentials {
  email: string
  password: string
}

export const useAuth = () => {
  const user = useState<AuthUser | null>('auth-user', () => null)
  const isAuthenticated = computed(() => user.value !== null)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const isLoading = useState<boolean>('auth-loading', () => true)

  const fetchUser = async (): Promise<AuthUser | null> => {
    try {
      const response = await $fetch<{ user: AuthUser }>('/api/auth/me')
      user.value = response.user
      return response.user
    } catch {
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
      await navigateTo('/login')
    } finally {
      isLoading.value = false
    }
  }

  // Initialize auth state on client
  const init = async (): Promise<void> => {
    if (import.meta.client) {
      isLoading.value = true
      await fetchUser()
      isLoading.value = false
    }
  }

  return {
    user: readonly(user),
    isAuthenticated,
    isAdmin,
    isLoading: readonly(isLoading),
    fetchUser,
    login,
    signup,
    logout,
    init
  }
}
