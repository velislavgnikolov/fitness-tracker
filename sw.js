const CACHE_NAME = 'fitness-tracker-v43';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/db.js',
  './js/exercises-seed.js',
  './js/tabs/nutrition.js',
  './js/tabs/calendar.js',
  './js/tabs/exercises.js',
  './js/tabs/weight.js',
  './js/food-api.js',
  './js/barcode-scanner.js',
  './js/muscle-map.js',
  './js/body-front.svg',
  './js/body-back.svg',
  './js/reminders.js',
  './js/theme.js',
  './js/theme-ui.js',
  './js/todo-ui.js',
  './js/sheet.js',
  './js/push.js',
  './js/backup.js',
  './js/backup-ui.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first: whenever there's connectivity, always serve the latest
// deployed code immediately instead of yesterday's cache with a background
// update that only helps the *next* visit. Cache is just the offline
// fallback now, so a new version reaches the phone the moment it's opened -
// no more closing and reopening the app multiple times to pick up a change.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // let food API calls pass through, not cached

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

self.addEventListener('push', (event) => {
  let data = { title: 'Напомняне', body: '' };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    // ignore malformed payloads
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Напомняне', {
      body: data.body || '',
      icon: 'icons/icon-192.png',
      tag: 'push-' + Date.now(),
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      if (clients.length > 0) return clients[0].focus();
      return self.clients.openWindow('./index.html');
    })
  );
});
