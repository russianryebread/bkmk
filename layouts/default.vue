<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Header -->
    <header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <!-- Logo -->
          <NuxtLink to="/" class="flex items-center space-x-2">
            <svg class="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <span class="text-xl font-bold text-gray-900 dark:text-white">Bookmark App</span>
          </NuxtLink>

          <!-- Navigation -->
          <nav class="hidden md:flex items-center space-x-4">
            <NuxtLink 
              to="/" 
              class="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              active-class="bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300"
            >
              Home
            </NuxtLink>
            <NuxtLink 
              to="/bookmarks" 
              class="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              active-class="bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300"
            >
              Bookmarks
            </NuxtLink>
            <NuxtLink 
              to="/notes" 
              class="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              active-class="bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300"
            >
              Notes
            </NuxtLink>
            <NuxtLink 
              to="/secrets" 
              class="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              active-class="bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300"
            >
              Secrets
            </NuxtLink>
            <NuxtLink 
              to="/tags" 
              class="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              active-class="bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300"
            >
              Tags
            </NuxtLink>
          </nav>

          <!-- Actions -->
          <div class="flex items-center space-x-3">
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
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const mobileMenuOpen = ref(false)
</script>
