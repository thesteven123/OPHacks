// Offline queue: reports wait in IndexedDB and resend with the same id, so the API deduplicates retries.
// IndexedDB (not localStorage) because the service worker must read the queue for background sync, and photos
// would overflow localStorage's ~5 MB. Keep DB_NAME, STORE, SYNC_TAG and the record shape in sync with public/sw.js.
import { PUBLIC_API_URL } from './config';

const DB_NAME = 'tapcheck';
const STORE = 'queue';
const SYNC_TAG = 'tapcheck-flush';
export const QUEUE_EVENT = 'tapcheck-queue';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(req?.result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

const notify = () => window.dispatchEvent(new Event(QUEUE_EVENT));
const put = (report) => withStore('readwrite', (s) => s.put({ id: report.id, apiUrl: PUBLIC_API_URL, report, queued_at: Date.now() }));

export const queuedCount = () => withStore('readonly', (s) => s.count());

// Lets the browser send the queue later, even if the tab is closed (Chromium only). Where Background Sync is missing
// or disabled, the page flushes on load and on reconnect instead (see OfflineSyncBanner).
async function requestBackgroundSync() {
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  await reg?.sync.register(SYNC_TAG).catch(() => {});
}

export async function addToQueue(report) {
  let photoDropped = false;
  try {
    await put(report);
  } catch {
    await put({ ...report, photo: null });
    photoDropped = Boolean(report.photo);
  }
  notify();
  requestBackgroundSync();
  return { photoDropped };
}

// The queue entry is deleted only for an acknowledgement that names the queued id: 201 (created) or 200 with
// duplicate:true (an earlier retry landed). Any other reply, including 2xx with a mismatched or unreadable body, keeps
// the report. Keep in sync with acknowledged() in public/sw.js.
async function acknowledgement(res, id) {
  if (res.status !== 201 && res.status !== 200) return null;
  const body = await res.json().catch(() => null);
  if (typeof body?.id !== 'string' || body.id.toLowerCase() !== id.toLowerCase()) return null;
  if (res.status === 200 && body.duplicate !== true) return null;
  return body;
}

let running = null;
export function flushQueue() {
  running ??= (async () => {
    let offline = 0, limited = 0, failed = 0, sent = 0, remaining;
    for (const { id, apiUrl, report } of await withStore('readonly', (s) => s.getAll())) {
      try {
        const res = await fetch(`${apiUrl}/api/reports`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(report) });
        if (res.status === 429) { limited++; continue; }
        if (res.status >= 500) { offline++; continue; }
        const ack = await acknowledgement(res, id);
        if (!ack) { failed++; continue; }
        if (typeof ack.remaining === 'number') remaining = ack.remaining;
        sent++;
        await withStore('readwrite', (s) => s.delete(id));
      } catch {
        offline++;
      }
    }
    notify();
    return { offline, limited, failed, sent, remaining };
  })().finally(() => { running = null; });
  return running;
}
