// Offline page loads: network-first for same-origin pages and assets, falling back to the cache.
// API calls, moderator pages, auth and React Server Component payloads are never cached.
const CACHE = 'tapcheck-v2';
const SHELL = ['/report', '/map', '/dashboard'];
const NEVER_CACHE = ['/api/', '/mod', '/login'];

self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));

self.addEventListener('activate', (e) =>
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())),
);

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const cacheable = e.request.method === 'GET' && url.origin === self.location.origin && !url.searchParams.has('_rsc')
    && !e.request.headers.has('RSC') && !NEVER_CACHE.some((p) => url.pathname.startsWith(p));
  if (!cacheable) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
        return res;
      })
      .catch(() => caches.match(e.request)),
  );
});
