// Sube este número CADA VEZ que subas cambios nuevos al repo.
// Es lo que fuerza a los celulares a bajar la versión nueva.
const CACHE_NAME = 'decorbaq-v3';

const ASSETS = [
  '/decorbaq-app/',
  '/decorbaq-app/index.html',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Barlow+Condensed:wght@600;700&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // Nunca interceptar las llamadas al backend (Google Script)
  if (req.url.includes('script.google.com')) return;

  // Solo nos interesa cachear peticiones GET
  if (req.method !== 'GET') return;

  const isHTML = req.mode === 'navigate' || req.destination === 'document';

  if (isHTML) {
    // ─── NETWORK-FIRST para el HTML/shell de la app ───
    // Así, si hay internet, SIEMPRE se pide la versión más nueva.
    // Solo si no hay conexión, se usa la copia guardada en cache.
    event.respondWith(
      fetch(req)
        .then(res => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req))
    );
  } else {
    // ─── CACHE-FIRST para el resto (fuentes, íconos, etc) ───
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req))
    );
  }
});
