/* HandyHub Web Push Service Worker
 * Handles incoming push events and notification clicks.
 */
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Minimal pass-through fetch handler — required for PWA installability criteria.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request).catch(() => Response.error()));
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'HandyHub', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Ono-Fix';
  // Chrome throws (and shows nothing) if renotify:true is used without a
  // non-empty tag. Always provide a tag so the notification actually appears.
  const tag = data.tag || ('ono-fix-' + (data.ts || Date.now()));
  const options = {
    body: data.body || '',
    icon: '/favicon.png',
    badge: '/favicon.png',
    data: { url: data.url || '/', ts: data.ts || Date.now() },
    tag: tag,
    renotify: true,
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing tab if URL matches origin, else open new one
      for (const c of clients) {
        if ('focus' in c) {
          c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
