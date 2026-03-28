// Custom Service Worker for Bkmk PWA
// This ensures offline functionality works properly

const CACHE_NAME = 'bkmk-offline-v1';

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching core assets');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache first, fallback to network
self.addEventListener('fetch', (event) => {
  const request = event.request;
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip API requests - let them go to network (our IndexedDB handles offline)
  if (request.url.includes('/api/')) {
    return;
  }
  
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      // Try to find in cache first
      return cache.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          console.log('[SW] Serving from cache:', request.url);
          // Return cached response but also fetch new version in background
          event.waitUntil(
            fetch(request)
              .then((networkResponse) => {
                if (networkResponse.ok) {
                  cache.put(request, networkResponse.clone());
                  console.log('[SW] Updated cache:', request.url);
                }
              })
              .catch(() => {
                // Network failed, that's fine - we have cached version
              })
          );
          return cachedResponse;
        }
        
        // Not in cache, try network
        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse.ok) {
              cache.put(request, networkResponse.clone());
              console.log('[SW] Cached new response:', request.url);
            }
            return networkResponse;
          })
          .catch(() => {
            // Network failed and not in cache
            console.log('[SW] Failed to fetch:', request.url);
            
            // For navigation requests, return index.html
            if (request.mode === 'navigate') {
              return cache.match('/');
            }
            
            return new Response('Offline', { status: 503 });
          });
      });
    })
  );
});

// Handle messages from main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});