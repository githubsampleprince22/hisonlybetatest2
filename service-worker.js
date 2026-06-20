const CACHE_NAME = 'hisonly-v4';
const ASSETS = [
  './',
  './index.html',
  './register.html',
  './home.html',
  './calendar.html',
  './schedule.html',
  './lineup.html',
  './team.html',
  './profile.html',
  './css/style.css',
  './js/app.js',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600&display=swap',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  
  // Don't cache or fallback for API requests or non-GET requests
  if (url.pathname.startsWith('/api/') || e.request.method !== 'GET') {
    e.respondWith(fetch(e.request));
    return;
  }

  // Use Network-First strategy for HTML navigation requests to ensure fresh content
  if (e.request.mode === 'navigate' || (e.request.headers.get('accept') && e.request.headers.get('accept').includes('text/html'))) {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          if (response && (response.status === 200 || response.type === 'opaque')) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(e.request).then(cached => cached || caches.match('./index.html'));
        })
    );
    return;
  }

  // Use Stale-While-Revalidate for static assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) {
        // Fetch fresh in background to update cache
        fetch(e.request)
          .then(response => {
            if (response && (response.status === 200 || response.type === 'opaque')) {
              caches.open(CACHE_NAME).then(cache => cache.put(e.request, response));
            }
          })
          .catch(() => {});
        return cached;
      }
      return fetch(e.request);
    })
  );
});
