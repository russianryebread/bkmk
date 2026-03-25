<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Minimal Header for Reader Mode -->
    <header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-14">
          <!-- Back Button -->
          <NuxtLink 
            to="/"
            class="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            <span class="text-sm font-medium">Back</span>
          </NuxtLink>

          <!-- Actions -->
          <div class="flex items-center space-x-2">
            <slot name="actions" />
          </div>
        </div>
      </div>
    </header>

    <!-- Reader Content -->
    <main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <slot />
    </main>
  </div>
</template>
