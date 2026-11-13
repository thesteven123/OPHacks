const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createServer } = require('./server');
const { hashPassword } = require('./auth');
const { stripJpegMetadata } = require('./photo');

const EMAIL = 'mod@example.org';
const PASSWORD = 'correct horse battery';
const HASH = hashPassword(PASSWORD);

async function start(opts = {}) {
  const server = createServer({ modEmail: EMAIL, modPasswordHash: HASH, dailyLimit: 3, ...opts });
  await new Promise((r) => server.listen(0, r));
  return { server, base: `http://localhost:${server.address().port}` };
}

let server, base, token;
before(async () => {
  ({ server, base } = await start());
  token = (await (await fetch(`${base}/api/mod/login`, { method: 'POST', body: JSON.stringify({ email: EMAIL, password: PASSWORD }) })).json()).token;
});
after(() => server.close());

const post = (b, body) => fetch(`${b}/api/reports`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const report = (extra = {}) => ({
  id: crypto.randomUUID(), issue_type: 'odor', severity: 2, duration: 'today', water_usable: 'unsure',
  lat: 37.871234, lng: -122.259876, description: 'smells', ...extra,
});
const mod = (path, opts = {}) => fetch(`${base}${path}`, { ...opts, headers: { authorization: `Bearer ${token}` } });

// FFD8, APP0 JFIF, APP1 Exif with GPS text, COM, DQT, SOS + data, EOI
const segment = (marker, payload) => Buffer.concat([Buffer.from([0xff, marker]), Buffer.from([0, payload.length + 2]), payload]);
const fakeJpeg = Buffer.concat([
  Buffer.from([0xff, 0xd8]),
  segment(0xe0, Buffer.from('JFIF\0')),
  segment(0xe1, Buffer.from('Exif\0\0GPSLatitude 37.871234')),
  segment(0xfe, Buffer.from('camera serial 123')),
  segment(0xdb, Buffer.alloc(5, 1)),
  Buffer.from([0xff, 0xda, 0, 4, 9, 9, 0xab, 0xcd, 0xff, 0xd9]),
]);

test('public view hides precise location, contact email and internal notes; retries do not duplicate', async () => {
  const r = report({ contact_email: 'resident@example.org' });
  assert.equal((await post(base, r)).status, 201);
  assert.deepEqual(await (await post(base, r)).json(), { id: r.id, duplicate: true });

  await mod(`/api/mod/reports/${r.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'verified', note: 'called utility' }) });
  const pub = (await (await fetch(`${base}/api/reports`)).json()).find((x) => x.id === r.id);
  assert.equal(pub.status, 'verified');
  assert.equal(pub.public_lat, 37.871);
  assert.equal(pub.public_lng, -122.26);
  for (const hidden of ['precise_lat', 'precise_lng', 'contact_email', 'moderator_note', 'submitter_hash']) assert.equal(pub[hidden], undefined, hidden);

  const [full] = (await (await mod('/api/mod/reports')).json()).filter((x) => x.id === r.id);
  assert.equal(full.precise_lat, 37.871234);
  assert.equal(full.contact_email, 'resident@example.org');
  assert.equal(full.submitter_hash, undefined);

  await mod(`/api/mod/reports/${r.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'rejected' }) });
  assert.equal((await (await fetch(`${base}/api/reports`)).json()).some((x) => x.id === r.id), false);
  assert.equal((await (await fetch(`${base}/api/export.geojson`)).json()).features.some((f) => f.properties.id === r.id), false);
});

test('moderator login: wrong password rejected, brute force locked out, session required', async () => {
  const { server: s, base: b } = await start();
  const tryLogin = (password) => fetch(`${b}/api/mod/login`, { method: 'POST', body: JSON.stringify({ email: EMAIL, password }) });
  assert.equal((await fetch(`${b}/api/mod/reports`)).status, 401);
  assert.equal((await fetch(`${b}/api/mod/reports`, { headers: { authorization: 'Bearer made-up' } })).status, 401);
  const codes = [];
  for (let i = 0; i < 6; i++) codes.push((await tryLogin('wrong')).status);
  assert.deepEqual(codes, [401, 401, 401, 401, 401, 429]);
  assert.equal((await tryLogin(PASSWORD)).status, 429);
  s.close();
  assert.equal((await mod('/api/mod/reports')).status, 200);
});

test('rejects invalid input and enforces the daily limit with a remaining count', async () => {
  const { server: s, base: b } = await start();
  for (const bad of [{ issue_type: 'fire' }, { lat: 200 }, { id: 'nope' }, { severity: 5 }, { duration: 'x' }, { water_usable: 'x' }, { contact_email: 'nope' }, { photo: 'data:image/png;base64,AAAA' }])
    assert.equal((await post(b, report(bad))).status, 400, JSON.stringify(bad));
  const results = [];
  for (let i = 0; i < 4; i++) {
    const res = await post(b, report());
    results.push([res.status, (await res.json()).remaining]);
  }
  assert.deepEqual(results, [[201, 2], [201, 1], [201, 0], [429, 0]]);
  s.close();
});

test('photo metadata is stripped before storage; rejected photos are hidden from the public', async () => {
  assert.equal(stripJpegMetadata(Buffer.from('not a jpeg')), null);
  const r = report({ photo: `data:image/jpeg;base64,${fakeJpeg.toString('base64')}` });
  assert.equal((await post(base, r)).status, 201);
  const stored = Buffer.from(await (await fetch(`${base}/photos/${r.id}.jpg`)).arrayBuffer());
  assert.equal(stored.includes('GPSLatitude'), false);
  assert.equal(stored.includes('camera serial'), false);
  assert.equal(stored.includes('JFIF'), true);
  assert.deepEqual([...stored.subarray(-2)], [0xff, 0xd9]);

  await mod(`/api/mod/reports/${r.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'rejected' }) });
  assert.equal((await fetch(`${base}/photos/${r.id}.jpg`)).status, 404);
  assert.equal((await mod(`/photos/${r.id}.jpg`)).status, 200);
});

test('stats count non-rejected reports by status', async () => {
  const { server: s, base: b } = await start();
  await post(b, report());
  const st = await (await fetch(`${b}/api/stats`)).json();
  assert.equal(st.total, 1);
  assert.equal(st.open, 1);
  assert.equal(st.resolved, 0);
  assert.ok(st.last_updated);
  s.close();
});

test('CSV export has no precise coordinates and neutralizes formulas', async () => {
  await post(base, report({ description: '=HYPERLINK("x")', severity: 3 }));
  const csv = await (await fetch(`${base}/api/export.csv`)).text();
  assert.match(csv.split('\n')[0], /public_lat/);
  assert.doesNotMatch(csv, /precise|37\.871234|example\.org/);
  assert.match(csv, /"'=HYPERLINK\(""x""\)"/);
  assert.match(csv, /"-122\.26"/);
  assert.doesNotMatch(csv, /"'-122/);
});
