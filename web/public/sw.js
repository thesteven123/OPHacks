// TapCheck service worker:
// 1. Caches the app shell and static assets so /report, /map and /dashboard open offline.
// 2. Caches the public report list and stats so the map and status page show the last known data offline.
// 3. Sends queued reports on the "sync" event (background sync), even after the tab is closed.
// Never caches moderator pages, auth, or the moderator API.
const CACHE = 'tapcheck-v4';
const SHELL = ['/report', '/map', '/dashboard'];
const NEVER_CACHE = ['/api/', '/mod', '/login'];
const PUBLIC_DATA = ['/api/reports', '/api/stats'];
// Keep in sync with web/lib/queue.js.
const DB_NAME = 'tapcheck';
const STORE = 'queue';
const SYNC_TAG = 'tapcheck-flush';

const OFFLINE_PAGE = `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><title>Offline</title>
<body style="font:16px system-ui;margin:2rem;color:#111827"><h1>You're offline</h1>
<p>This page needs a connection. <a href="/report">Report a problem</a> still works offline and sends when you reconnect.</p></body>`;

// Next.js file names are hashed per build, so read them from each shell page (HTML and inline RSC payload) and
// pre-cache them; otherwise a first visit would only have the chunks loaded after the worker took control.
const STATIC_REF = /(?:\/_next\/)?static\/(?:chunks|css|media)\/[\w\-./~]+?\.(?:js|css|woff2?|png|svg)/g;

async function precache() {
  const cache = await caches.open(CACHE);
  const assets = new Set();
  for (const path of SHELL) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`precache ${path}: ${res.status}`);
    await cache.put(path, res.clone());
    for (const ref of (await res.text()).match(STATIC_REF) || []) assets.add(ref.startsWith('/') ? ref : `/_next/${ref}`);
  }
  await Promise.allSettled([...assets].map((a) => cache.add(a)));
}

self.addEventListener('install', (e) => e.waitUntil(precache().then(() => self.skipWaiting())));

self.addEventListener('activate', (e) =>
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())),
);

async function networkFirst(request) {
  try {
    const res = await fetch(request);
    if (res.ok) (await caches.open(CACHE)).put(request, res.clone());
    return res;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) (await caches.open(CACHE)).put(request, res.clone());
  return res;
}

const offlinePage = () => new Response(OFFLINE_PAGE, { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } });

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Public API data (the API runs on another origin): last known copy when offline.
  if (!sameOrigin) {
    if (PUBLIC_DATA.includes(url.pathname)) e.respondWith(networkFirst(request));
    return;
  }
  const isRsc = url.searchParams.has('_rsc') || request.headers.has('RSC');
  if (isRsc) return;
  if (NEVER_CACHE.some((p) => url.pathname.startsWith(p))) {
    if (request.mode === 'navigate') e.respondWith(fetch(request).catch(offlinePage));
    return;
  }
  if (url.pathname.startsWith('/_next/static/')) return e.respondWith(cacheFirst(request));
  e.respondWith(networkFirst(request).catch(() => (request.mode === 'navigate' ? offlinePage() : Response.error())));
});

function withStore(mode, fn) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE, { keyPath: 'id' });
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => { db.close(); resolve(req?.result); };
      tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
    };
  });
}

// Keep in sync with acknowledgement() in web/lib/queue.js.
async function acknowledged(res, id) {
  if (res.status !== 201 && res.status !== 200) return false;
  const body = await res.json().catch(() => null);
  if (typeof body?.id !== 'string' || body.id.toLowerCase() !== id.toLowerCase()) return false;
  return res.status === 201 || body.duplicate === true;
}

async function flushQueue() {
  let pending = 0, failed = 0;
  for (const { id, apiUrl, report } of await withStore('readonly', (s) => s.getAll())) {
    try {
      const res = await fetch(`${apiUrl}/api/reports`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(report) });
      if (res.status === 429 || res.status >= 500) { pending++; continue; }
      if (!(await acknowledged(res, id))) { pending++; failed++; continue; }
      await withStore('readwrite', (s) => s.delete(id));
    } catch {
      pending++;
    }
  }
  for (const client of await self.clients.matchAll()) client.postMessage({ type: 'queue-synced', pending, failed });
  // A rejected sync makes the browser retry later with backoff.
  if (pending) throw new Error(`${pending} report(s) still queued`);
}

self.addEventListener('sync', (e) => {
  if (e.tag === SYNC_TAG) e.waitUntil(flushQueue());
});

// Same flush on request from a page (browsers without Background Sync); waitUntil lets it finish if the page closes.
self.addEventListener('message', (e) => {
  if (e.data?.type === 'flush-queue') e.waitUntil(flushQueue().catch(() => {}));
});
