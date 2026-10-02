const CACHE = 'delphi-pwa-v4';
const STATIC = ['/', '/index.html', '/manifest.json', '/icon-192.svg', '/icon-512.svg', '/css/delphi.css', '/js/app.js', '/js/chat.js', '/js/werkplaats.js', '/js/launchpad.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('/api/')) return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
