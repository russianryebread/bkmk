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
      navigateFallback: '/',
      // Cache all assets for offline use
      globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2,woff,ttf,eot}'],
      // Additional caching strategies
      runtimeCaching: [
        // Cache API responses with network-first strategy
        {
          urlPattern: /^https:\/\/.*\/api\/.*/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'api-cache',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 60 * 60 * 24 * 7 // 1 week
            },
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        },
        // Cache images
        {
          urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'images-cache',
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
            }
          }
        },
        // Cache fonts
        {
          urlPattern: /\.(?:woff|woff2|ttf|eot)$/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'fonts-cache',
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
            }
          }
        }
      ]
    },
    client: {
      installPrompt: true,
    },
    devOptions: {
      enabled: true,
      type: 'module'
    }
  },

  compatibilityDate: '2024-11-01'
})
