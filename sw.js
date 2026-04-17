const CACHE_NAME = 'methaniseur-tycoon-v20-1';

self.addEventListener('install', e => {
  // Pas de pré-cache agressif — on laisse le fetch handler remplir au fur et à mesure
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    // Purge tous les anciens caches (workbox-*, methaniseur-tycoon-vXX, etc.)
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
    // Force le rechargement de tous les clients ouverts pour obtenir la nouvelle version
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const c of clients) c.navigate(c.url);
  })());
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Supabase : network-first, pas de cache
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(fetch(e.request).catch(() => new Response('[]', {headers:{'Content-Type':'application/json'}})));
    return;
  }

  // Même origine uniquement
  if (url.origin !== self.location.origin) return;

  // Network-first pour index.html (évite de servir une version cassée figée)
  if (url.pathname.endsWith('/') || url.pathname.endsWith('index.html')) {
    e.respondWith(
      fetch(e.request).then(r => {
        const copy = r.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first pour le reste (manifest, icônes)
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
      if (resp.ok) {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
      }
      return resp;
    }))
  );
});
