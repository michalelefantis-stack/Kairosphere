const CACHE_NAME = 'kairosphere-v1';
// The stylesheet is no longer a stable path — Vite emits it as a hashed asset,
// so it is cached at runtime by the fetch handler instead of precached here.
const ASSETS_TO_CACHE = [
  '/',
  '/index.html'
];

// Install event: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching initial assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event: serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached response if found
      if (response) {
        return response;
      }
      
      // Otherwise fetch from network
      return fetch(event.request).then((networkResponse) => {
        // Optionally cache new requests here, but for basic SW we just return it
        return networkResponse;
      }).catch(() => {
        // Offline fallback logic could go here
        console.log('[Service Worker] Fetch failed; offline');
      });
    })
  );
});
