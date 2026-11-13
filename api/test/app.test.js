// Runs against a real PostgreSQL database: set DATABASE_URL to a disposable test database and run `npx prisma migrate deploy` first.
const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { createApp } = require('../src/app');
const { stripJpegMetadata } = require('../src/photo');

const KEY = 'test-internal-key';
const MOD = { email: 'mod@example.org', password: 'correct horse battery' };
const prisma = new PrismaClient();
const uploaded = new Map();
const fakePhotos = {
  upload: async (jpeg, id) => (uploaded.set(`tapcheck/${id}`, jpeg), `tapcheck/${id}`),
  url: (publicId) => `https://res.cloudinary.test/authenticated/s--sig--/${publicId}.jpg`,
};
const servers = [];

async function start(opts = {}) {
  const server = createApp({ prisma, photos: fakePhotos, apiKey: KEY, dailyLimit: 3, perMinuteLimit: 100, ...opts }).listen(0);
  servers.push(server);
  await new Promise((r) => server.once('listening', r));
  return `http://localhost:${server.address().port}`;
}

const json = (body, headers = {}) => ({ method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const report = (extra = {}) => ({
  id: crypto.randomUUID(), issue_type: 'odor', severity: 2, duration: 'today', water_usable: 'unsure',
  lat: 37.871234, lng: -122.259876, description: 'smells', ...extra,
});
const internal = (base, path, opts = {}) => fetch(`${base}${path}`, { ...opts, headers: { 'content-type': 'application/json', 'x-api-key': KEY, ...opts.headers } });

const segment = (marker, payload) => Buffer.concat([Buffer.from([0xff, marker]), Buffer.from([0, payload.length + 2]), payload]);
const fakeJpeg = Buffer.concat([
  Buffer.from([0xff, 0xd8]),
  segment(0xe0, Buffer.from('JFIF\0')),
  segment(0xe1, Buffer.from('Exif\0\0GPSLatitude 37.871234')),
  segment(0xfe, Buffer.from('camera serial 123')),
  segment(0xdb, Buffer.alloc(5, 1)),
  Buffer.from([0xff, 0xda, 0, 4, 9, 9, 0xab, 0xcd, 0xff, 0xd9]),
]);

before(async () => {
  await prisma.moderator.deleteMany();
  await prisma.moderator.create({ data: { email: MOD.email, password_hash: await bcrypt.hash(MOD.password, 4) } });
});
beforeEach(async () => {
  await prisma.statusChange.deleteMany();
  await prisma.report.deleteMany();
  uploaded.clear();
});
after(async () => {
  servers.forEach((s) => s.close());
  await prisma.$disconnect();
});

test('public view hides precise location, contact email and internal notes; retries do not duplicate', async () => {
  const base = await start();
  const r = report({ contact_email: 'resident@example.org' });
  assert.equal((await fetch(`${base}/api/reports`, json(r))).status, 201);
  assert.deepEqual(await (await fetch(`${base}/api/reports`, json(r))).json(), { id: r.id, duplicate: true });

  await internal(base, `/api/reports/${r.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'verified', note: 'called utility' }) });
  const [pub] = await (await fetch(`${base}/api/reports`)).json();
  assert.equal(pub.status, 'verified');
  assert.equal(pub.public_lat, 37.871);
  assert.equal(pub.public_lng, -122.26);
  for (const hidden of ['precise_lat', 'precise_lng', 'contact_email', 'moderator_note', 'submitter_hash', 'history']) assert.equal(pub[hidden], undefined, hidden);

  const detail = await (await internal(base, `/api/reports/${r.id}`)).json();
  assert.equal(detail.precise_lat, 37.871234);
  assert.equal(detail.contact_email, 'resident@example.org');
  assert.equal(detail.submitter_hash, undefined);
  assert.deepEqual(detail.history.map((h) => h.status), ['open', 'verified']);

  await internal(base, `/api/reports/${r.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'rejected' }) });
  assert.equal((await (await fetch(`${base}/api/reports`)).json()).length, 0);
  assert.equal((await (await fetch(`${base}/api/export?format=geojson`)).json()).features.length, 0);
});

test('moderator routes need the internal key', async () => {
  const base = await start();
  for (const [method, path] of [['GET', '/api/mod/reports'], ['GET', `/api/reports/${crypto.randomUUID()}`], ['PATCH', `/api/reports/${crypto.randomUUID()}`], ['POST', '/api/auth/verify']]) {
    assert.equal((await fetch(`${base}${path}`, { method, headers: { 'x-api-key': 'wrong' } })).status, 401, `${method} ${path}`);
  }
  assert.equal((await internal(base, '/api/mod/reports')).status, 200);
});

test('moderator login: bcrypt check, then lockout after 5 failures', async () => {
  const base = await start();
  const login = (password) => internal(base, '/api/auth/verify', { method: 'POST', body: JSON.stringify({ email: 'MOD@example.org', password }) });
  const ok = await login(MOD.password);
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).email, MOD.email);
  const codes = [];
  for (let i = 0; i < 6; i++) codes.push((await login('wrong')).status);
  assert.deepEqual(codes, [401, 401, 401, 401, 401, 429]);
  assert.equal((await login(MOD.password)).status, 429);
});

test('rejects invalid input and enforces the daily limit with a remaining count', async () => {
  const base = await start();
  for (const bad of [{ issue_type: 'fire' }, { lat: 200 }, { id: 'nope' }, { severity: 5 }, { duration: 'x' }, { water_usable: 'x' }, { contact_email: 'nope' }, { photo: 'data:image/png;base64,AAAA' }])
    assert.equal((await fetch(`${base}/api/reports`, json(report(bad)))).status, 400, JSON.stringify(bad));
  const results = [];
  for (let i = 0; i < 4; i++) {
    const res = await fetch(`${base}/api/reports`, json(report()));
    results.push([res.status, (await res.json()).remaining]);
  }
  assert.deepEqual(results, [[201, 2], [201, 1], [201, 0], [429, 0]]);
  assert.equal((await fetch(`${base}/api/reports`, json(report(), { 'x-api-key': KEY }))).status, 201);
});

test('per-minute rate limit returns 429', async () => {
  const base = await start({ perMinuteLimit: 2, dailyLimit: 100 });
  const codes = [];
  for (let i = 0; i < 3; i++) codes.push((await fetch(`${base}/api/reports`, json(report()))).status);
  assert.deepEqual(codes, [201, 201, 429]);
});

test('photos are stripped before upload and served only through signed URLs', async () => {
  assert.equal(stripJpegMetadata(Buffer.from('not a jpeg')), null);
  const base = await start();
  const r = report({ photo: `data:image/jpeg;base64,${fakeJpeg.toString('base64')}` });
  assert.equal((await (await fetch(`${base}/api/reports`, json(r))).json()).photo_saved, true);
  const stored = uploaded.get(`tapcheck/${r.id}`);
  assert.equal(stored.includes('GPSLatitude'), false);
  assert.equal(stored.includes('camera serial'), false);
  assert.equal(stored.includes('JFIF'), true);
  const [pub] = await (await fetch(`${base}/api/reports`)).json();
  assert.equal(pub.photo_url, `https://res.cloudinary.test/authenticated/s--sig--/tapcheck/${r.id}.jpg`);
});

test('without Cloudinary, the report is kept and the photo dropped', async () => {
  const base = await start({ photos: null });
  const res = await fetch(`${base}/api/reports`, json(report({ photo: `data:image/jpeg;base64,${fakeJpeg.toString('base64')}` })));
  assert.equal(res.status, 201);
  assert.equal((await res.json()).photo_saved, false);
});

test('stats count non-rejected reports by status', async () => {
  const base = await start();
  const a = report(), b = report();
  await fetch(`${base}/api/reports`, json(a));
  await fetch(`${base}/api/reports`, json(b));
  await internal(base, `/api/reports/${b.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'resolved' }) });
  const st = await (await fetch(`${base}/api/stats`)).json();
  assert.deepEqual([st.total, st.open, st.resolved], [2, 1, 1]);
  assert.ok(st.last_updated);
});

test('CSV export has no private fields, neutralizes formulas and keeps negative numbers', async () => {
  const base = await start();
  await fetch(`${base}/api/reports`, json(report({ description: '=HYPERLINK("x")', contact_email: 'resident@example.org' })));
  const res = await fetch(`${base}/api/export?format=csv`);
  assert.match(res.headers.get('content-type'), /text\/csv/);
  const csv = await res.text();
  assert.match(csv.split('\n')[0], /public_lat/);
  assert.doesNotMatch(csv, /precise|37\.871234|example\.org/);
  assert.match(csv, /"'=HYPERLINK\(""x""\)"/);
  assert.match(csv, /"-122\.26"/);
});

test('CORS allows only the configured frontend origin', async () => {
  const base = await start({ frontendOrigins: ['https://tapcheck.example'] });
  const ok = await fetch(`${base}/api/reports`, { method: 'OPTIONS', headers: { origin: 'https://tapcheck.example', 'access-control-request-method': 'POST' } });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://tapcheck.example');
  const bad = await fetch(`${base}/api/reports`, { headers: { origin: 'https://evil.example' } });
  assert.equal(bad.headers.get('access-control-allow-origin'), null);
});
