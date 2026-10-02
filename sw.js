// Finance Tracker service worker: works offline, receives shared PDFs.
const VERSION = 'ft-v3';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './pdf.min.js', './pdf.worker.min.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('ft-v') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // A PDF shared from Paytm / Files
  if (e.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try {
        const fd = await e.request.formData(); const f = fd.get('file');
        if (f) { const c = await caches.open('ft-shared'); await c.put(new URL('./shared-file', self.registration.scope).href, new Response(f, { headers: { 'X-File-Name': encodeURIComponent(f.name || 'statement.pdf') } })); }
      } catch (err) { }
      return Response.redirect(new URL('./?shared=1#import', self.registration.scope).href, 303);
    })());
    return;
  }
  if (e.request.method !== 'GET') return;
  // Fonts: cache first
  if (url.hostname.includes('fonts.g')) {
    e.respondWith(caches.open('ft-fonts').then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { c.put(e.request, r.clone()); return r; })));
    return;
  }
  if (url.origin !== location.origin) return;
  // App files: answer from cache instantly, refresh the cache in the background (updates show on next open)
  e.respondWith(caches.open(VERSION).then(async c => {
    const isPage = e.request.mode === 'navigate' && (url.pathname.endsWith('/') || url.pathname.endsWith('.html'));
    const req = isPage ? './index.html' : e.request;
    const cached = await c.match(req, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => cached);
    return cached || net;
  }));
});
