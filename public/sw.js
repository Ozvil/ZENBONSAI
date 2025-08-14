// public/sw.js  (v0.5.2)
const CACHE = 'zenbonsai-v0.5.2';

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      c.addAll([
        '/',                    // shell
        '/manifest.webmanifest' // manifiesto
      ])
    )
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first para TODO lo de /assets (JS/CSS generados por Vite) para no
// quedar atrapados en versiones viejas del bundle.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Deja pasar los bundles nuevos sin cachearlos agresivamente
  if (url.origin === location.origin && url.pathname.startsWith('/assets/')) {
    return; // no interceptar -> el navegador va directo a red
  }

  // Para lo demás: intenta red y, si falla (offline), devuelve lo cacheado
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
