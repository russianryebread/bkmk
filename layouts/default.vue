<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Header -->
    <header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 shadow-sm">
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

          <!-- Desktop Navigation - Right aligned (simplified: just Bookmarks and Notes) -->
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
          </nav>

          <!-- Actions - Right aligned -->
          <div class="flex items-center space-x-3">
            <div class="relative md:block">
              <button @click="menuOpen = !menuOpen"
                class="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="pointer-events: none;">
                  <path v-if="!menuOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M4 6h16M4 12h16M4 18h16" />
                  <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <!-- Dropdown -->
              <div v-if="menuOpen"
                class="absolute right-0 mt-2 w-72 card p-4 shadow-lg border border-gray-200 dark:border-gray-700 z-30">
                <!-- User Info -->
                <NuxtLink to="/profile" @click="menuOpen = false"
                  class="block font-medium text-gray-900 dark:text-white hover:text-primary-600">
                  <div class="mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                    {{ user?.email }}
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Role: <span class="capitalize">{{ user?.role }}</span>
                    </p>
                  </div>
                </NuxtLink>

                <div class="-mx-3 mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                  <NuxtLink to="/bookmarks"
                    class="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    @click="menuOpen = false">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                    Bookmarks
                  </NuxtLink>

                  <NuxtLink to="/notes"
                    class="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    @click="menuOpen = false">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Notes
                  </NuxtLink>

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

                  <button @click="openGlobalSearch"
                    class="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Search
                  </button>

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
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
      <slot />
    </main>

    <!-- Mobile Bottom Toolbar (Bookmarks and Notes quick access) -->
    <div v-if="!isDetailPage"
      class="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-140">
      <div class="flex items-center justify-around py-2">
        <NuxtLink to="/bookmarks"
          class="flex flex-col items-center px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          <span class="text-xs mt-1">Bookmarks</span>
        </NuxtLink>
        <NuxtLink to="/notes"
          class="flex flex-col items-center px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span class="text-xs mt-1">Notes</span>
        </NuxtLink>
        <button @click="openGlobalSearch"
          class="flex flex-col items-center px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span class="text-xs mt-1">Search</span>
        </button>
      </div>
    </div>

    <!-- Global Search Modal -->
    <GlobalSearch ref="globalSearchRef" />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const globalSearchRef = ref<any>(null)

// Provide global search to child components
function openGlobalSearch() {
  globalSearchRef.value?.open()
}
provide('openGlobalSearch', openGlobalSearch)

const mobileMenuOpen = ref(false)
const menuOpen = ref(false)
const { isDark, toggle: toggleDarkMode } = useDarkMode()
const { user, isAdmin, logout } = useAuth()

// Reader settings with real-time reactivity
const { fontSize, fontFamily, setFontSize, setFontFamily } = useReaderSettings()

// Check if we're on a reader page
const isReaderPage = computed(() => route.path.includes('/bookmarks/') && route.params.id)
const isDetailPage = computed(() => route.path.includes('/bookmarks') || route.path.includes('/notes'))

// Handle logout
async function handleLogout() {
  menuOpen.value = false
  mobileMenuOpen.value = false
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
