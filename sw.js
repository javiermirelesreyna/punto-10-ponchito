/* =====================================================================
   Punto 10 Fútbol Tenis — service worker (app instalable y modo sin conexión)
   Al publicar una versión nueva del sitio, sube el número de VERSION.
   ===================================================================== */
const VERSION = 'punto10-v4';
const BASICOS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'config.js?v=4',
  'assets/styles.css?v=4',
  'assets/common.js?v=4',
  'assets/public.js?v=4',
  'assets/logo.webp',
  'assets/logo-256.png',
  'assets/favicon.png',
  'assets/icon-192.png',
  'data/torneos.json'
];

self.addEventListener('install', ev => {
  ev.waitUntil(
    caches.open(VERSION)
      .then(c => Promise.all(BASICOS.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(k => k.startsWith('punto10-') && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // GitHub, fuentes, etc.: sin tocar

  if (url.pathname.endsWith('/data/torneos.json')) {
    // Datos: siempre lo más nuevo; si no hay internet, lo último guardado
    ev.respondWith(redPrimero(req, new URL('data/torneos.json', self.registration.scope).href));
  } else if (req.mode === 'navigate') {
    ev.respondWith(redPrimero(req, null, true));
  } else {
    // Archivos con versión e imágenes: se guardan y se sirven al instante
    ev.respondWith(cachePrimero(req));
  }
});

async function redPrimero(req, clave, esPagina) {
  const cache = await caches.open(VERSION);
  try {
    const r = await fetch(req);
    if (r.ok) cache.put(clave || req, r.clone());
    return r;
  } catch (err) {
    const guardada = await cache.match(clave || req, { ignoreSearch: true });
    if (guardada) return guardada;
    if (esPagina) {
      const inicio = await cache.match(new URL('index.html', self.registration.scope).href);
      if (inicio) return inicio;
    }
    throw err;
  }
}

async function cachePrimero(req) {
  const cache = await caches.open(VERSION);
  const guardada = await cache.match(req);
  if (guardada) return guardada;
  const r = await fetch(req);
  if (r.ok && r.type === 'basic') cache.put(req, r.clone());
  return r;
}
