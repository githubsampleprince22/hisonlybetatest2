const CACHE_NAME = 'hisonly-v2';
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
  
  // Don't cache or fallback for API requests
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request));
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => {
      // Only fallback to index.html for navigation requests or HTML pages
      if (e.request.mode === 'navigate' || e.request.headers.get('accept').includes('text/html')) {
        return caches.match('./index.html');
      }
    }))
  );
});
