self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key.indexOf('penpad-') === 0)
            .map((key) => caches.delete(key))
        );
      })
      .then(() => self.registration.unregister())
  );
});
