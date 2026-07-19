/**
 * Custom service-worker wrapper: all of Angular's ngsw behavior (caching,
 * updates) plus one thing ngsw can't do — handling taps on the gentle
 * whisper notifications. Registered instead of ngsw-worker.js (relative
 * paths everywhere: the app lives under a subpath on GitHub Pages).
 */
importScripts('./ngsw-worker.js');

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // A reminder («la campanita», 0.0.111) carries its branch's deep link;
  // the whisper question keeps landing on the check-in.
  const path = event.notification.data && event.notification.data.url ? event.notification.data.url : './check-in';
  const target = new URL(path, self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      // Prefer the window the user was last in, not whichever enumerates
      // first; navigate() can reject on uncontrolled clients — a rejection
      // must not kill the focus.
      const client = windows.find((w) => w.focused) ?? windows[0];
      if (client && 'focus' in client) {
        if ('navigate' in client) {
          return Promise.resolve(client.navigate(target)).catch(() => null).then(() => client.focus());
        }
        return client.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
