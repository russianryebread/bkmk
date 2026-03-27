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
        <p class="text-gray-600 dark:text-gray-400 mt-2">Reset your password</p>
      </div>

      <!-- Reset Request Form -->
      <div class="card p-8">
        <!-- Success Message -->
        <div v-if="success" class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p class="text-sm text-green-600 dark:text-green-400">{{ success }}</p>
        </div>

        <!-- Error Message -->
        <div v-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
        </div>

        <form v-if="!success" @submit.prevent="handleSubmit" class="space-y-6">
          <!-- Email Field -->
          <div>
            <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email address
            </label>
            <input
              id="email"
              v-model="email"
              type="email"
              required
              autocomplete="email"
              class="input"
              placeholder="you@example.com"
              :disabled="loading"
            />
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="loading"
            class="w-full btn-primary py-3 flex items-center justify-center"
          >
            <svg v-if="loading" class="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ loading ? 'Sending...' : 'Send Reset Link' }}
          </button>
        </form>

        <!-- Back to login link -->
        <div class="mt-6 text-center">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Remember your password?
            <NuxtLink to="/login" class="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400">
              Sign in
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

const router = useRouter()

const email = ref('')
const error = ref('')
const success = ref('')
const loading = ref(false)

async function handleSubmit() {
  error.value = ''
  success.value = ''
  loading.value = true

  try {
    const result = await $fetch('/api/auth/reset-request', {
      method: 'POST',
      body: { email: email.value }
    })
    
    success.value = result.message
  } catch (e: any) {
    error.value = e.data?.message || e.message || 'Failed to send reset email.'
  } finally {
    loading.value = false
  }
}
</script>
