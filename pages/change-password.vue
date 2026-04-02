<template>
  <div>
    <div class="max-w-2xl mx-auto">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Change Password</h1>

      <div class="card p-6">
        <!-- Success Message -->
        <div v-if="success" class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
          <p class="text-sm text-green-600 dark:text-green-400">{{ success }}</p>
        </div>

        <!-- Error Message -->
        <div v-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-6">
          <!-- Current Password Field -->
          <div>
            <label for="currentPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Current Password
            </label>
            <input
              id="currentPassword"
              v-model="currentPassword"
              type="password"
              required
              autocomplete="current-password"
              class="input"
              placeholder="••••••••"
              :disabled="loading"
            />
          </div>

          <!-- New Password Field -->
          <div>
            <label for="newPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              New Password
            </label>
            <input
              id="newPassword"
              v-model="newPassword"
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

          <!-- Confirm New Password Field -->
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
            class="btn-primary"
          >
            <svg v-if="loading" class="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ loading ? 'Changing...' : 'Change Password' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
})

const router = useRouter()

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const error = ref('')
const success = ref('')
const loading = ref(false)

const passwordMismatch = computed(() => {
  return newPassword.value && confirmPassword.value && newPassword.value !== confirmPassword.value
})

async function handleSubmit() {
  if (passwordMismatch.value) return
  
  error.value = ''
  success.value = ''
  loading.value = true

  try {
    const result = await $fetch<{ message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: { 
        currentPassword: currentPassword.value,
        newPassword: newPassword.value
      }
    })
    
    success.value = result.message
    // Clear form on success
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (e: any) {
    error.value = e.data?.message || e.message || 'Failed to change password.'
  } finally {
    loading.value = false
  }
}
</script>
