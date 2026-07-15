/* MVS Brokerage — service worker (offline app) */
// Bump this version string on every deploy — it forces old caches to be
// dropped and the new service worker to take over without a hard refresh.
const CACHE = 'mvs-brokerage-v2';
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-180.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isAppShell = url.origin === self.location.origin &&
    (req.mode === 'navigate' || url.pathname.endsWith('index.html') || url.pathname.endsWith('manifest.json'));

  if (isAppShell) {
    // Network-first: always try to get the freshest index.html/manifest so
    // your changes show up on a normal reload — no hard refresh needed.
    // Falls back to whatever's cached only when there's no network (offline).
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // Everything else (icons, CDN libraries): cache-first for speed & offline use.
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
