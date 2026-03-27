<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
    <div class="max-w-md w-full">
      <!-- Logo/Header -->
      <div class="text-center mb-8">
        <div class="flex justify-center mb-4">
          <svg class="w-16 h-16 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">bkmk</h1>
        <p class="text-gray-600 dark:text-gray-400 mt-2">Create a new password</p>
      </div>

      <!-- Reset Password Form -->
      <div class="card p-8">
        <!-- Success Message -->
        <div v-if="success" class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
          <p class="text-sm text-green-600 dark:text-green-400">{{ success }}</p>
          <NuxtLink to="/login" class="mt-4 inline-block text-primary-600 hover:text-primary-500 font-medium">
            Sign in with new password →
          </NuxtLink>
        </div>

        <!-- Error Message -->
        <div v-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
        </div>

        <form v-if="!success" @submit.prevent="handleSubmit" class="space-y-6">
          <!-- New Password Field -->
          <div>
            <label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              New Password
            </label>
            <input
              id="password"
              v-model="password"
              type="password"
              required
              autocomplete="new-password"
              class="input"
              placeholder="••••••••"
              :disabled="loading"
              minlength="8"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Must be at least 8 characters</p>
          </div>

          <!-- Confirm Password Field -->
          <div>
            <label for="confirmPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              v-model="confirmPassword"
              type="password"
              required
              autocomplete="new-password"
              class="input"
              placeholder="••••••••"
              :disabled="loading"
              minlength="8"
            />
          </div>

          <!-- Password mismatch error -->
          <div v-if="passwordMismatch" class="text-sm text-red-600 dark:text-red-400">
            Passwords do not match
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="loading || passwordMismatch"
            class="w-full btn-primary py-3 flex items-center justify-center"
          >
            <svg v-if="loading" class="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ loading ? 'Resetting...' : 'Reset Password' }}
          </button>
        </form>

        <!-- Back to login link -->
        <div class="mt-6 text-center">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Need a new reset link?
            <NuxtLink to="/forgot-password" class="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400">
              Request another
            </NuxtLink>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: false
})

const route = useRoute()
const router = useRouter()

const token = route.query.token as string
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const success = ref('')
const loading = ref(false)

const passwordMismatch = computed(() => {
  return password.value && confirmPassword.value && password.value !== confirmPassword.value
})

// Redirect if no token - only run on client to avoid SSR issues
if (import.meta.client && !token) {
  router.push('/forgot-password')
}

async function handleSubmit() {
  if (passwordMismatch.value) return
  
  error.value = ''
  success.value = ''
  loading.value = true

  try {
    const result = await $fetch('/api/auth/reset-password', {
      method: 'POST',
      body: { 
        token: token,
        password: password.value
      }
    })
    
    success.value = result.message
  } catch (e: any) {
    error.value = e.data?.message || e.message || 'Failed to reset password.'
  } finally {
    loading.value = false
  }
}
</script>
