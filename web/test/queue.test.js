// Runs the real web/lib/queue.js and web/public/sw.js flush code against an in-memory IndexedDB stub and fake fetch.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const ID = '11111111-1111-4111-8111-111111111111';
const API = 'https://api.test';

function fakeIndexedDb(store) {
  const request = (result) => {
    const req = { result };
    return req;
  };
  return {
    open() {
      const req = {};
      queueMicrotask(() => {
        req.result = {
          objectStoreNames: { contains: () => true },
          createObjectStore() {},
          close() {},
          transaction() {
            const tx = {};
            const objectStore = {
              getAll: () => request([...store.values()]),
              count: () => request(store.size),
              put: (v) => (store.set(v.id, v), request(v.id)),
              delete: (k) => (store.delete(k), request(undefined)),
            };
            queueMicrotask(() => queueMicrotask(() => tx.oncomplete?.()));
            tx.objectStore = () => objectStore;
            return tx;
          },
        };
        req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    },
  };
}

const reply = (status, body) => ({ status, json: async () => (body instanceof Error ? Promise.reject(body) : body) });

function harness(kind, entries, respond) {
  const store = new Map(entries.map((e) => [e.id, { id: e.id, apiUrl: API, report: e, queued_at: 1 }]));
  const calls = [];
  const fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body.id);
    return respond(body.id);
  };
  const posted = [];
  const ctx = {
    indexedDB: fakeIndexedDb(store), fetch, console, Event: class {}, PUBLIC_API_URL: API,
    window: { dispatchEvent() {} }, navigator: {}, Error, Promise, JSON, Date, Set, Map,
    self: { clients: { matchAll: async () => [{ postMessage: (m) => posted.push(m) }] }, addEventListener() {}, location: { origin: 'https://web.test' } },
    caches: {}, URL,
  };
  vm.createContext(ctx);
  if (kind === 'page') {
    const src = read('lib/queue.js').replace(/^import .*$/m, '').replace(/^export (const|async function|function)/gm, '$1');
    vm.runInContext(`${src}\nthis.flushQueue = flushQueue; this.listQueuedReports = listQueuedReports; this.removeQueuedReport = removeQueuedReport;`, ctx);
    return { store, calls, flush: async () => JSON.parse(JSON.stringify(await ctx.flushQueue())),
      list: async () => JSON.parse(JSON.stringify(await ctx.listQueuedReports())),
      remove: (id) => ctx.removeQueuedReport(id) };
  }
  vm.runInContext(`${read('public/sw.js')}\nthis.flushQueue = flushQueue;`, ctx);
  return {
    store, calls, posted,
    flush: async () => {
      try { await ctx.flushQueue(); return { threw: false, ...posted.at(-1) }; } catch { return { threw: true, ...posted.at(-1) }; }
    },
  };
}

const entry = (id = ID, extra = {}) => ({ id, issue_type: 'odor', photo: 'data:image/jpeg;base64,AAAA', ...extra });
const ids = (n) => Array.from({ length: n }, (_, i) => `22222222-2222-4222-8222-${String(i).padStart(12, '0')}`);

for (const kind of ['page', 'sw']) {
  const sentOf = (r) => (kind === 'page' ? r.sent : undefined);
  const stillQueued = (r) => (kind === 'page' ? r.offline + r.limited + r.failed : r.pending);

  test(`${kind}: 201 with matching id deletes the entry once`, async () => {
    const h = harness(kind, [entry()], (id) => reply(201, { id, remaining: 2 }));
    const r = await h.flush();
    assert.equal(h.store.size, 0);
    assert.deepEqual(h.calls, [ID]);
    if (kind === 'page') assert.deepEqual(r, { offline: 0, limited: 0, failed: 0, sent: 1, remaining: 2 });
    else assert.equal(r.threw, false);
  });

  test(`${kind}: 200 duplicate with matching id deletes the entry`, async () => {
    const h = harness(kind, [entry()], (id) => reply(200, { id, duplicate: true }));
    const r = await h.flush();
    assert.equal(h.store.size, 0);
    if (kind === 'page') assert.equal(r.sent, 1);
  });

  const retained = {
    '200 without duplicate': () => reply(200, { id: ID }),
    '201 with wrong id': () => reply(201, { id: '33333333-3333-4333-8333-333333333333' }),
    '201 with missing id': () => reply(201, { remaining: 1 }),
    '200 duplicate with wrong id': () => reply(200, { id: '33333333-3333-4333-8333-333333333333', duplicate: true }),
    '200 duplicate with missing id': () => reply(200, { duplicate: true }),
    'malformed JSON': () => reply(201, new SyntaxError('bad json')),
    '400': () => reply(400, { error: 'x' }),
    '401': () => reply(401, {}),
    '403': () => reply(403, {}),
    '413': () => reply(413, {}),
    '422': () => reply(422, {}),
    '429': () => reply(429, {}),
    '500': () => reply(500, {}),
    'network failure': () => { throw new TypeError('Failed to fetch'); },
  };
  for (const [name, respond] of Object.entries(retained)) {
    test(`${kind}: ${name} keeps the original entry`, async () => {
      const original = entry();
      const h = harness(kind, [original], respond);
      const r = await h.flush();
      assert.equal(h.store.size, 1);
      assert.equal(h.store.get(ID).report.photo, original.photo);
      assert.equal(stillQueued(r), 1);
      assert.notEqual(sentOf(r), 1);
      if (kind === 'sw') assert.equal(r.threw, true);
      if (kind === 'page') {
        const expected = { '429': 'limited', '500': 'offline', 'network failure': 'offline' }[name] || 'failed';
        assert.equal(r[expected], 1, JSON.stringify(r));
      }
    });
  }

  test(`${kind}: mixed batch reports correct counts and deletes only accepted entries`, async () => {
    const [a, b, c, d, e, f] = ids(6);
    const behaviour = {
      [a]: () => reply(201, { id: a, remaining: 4 }),
      [b]: () => reply(200, { id: b, duplicate: true }),
      [c]: () => reply(422, {}),
      [d]: () => reply(429, {}),
      [e]: () => reply(503, {}),
      [f]: () => { throw new TypeError('offline'); },
    };
    const h = harness(kind, [a, b, c, d, e, f].map((x) => entry(x)), (id) => behaviour[id]());
    const r = await h.flush();
    assert.deepEqual([...h.store.keys()].sort(), [c, d, e, f].sort());
    if (kind === 'page') assert.deepEqual(r, { offline: 2, limited: 1, failed: 1, sent: 2, remaining: 4 });
    else assert.deepEqual([r.pending, r.failed, r.threw], [4, 1, true]);
  });
}

test('page: duplicate acknowledgement after a valid one keeps the numeric remaining', async () => {
  const [a, b] = ids(2);
  const h = harness('page', [entry(a), entry(b)], (id) => (id === a ? reply(201, { id, remaining: 3 }) : reply(200, { id, duplicate: true })));
  assert.deepEqual(await h.flush(), { offline: 0, limited: 0, failed: 0, sent: 2, remaining: 3 });
});

test('page: residents can review and remove one saved report without deleting others', async () => {
  const [a, b] = ids(2);
  const h = harness('page', [entry(a), entry(b)], () => reply(400, {}));
  await h.flush();
  assert.deepEqual(await h.list(), [
    { id: a, queued_at: 1, issue_type: 'odor' },
    { id: b, queued_at: 1, issue_type: 'odor' },
  ]);
  await h.remove(a);
  assert.deepEqual([...h.store.keys()], [b]);
  assert.equal(h.store.get(b).report.photo, 'data:image/jpeg;base64,AAAA');
  assert.deepEqual(await h.list(), [{ id: b, queued_at: 1, issue_type: 'odor' }]);
});
