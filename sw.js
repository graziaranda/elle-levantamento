const CACHE = 'elle-levantamento-v2';

const PRECACHE = [
  '/elle-levantamento/elle-levantamento-tablet.html',
  '/elle-levantamento/',
  '/elle-levantamento/index.html',
  '/elle-levantamento/js/data.js',
  '/elle-levantamento/js/canvas-editor.js',
  '/elle-levantamento/js/dashboard.js',
  '/elle-levantamento/js/app.js',
  '/elle-levantamento/js/dxf-writer.js',
  '/elle-levantamento/js/pdf-report.js',
  '/elle-levantamento/js/photo-annotator.js',
  '/elle-levantamento/css/app.css',
  '/elle-levantamento/manifest.json',
];

// Instala: pré-cacheia o app principal
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

// Ativa: remove caches antigos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch: cache-first para tudo (app funciona offline)
self.addEventListener('fetch', e => {
  // Ignora requests não-GET e chrome-extension
  if (e.request.method !== 'GET') return;
  if (e.request.url.startsWith('chrome-extension')) return;

  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(e.request);
      if (cached) {
        // Serve do cache e atualiza em background quando online
        fetch(e.request).then(res => {
          if (res && res.status === 200) cache.put(e.request, res);
        }).catch(() => {});
        return cached;
      }

      // Não está no cache: busca na rede e guarda
      try {
        const res = await fetch(e.request, { mode: e.request.mode === 'no-cors' ? 'no-cors' : 'cors' });
        if (res && (res.status === 200 || res.type === 'opaque')) {
          cache.put(e.request, res.clone());
        }
        return res;
      } catch {
        // Offline e não está no cache
        if (e.request.destination === 'document') {
          return cache.match('/elle-levantamento/elle-levantamento-tablet.html');
        }
        return new Response('', { status: 503 });
      }
    })
  );
});
