const CACHE_NAME = 'centa-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/categories.js',
  '/js/charts.js',
  '/js/constants.js',
  '/js/db.js',
  '/js/state.js',
  '/js/utils.js',
  '/config.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;
  // Bypass Supabase API requests and other external APIs
  if (event.request.url.includes('supabase.co') || event.request.url.includes('google-analytics')) return;

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Return cached response if found (network-first strategy for index.html, cache-first for assets)
        if (event.request.url.endsWith('index.html') || event.request.url === self.registration.scope) {
           return fetch(event.request).catch(() => cachedResponse);
        }
        return cachedResponse || fetch(event.request);
      })
  );
});
