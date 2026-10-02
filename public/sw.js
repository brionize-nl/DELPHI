const CACHE = 'delphi-pwa-v18';
const STATIC = ['/', '/index.html', '/manifest.json', '/icon-192.svg', '/icon-512.svg', '/css/delphi.css', '/js/app.js', '/js/chat.js', '/js/werkplaats.js', '/js/editor.js', '/js/chains.js', '/js/notify.js', '/js/inspector.js', '/js/launchpad.js', '/js/history.js', '/js/voice.js', '/js/dashboard.js', '/js/projects.js', '/data/projects.json'];

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

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(windows => {
    const existing = windows.find(w => new URL(w.url).origin === self.location.origin);
    return existing ? existing.focus() : self.clients.openWindow('/');
  }));
});
