// Sube este número CADA VEZ que subas cambios nuevos al repo.
// Es lo que fuerza a los celulares a bajar la versión nueva.
const CACHE_NAME = 'decorbaq-v4';

const ASSETS = [
  '/decorbaq-app/',
  '/decorbaq-app/index.html',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Barlow+Condensed:wght@600;700&display=swap'
];

self.addEventListener('install', event => {
  // FIX: antes se usaba cache.addAll(ASSETS), que es "todo o nada":
  // si Google Fonts fallaba un instante, el SW nuevo NUNCA se instalaba
  // y el celular quedaba atrapado en la versión vieja.
  // Ahora cada recurso se cachea por separado; si uno falla (ej. la fuente),
  // los demás se guardan igual y la instalación continúa.
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(
        ASSETS.map(url =>
          cache.add(url).catch(err => {
            console.warn('SW: no se pudo precachear', url, err);
          })
        )
      )
    )
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
          // FIX: solo guardar en caché respuestas VÁLIDAS (status 200-299).
          // Antes, si el servidor devolvía un 404 o error durante un
          // despliegue, esa página rota quedaba cacheada como "la app"
          // y el celular la seguía mostrando después.
          if (res && res.ok) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
          }
          return res;
        })
        .catch(() =>
          // FIX: doble fallback — si no hay coincidencia exacta de la URL,
          // servir el index.html precacheado en lugar de pantalla en blanco.
          caches.match(req).then(cached =>
            cached || caches.match('/decorbaq-app/index.html')
          )
        )
    );
  } else {
    // ─── CACHE-FIRST para el resto (fuentes, íconos, etc) ───
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req))
    );
  }
});
