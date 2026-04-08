<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Header -->
    <header
      class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-150 shadow-sm">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <!-- Logo -->
          <NuxtLink to="/" class="flex items-center space-x-2">
            <svg class="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <span class="text-xl font-bold text-gray-900 dark:text-white">bkmk</span>
          </NuxtLink>

          <!-- Desktop Navigation - Right aligned -->
          <nav class="hidden md:flex items-center space-x-1">
            <NuxtLink to="/bookmarks"
              class="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              active-class="bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300">
              Bookmarks
            </NuxtLink>
            <NuxtLink to="/notes"
              class="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              active-class="bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300">
              Notes
            </NuxtLink>
            <NuxtLink to="/secrets"
              class="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              active-class="bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300">
              Secrets
            </NuxtLink>
            <NuxtLink to="/tags"
              class="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              active-class="bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300">
              Tags
            </NuxtLink>
          </nav>

          <!-- Actions - Right aligned -->
          <div class="flex items-center space-x-3">
            <!-- Combined User/Settings Menu -->
            <div class="relative">
              <button @click="menuOpen = !menuOpen"
                class="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Menu">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>

              <!-- Combined Dropdown -->
              <div v-if="menuOpen"
                class="absolute right-0 mt-2 w-72 card p-4 shadow-lg border border-gray-200 dark:border-gray-700">
                <!-- User Info -->
                <div class="mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                  <p class="font-medium text-gray-900 dark:text-white">{{ user?.email }}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Role: <span class="capitalize">{{ user?.role }}</span>
                  </p>
                </div>

                <!-- Settings Section -->
                <div class="mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Settings</p>

                  <!-- Dark Mode Toggle -->
                  <div class="flex items-center justify-between mb-3">
                    <span class="text-sm text-gray-700 dark:text-gray-300">Dark Mode</span>
                    <button @click="toggleDarkMode"
                      class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                      :class="isDark ? 'bg-primary-600' : 'bg-gray-300'">
                      <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                        :class="isDark ? 'translate-x-6' : 'translate-x-1'" />
                    </button>
                  </div>

                  <!-- Reader Settings (only show on reader pages) -->
                  <div v-if="isReaderPage">
                    <p class="text-xs text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Reader</p>

                    <!-- Font Size -->
                    <div class="mb-3">
                      <label class="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                        Font: {{ fontSize }}px
                      </label>
                      <input :value="fontSize" @input="setFontSize(Number(($event.target as HTMLInputElement).value))"
                        type="range" min="12" max="24" step="1"
                        class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                    </div>

                    <!-- Font Family -->
                    <div class="flex gap-2">
                      <button @click="setFontFamily('sans-serif')" :class="[
                        'flex-1 py-1.5 text-xs rounded border transition-colors',
                        fontFamily === 'sans-serif'
                          ? 'bg-primary-100 border-primary-600 text-primary-700 dark:bg-primary-900 dark:border-primary-500 dark:text-primary-300'
                          : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                      ]">
                        Sans
                      </button>
                      <button @click="setFontFamily('serif')" :class="[
                        'flex-1 py-1.5 text-xs rounded border transition-colors font-serif',
                        fontFamily === 'serif'
                          ? 'bg-primary-100 border-primary-600 text-primary-700 dark:bg-primary-900 dark:border-primary-500 dark:text-primary-300'
                          : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                      ]">
                        Serif
                      </button>
                    </div>
                  </div>
                </div>

                  <!-- User Actions -->
                <div class="space-y-1 -mx-3">
                  <!-- API Tokens -->
                  <NuxtLink to="/tokens"
                    class="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    @click="menuOpen = false">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    API Tokens
                  </NuxtLink>

                  <!-- Only show change password for users with password (not OAuth-only) -->
                  <NuxtLink v-if="hasPassword" to="/change-password"
                    class="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    @click="menuOpen = false">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Change Password
                  </NuxtLink>

                  <NuxtLink v-if="isAdmin" to="/admin/users"
                    class="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    @click="menuOpen = false">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    Manage Users
                  </NuxtLink>

                  <NuxtLink to="/docs"
                    class="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    @click="menuOpen = false">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z" />
                    </svg>
                    API Docs
                  </NuxtLink>

                  <button @click="handleLogout"
                    class="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign out
                  </button>
                </div>
              </div>
            </div>

            <!-- Mobile menu button -->
            <button @click="mobileMenuOpen = !mobileMenuOpen"
              class="md:hidden p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path v-if="!mobileMenuOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4 6h16M4 12h16M4 18h16" />
                <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Mobile Navigation -->
      <div v-if="mobileMenuOpen" class="md:hidden border-t border-gray-200 dark:border-gray-700">
        <div class="px-4 py-3 space-y-2">
          <NuxtLink to="/bookmarks"
            class="block px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            @click="mobileMenuOpen = false">
            Bookmarks
          </NuxtLink>
          <NuxtLink to="/notes"
            class="block px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            @click="mobileMenuOpen = false">
            Notes
          </NuxtLink>
          <NuxtLink to="/secrets"
            class="block px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            @click="mobileMenuOpen = false">
            Secrets
          </NuxtLink>
          <NuxtLink to="/tags"
            class="block px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            @click="mobileMenuOpen = false">
            Tags
          </NuxtLink>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
      <slot />
    </main>

    <!-- Global Search Modal -->
    <GlobalSearch ref="globalSearchRef" />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const globalSearchRef = ref<any>(null)

// Provide global search to child components
provide('openGlobalSearch', () => {
  globalSearchRef.value?.open()
})
const mobileMenuOpen = ref(false)
const menuOpen = ref(false)
const { isDark, toggle: toggleDarkMode } = useDarkMode()
const { user, isAdmin, hasPassword, logout } = useAuth()

// Reader settings with real-time reactivity
const { fontSize, fontFamily, lineHeight, setFontSize, setFontFamily, setLineHeight } = useReaderSettings()

// Check if we're on a reader page
const isReaderPage = computed(() => {
  return route.path.includes('/bookmarks/') && route.params.id
})

// Handle logout
async function handleLogout() {
  menuOpen.value = false
  await logout()
}

// Close dropdown when clicking outside
onMounted(() => {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (!target.closest('.relative')) {
      menuOpen.value = false
    }
  })
})
</script>