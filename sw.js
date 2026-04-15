// ── RELEASE CHECKLIST ────────────────────────────────────────────────────────
// Every time you deploy a new version, bump CACHE_NAME (e.g. centa-v3 → centa-v4).
// This clears the old cache on all installed devices and forces fresh asset downloads.
// Users get the update automatically on their next app open — no reinstall needed.
// ─────────────────────────────────────────────────────────────────────────────
const CACHE_NAME = 'centa-v7';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/cache.js',
  '/js/categories.js',
  '/js/charts.js',
  '/js/constants.js',
  '/js/db.js',
  '/js/state.js',
  '/js/utils.js',
  '/js/ui/budget.js',
  '/js/ui/debts.js',
  '/js/ui/dialogs.js',
  '/js/ui/goals.js',
  '/js/ui/kpi.js',
  '/js/ui/modals.js',
  '/js/ui/onboarding.js',
  '/js/ui/plan.js',
  '/js/ui/settings.js',
  '/js/ui/toast.js',
  '/js/ui/today.js',
  '/js/ui/health.js',
  '/js/ui/landing.js',
  '/assets/icon.png',
  '/config.js',
  '/manifest.json'
];

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

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
  // Only handle GET requests and http/https schemes
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;
  
  // Bypass Supabase API requests and other external APIs 
  // (we handle Supabase API caching in js/cache.js)
  if (event.request.url.includes('supabase.co') || event.request.url.includes('google-analytics')) return;

  // Stale-while-revalidate strategy for assets
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        });

        // specific behavior for root index.html to ensure fresh app loads
        if (event.request.url.endsWith('index.html') || event.request.url === self.registration.scope) {
           return fetchPromise.catch(() => cachedResponse);
        }

        return cachedResponse || fetchPromise;
      })
  );
});
