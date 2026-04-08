<template>
  <div class="max-w-2xl mx-auto">
    <!-- Profile Header -->
    <div class="card p-6 mb-6">
      <div class="flex items-center gap-4">
        <div class="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
          <span class="text-2xl font-bold text-primary-600 dark:text-primary-400">
            {{ userInitials }}
          </span>
        </div>
        <div>
          <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ user?.email }}</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400 capitalize">Role: {{ user?.role }}</p>
        </div>
      </div>
    </div>

    <!-- Settings Sections -->
    <div class="space-y-6">
      <!-- Manage Tags -->
      <div class="card p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <svg class="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <div>
              <h2 class="font-medium text-gray-900 dark:text-white">Manage Tags</h2>
              <p class="text-sm text-gray-500 dark:text-gray-400">Create and organize your tags</p>
            </div>
          </div>
          <NuxtLink to="/tags" class="btn-secondary">
            Manage
          </NuxtLink>
        </div>
      </div>

      <!-- API Tokens -->
      <div class="card p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <svg class="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <div>
              <h2 class="font-medium text-gray-900 dark:text-white">API Tokens</h2>
              <p class="text-sm text-gray-500 dark:text-gray-400">Manage tokens for external integrations</p>
            </div>
          </div>
          <NuxtLink to="/tokens" class="btn-secondary">
            Manage
          </NuxtLink>
        </div>
      </div>

      <!-- Change Password -->
      <div v-if="hasPassword" class="card p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <svg class="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h2 class="font-medium text-gray-900 dark:text-white">Change Password</h2>
              <p class="text-sm text-gray-500 dark:text-gray-400">Update your account password</p>
            </div>
          </div>
          <NuxtLink to="/change-password" class="btn-secondary">
            Change
          </NuxtLink>
        </div>
      </div>

      <!-- Admin Section -->
      <div v-if="isAdmin" class="card p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <svg class="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <h2 class="font-medium text-gray-900 dark:text-white">Manage Users</h2>
              <p class="text-sm text-gray-500 dark:text-gray-400">Admin controls for user management</p>
            </div>
          </div>
          <NuxtLink to="/admin/users" class="btn-secondary">
            Manage
          </NuxtLink>
        </div>
      </div>

      <!-- API Docs -->
      <div class="card p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <svg class="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z" />
              </svg>
            </div>
            <div>
              <h2 class="font-medium text-gray-900 dark:text-white">API Documentation</h2>
              <p class="text-sm text-gray-500 dark:text-gray-400">View API reference and examples</p>
            </div>
          </div>
          <NuxtLink to="/docs" class="btn-secondary">
            Open Docs
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Sign Out -->
    <div class="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
      <button @click="handleLogout" class="w-full btn-primary text-red-600 bg-transparent hover:bg-red-100 dark:bg-red-900 dark:text-red-400 dark:hover:bg-red-800">
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        Sign Out
      </button>
    </div>

    <!-- Version Footer -->
    <div class="mt-8 text-center">
      <p class="text-xs text-gray-400 dark:text-gray-500">
        {{ version }} - <a href="https://hoshor.me" target="_blank" class="text-primary-600 dark:text-primary-400 hover:underline">Built in Colorado 🏔️</a>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
})

const { user, isAdmin, hasPassword, logout } = useAuth()
const version = ref('unknown')

// Get user initials from email
const userInitials = computed(() => {
  if (!user.value?.email) return '?'
  const email = user.value.email
  const namePart = email.split('@')[0]
  return namePart.slice(0, 2).toUpperCase()
})

// Fetch version
async function fetchVersion() {
  try {
    const response = await $fetch<{ version: string }>('/api/version')
    version.value = response.version
  } catch {
    version.value = 'unknown'
  }
}

// Handle logout
async function handleLogout() {
  await logout()
}

onMounted(() => {
  fetchVersion()
})
</script>
