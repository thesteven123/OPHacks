const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createServer } = require('./server');

let server, base;
const TOKEN = 'test-mod-token';

before(async () => {
  server = createServer({ modToken: TOKEN, dailyLimit: 3 });
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

const post = (body) =>
  fetch(`${base}/api/reports`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const report = (extra = {}) => ({ id: crypto.randomUUID(), issue_type: 'odor', lat: 37.871234, lng: -122.259876, description: 'smells', ...extra });

test('public view hides precise location and rejected reports; retries do not duplicate', async () => {
  const r = report();
  assert.equal((await post(r)).status, 201);
  assert.deepEqual(await (await post(r)).json(), { id: r.id, duplicate: true });

  const [pub] = await (await fetch(`${base}/api/reports`)).json();
  assert.equal(pub.id, r.id);
  assert.equal(pub.precise_lat, undefined);
  assert.equal(pub.public_lat, 37.872);
  assert.equal(pub.public_lng, -122.26);

  const patch = await fetch(`${base}/api/mod/reports/${r.id}`, {
    method: 'PATCH', headers: { authorization: `Bearer ${TOKEN}` }, body: JSON.stringify({ status: 'rejected', note: 'spam' }),
  });
  assert.equal(patch.status, 200);
  assert.equal((await (await fetch(`${base}/api/reports`)).json()).length, 0);
  assert.equal((await (await fetch(`${base}/api/export.geojson`)).json()).features.length, 0);
});

test('moderator routes require the token', async () => {
  assert.equal((await fetch(`${base}/api/mod/reports`)).status, 401);
  assert.equal((await fetch(`${base}/api/mod/reports`, { headers: { authorization: 'Bearer wrong-token-xx' } })).status, 401);
  assert.equal((await fetch(`${base}/api/mod/reports`, { headers: { authorization: `Bearer ${TOKEN}` } })).status, 200);
});

test('rejects invalid input and enforces the daily limit', async () => {
  assert.equal((await post(report({ issue_type: 'fire' }))).status, 400);
  assert.equal((await post(report({ lat: 200 }))).status, 400);
  assert.equal((await post(report({ id: 'nope' }))).status, 400);
  const codes = [];
  for (let i = 0; i < 3; i++) codes.push((await post(report())).status);
  assert.deepEqual(codes, [201, 201, 429]);
});

test('CSV export excludes precise coordinates', async () => {
  const csv = await (await fetch(`${base}/api/export.csv`)).text();
  assert.match(csv.split('\n')[0], /public_lat/);
  assert.doesNotMatch(csv, /precise|37\.871234/);
});

test('CSV export neutralizes spreadsheet formulas', async () => {
  const s = createServer({ dailyLimit: 5 });
  await new Promise((r) => s.listen(0, r));
  const url = `http://localhost:${s.address().port}`;
  await fetch(`${url}/api/reports`, { method: 'POST', body: JSON.stringify(report({ description: '=HYPERLINK("x")' })) });
  const csv = await (await fetch(`${url}/api/export.csv`)).text();
  s.close();
  assert.match(csv, /"'=HYPERLINK\(""x""\)"/);
});
