<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Header -->
    <header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <!-- Logo -->
          <NuxtLink to="/" class="flex items-center space-x-2">
            <svg class="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <span class="text-xl font-bold text-gray-900 dark:text-white">bkmk</span>
          </NuxtLink>

          <!-- Desktop Navigation - Right aligned -->
          <nav class="hidden md:flex items-center space-x-1">
            <NuxtLink to="/"
              class="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              active-class="bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300">
              Home
            </NuxtLink>
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
            <!-- User Menu -->
            <div class="relative">
              <button 
                @click="userMenuOpen = !userMenuOpen"
                class="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="User menu"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span class="hidden md:inline">{{ user?.email }}</span>
              </button>
              
              <!-- User Dropdown -->
              <div v-if="userMenuOpen" class="absolute right-0 mt-2 w-56 card p-4 shadow-lg border border-gray-200 dark:border-gray-700">
                <div class="mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                  <p class="font-medium text-gray-900 dark:text-white">{{ user?.email }}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Role: <span class="capitalize">{{ user?.role }}</span>
                  </p>
                </div>
                
                <div class="space-y-1">
                  <NuxtLink 
                    v-if="isAdmin"
                    to="/admin/users"
                    class="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    @click="userMenuOpen = false"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    Manage Users
                  </NuxtLink>
                  
                  <button 
                    @click="handleLogout"
                    class="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign out
                  </button>
                </div>
              </div>
            </div>

            <!-- Settings Dropdown (Gear icon) -->
            <div class="relative">
              <button 
                @click="settingsOpen = !settingsOpen"
                class="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Settings"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              
              <!-- Dropdown Panel -->
              <div v-if="settingsOpen" class="absolute right-0 mt-2 w-72 card p-4 shadow-lg border border-gray-200 dark:border-gray-700">
                <h3 class="font-semibold text-gray-900 dark:text-white mb-3">Settings</h3>
                
                <!-- Dark Mode Toggle -->
                <div class="flex items-center justify-between mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
                  <span class="text-sm text-gray-700 dark:text-gray-300">Dark Mode</span>
                  <button 
                    @click="toggleDarkMode"
                    class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                    :class="isDark ? 'bg-primary-600' : 'bg-gray-300'"
                  >
                    <span 
                      class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                      :class="isDark ? 'translate-x-6' : 'translate-x-1'"
                    />
                  </button>
                </div>
                
                <!-- Reader Settings (only show on reader pages) -->
                <div v-if="isReaderPage">
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Reader Settings</p>
                  
                  <!-- Font Size -->
                  <div class="mb-3">
                    <label class="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                      Font Size: {{ fontSize }}px
                    </label>
                    <input
                      :value="fontSize"
                      @input="setFontSize(Number(($event.target as HTMLInputElement).value))"
                      type="range"
                      min="12"
                      max="24"
                      step="1"
                      class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  
                  <!-- Font Family -->
                  <div class="mb-3">
                    <span class="block text-sm text-gray-700 dark:text-gray-300 mb-1">Font Family</span>
                    <div class="flex gap-2">
                      <button
                        @click="setFontFamily('sans-serif')"
                        :class="[
                          'flex-1 py-1.5 text-sm rounded border transition-colors',
                          fontFamily === 'sans-serif'
                            ? 'bg-primary-100 border-primary-600 text-primary-700 dark:bg-primary-900 dark:border-primary-500 dark:text-primary-300'
                            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                        ]"
                      >
                        Sans
                      </button>
                      <button
                        @click="setFontFamily('serif')"
                        :class="[
                          'flex-1 py-1.5 text-sm rounded border transition-colors',
                          fontFamily === 'serif'
                            ? 'bg-primary-100 border-primary-600 text-primary-700 dark:bg-primary-900 dark:border-primary-500 dark:text-primary-300'
                            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                        ]"
                      >
                        Serif
                      </button>
                    </div>
                  </div>
                  
                  <!-- Line Height -->
                  <div>
                    <span class="block text-sm text-gray-700 dark:text-gray-300 mb-1">Line Height</span>
                    <div class="flex gap-2">
                      <button
                        @click="setLineHeight('compact')"
                        :class="[
                          'flex-1 py-1.5 text-xs rounded border transition-colors',
                          lineHeight === 'compact'
                            ? 'bg-primary-100 border-primary-600 text-primary-700 dark:bg-primary-900 dark:border-primary-500 dark:text-primary-300'
                            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                        ]"
                      >
                        Compact
                      </button>
                      <button
                        @click="setLineHeight('normal')"
                        :class="[
                          'flex-1 py-1.5 text-xs rounded border transition-colors',
                          lineHeight === 'normal'
                            ? 'bg-primary-100 border-primary-600 text-primary-700 dark:bg-primary-900 dark:border-primary-500 dark:text-primary-300'
                            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                        ]"
                      >
                        Normal
                      </button>
                      <button
                        @click="setLineHeight('relaxed')"
                        :class="[
                          'flex-1 py-1.5 text-xs rounded border transition-colors',
                          lineHeight === 'relaxed'
                            ? 'bg-primary-100 border-primary-600 text-primary-700 dark:bg-primary-900 dark:border-primary-500 dark:text-primary-300'
                            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                        ]"
                      >
                        Relaxed
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Mobile menu button -->
            <button 
              @click="mobileMenuOpen = !mobileMenuOpen"
              class="md:hidden p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path v-if="!mobileMenuOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Mobile Navigation -->
      <div v-if="mobileMenuOpen" class="md:hidden border-t border-gray-200 dark:border-gray-700">
        <div class="px-4 py-3 space-y-2">
          <NuxtLink 
            to="/" 
            class="block px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            @click="mobileMenuOpen = false"
          >
            Home
          </NuxtLink>
          <NuxtLink 
            to="/bookmarks" 
            class="block px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            @click="mobileMenuOpen = false"
          >
            Bookmarks
          </NuxtLink>
          <NuxtLink 
            to="/notes" 
            class="block px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            @click="mobileMenuOpen = false"
          >
            Notes
          </NuxtLink>
          <NuxtLink 
            to="/secrets" 
            class="block px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            @click="mobileMenuOpen = false"
          >
            Secrets
          </NuxtLink>
          <NuxtLink 
            to="/tags" 
            class="block px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            @click="mobileMenuOpen = false"
          >
            Tags
          </NuxtLink>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const mobileMenuOpen = ref(false)
const settingsOpen = ref(false)
const userMenuOpen = ref(false)
const { isDark, toggle: toggleDarkMode } = useDarkMode()
const { user, isAdmin, logout } = useAuth()

// Reader settings with real-time reactivity
const { fontSize, fontFamily, lineHeight, setFontSize, setFontFamily, setLineHeight } = useReaderSettings()

// Check if we're on a reader page
const isReaderPage = computed(() => {
  return route.path.includes('/bookmarks/') && route.params.id
})

// Handle logout
async function handleLogout() {
  userMenuOpen.value = false
  await logout()
}

// Close dropdown when clicking outside
onMounted(() => {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (!target.closest('.relative')) {
      settingsOpen.value = false
      userMenuOpen.value = false
    }
  })
})
</script>
