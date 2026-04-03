// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  
  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@vite-pwa/nuxt',
  ],

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      title: 'bkmk',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no' },
        { name: 'description', content: 'Personal bookmarking application with offline reading and sync' },
        { name: 'theme-color', content: '#6366f1' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'Bkmk' }
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/icon-192.png' },
        { rel: 'manifest', href: '/manifest.json' }
      ]
    }
  },

  nitro: {
    storage: {
      db: {
        driver: 'fs',
        base: './data'
      }
    }
  },

  runtimeConfig: {
    public: {
      appName: 'bkmk'
    }
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'bkmk',
      short_name: 'bkmk',
      description: 'Personal bookmarking application with offline reading and sync',
      theme_color: '#6366f1',
      background_color: '#1a1a1a',
      display: 'standalone',
      orientation: 'portrait-primary',
      start_url: '/',
      scope: '/',
      icons: [
        {
          src: '/favicon.svg',
          sizes: 'any',
          type: 'image/svg+xml',
          purpose: 'any maskable'
        },
        {
          src: '/web-app-manifest-192x192.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: '/web-app-manifest-512x512.png',
          sizes: '512x512',
          type: 'image/png'
        }
      ]
    },
    workbox: {
      // Navigate to index for all non-API requests (handles SPA routing offline)
      navigateFallback: '/',
      // Cache ALL assets - this is critical for offline
      globPatterns: [
        '**/*.{js,css,html,json,png,svg,ico,woff,woff2,ttf,eot}',
      ],
      // Increase max cache size
      maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
    },
    client: {
      installPrompt: true,
    },
    devOptions: {
      enabled: true,
      type: 'module'
    }
  },

  vite: {
    optimizeDeps: {
      include: [
        '@vue/devtools-core',
        '@vue/devtools-kit',
        'workbox-window',
        'markdown-it',
      ]
    }
  },

  compatibilityDate: '2024-11-01'
})
