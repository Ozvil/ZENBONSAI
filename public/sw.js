// --- ZenBonsai Service Worker ---
const CACHE_STATIC = 'zb-static-v1';
const CACHE_DYNAMIC = 'zb-dyn-v1';

const PRECACHE = [
  '/', '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-180.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  // Datasets que usa la app
  '/species.json',
  '/estilos.es.json',
  '/tips_generales.es.json',
  '/tools.es.json',
  '/propagation.es.json',
];

self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE_STATIC)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys
        .filter((k) => ![CACHE_STATIC, CACHE_DYNAMIC].includes(k))
        .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Estrategias:
// - Navegación (SPA): network-first con fallback a /index.html
// - JSON: network-first (guarda copia para offline)
// - Scripts/estilos/assets (incluye /assets/ de Vite): cache-first
// - Imágenes: stale-whil
