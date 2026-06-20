const CACHE_NAME = 'hisonly-v5';
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
  
  // Don't intercept API requests or non-GET requests — let the browser handle them naturally
  if (url.pathname.includes('/api/') || e.request.method !== 'GET') {
    return;
  }

  // Use Network-First strategy for HTML, JS, and CSS files to ensure fresh logic and markup
  const isHtml = e.request.mode === 'navigate' || (e.request.headers.get('accept') && e.request.headers.get('accept').includes('text/html'));
  const isCodeOrStyle = url.pathname.endsWith('.js') || url.pathname.endsWith('.css');

  if (isHtml || isCodeOrStyle) {
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
          return caches.match(e.request).then(cached => cached || (isHtml ? caches.match('./index.html') : null));
        })
    );
    return;
  }

  // Use Stale-While-Revalidate for other static assets (images, fonts, manifest)
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
