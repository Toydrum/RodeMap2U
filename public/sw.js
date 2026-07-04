/**
 * Custom service-worker wrapper: all of Angular's ngsw behavior (caching,
 * updates) plus one thing ngsw can't do — handling taps on the gentle
 * whisper notifications. Registered instead of ngsw-worker.js (relative
 * paths everywhere: the app lives under a subpath on GitHub Pages).
 */
importScripts('./ngsw-worker.js');

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL('./check-in', self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
