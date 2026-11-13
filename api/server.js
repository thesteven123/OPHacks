const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { openDb, coarse, ISSUE_TYPES, STATUSES } = require('./db');

const APP_DIR = path.join(__dirname, '..', 'app');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const PUBLIC_COLS = 'id, created_at, issue_type, description, public_lat, public_lng, status, moderator_note';

function createServer({
  db = openDb(),
  modToken = process.env.MOD_TOKEN,
  salt = process.env.RATE_SALT || crypto.randomBytes(16).toString('hex'),
  dailyLimit = Number(process.env.DAILY_LIMIT || 5),
} = {}) {
  const send = (res, code, body, type = 'application/json') => {
    res.writeHead(code, { 'content-type': type });
    res.end(type === 'application/json' ? JSON.stringify(body) : body);
  };

  const readJson = (req) =>
    new Promise((resolve, reject) => {
      let raw = '';
      req.on('data', (c) => {
        raw += c;
        if (raw.length > 1e5) reject(new Error('too large'));
      });
      req.on('end', () => {
        try { resolve(JSON.parse(raw || '{}')); } catch (e) { reject(e); }
      });
    });

  const isModerator = (req) => {
    const given = Buffer.from((req.headers.authorization || '').replace(/^Bearer /, ''));
    const want = Buffer.from(modToken || '');
    return modToken && given.length === want.length && crypto.timingSafeEqual(given, want);
  };

  const publicReports = () =>
    db.prepare(`SELECT ${PUBLIC_COLS} FROM reports WHERE status != 'rejected' ORDER BY created_at DESC`).all();

  async function createReport(req, res) {
    const b = await readJson(req);
    const lat = Number(b.lat), lng = Number(b.lng);
    if (typeof b.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(b.id)) return send(res, 400, { error: 'id must be a UUID' });
    if (!ISSUE_TYPES.includes(b.issue_type)) return send(res, 400, { error: 'invalid issue_type' });
    if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return send(res, 400, { error: 'invalid location' });
    const description = String(b.description || '').slice(0, 280);

    if (db.prepare('SELECT 1 FROM reports WHERE id = ?').get(b.id)) return send(res, 200, { id: b.id, duplicate: true });

    const hash = crypto.createHash('sha256').update(salt + req.socket.remoteAddress).digest('hex');
    const since = new Date(Date.now() - 864e5).toISOString();
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM reports WHERE submitter_hash = ? AND created_at > ?').get(hash, since);
    if (n >= dailyLimit) return send(res, 429, { error: 'daily report limit reached' });

    const now = new Date().toISOString();
    db.prepare(`INSERT INTO reports (id, created_at, issue_type, description, precise_lat, precise_lng, public_lat, public_lng, submitter_hash)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(b.id, now, b.issue_type, description, lat, lng, coarse(lat), coarse(lng), hash);
    db.prepare('INSERT INTO status_history (report_id, status, changed_at) VALUES (?, ?, ?)').run(b.id, 'open', now);
    send(res, 201, { id: b.id });
  }

  async function updateStatus(req, res, id) {
    const b = await readJson(req);
    if (!STATUSES.includes(b.status)) return send(res, 400, { error: 'invalid status' });
    const note = String(b.note || '').slice(0, 500);
    const now = new Date().toISOString();
    const { changes } = db.prepare('UPDATE reports SET status = ?, moderator_note = ? WHERE id = ?').run(b.status, note, id);
    if (!changes) return send(res, 404, { error: 'not found' });
    db.prepare('INSERT INTO status_history (report_id, status, note, changed_at) VALUES (?, ?, ?, ?)').run(id, b.status, note, now);
    send(res, 200, { id, status: b.status });
  }

  function exportCsv(res) {
    const cols = ['id', 'created_at', 'issue_type', 'description', 'public_lat', 'public_lng', 'status', 'moderator_note'];
    const esc = (v) => `"${String(v).replace(/^[=+\-@]/, "'$&").replace(/"/g, '""')}"`;
    const rows = publicReports().map((r) => cols.map((c) => esc(r[c])).join(','));
    send(res, 200, [cols.join(','), ...rows].join('\n'), 'text/csv');
  }

  function exportGeoJson(res) {
    send(res, 200, {
      type: 'FeatureCollection',
      features: publicReports().map(({ public_lat, public_lng, ...props }) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [public_lng, public_lat] },
        properties: props,
      })),
    });
  }

  function serveStatic(res, urlPath) {
    const file = path.normalize(path.join(APP_DIR, urlPath === '/' ? 'index.html' : urlPath));
    if (!file.startsWith(APP_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, { error: 'not found' });
    send(res, 200, fs.readFileSync(file), MIME[path.extname(file)] || 'application/octet-stream');
  }

  return http.createServer(async (req, res) => {
    const { pathname } = new URL(req.url, 'http://x');
    const modMatch = pathname.match(/^\/api\/mod\/reports\/([0-9a-f-]{36})$/i);
    try {
      if (req.method === 'POST' && pathname === '/api/reports') return await createReport(req, res);
      if (req.method === 'GET' && pathname === '/api/reports') return send(res, 200, publicReports());
      if (req.method === 'GET' && pathname === '/api/export.csv') return exportCsv(res);
      if (req.method === 'GET' && pathname === '/api/export.geojson') return exportGeoJson(res);
      if (pathname.startsWith('/api/mod/') && !isModerator(req)) return send(res, 401, { error: 'moderator token required' });
      if (req.method === 'GET' && pathname === '/api/mod/reports')
        return send(res, 200, db.prepare('SELECT * FROM reports ORDER BY created_at DESC').all().map(({ submitter_hash, ...r }) => r));
      if (req.method === 'PATCH' && modMatch) return await updateStatus(req, res, modMatch[1]);
      if (req.method === 'GET' && !pathname.startsWith('/api/')) return serveStatic(res, pathname);
      send(res, 404, { error: 'not found' });
    } catch {
      send(res, 400, { error: 'bad request' });
    }
  });
}

if (require.main === module) {
  if (!process.env.MOD_TOKEN) console.warn('MOD_TOKEN is not set: moderator routes are disabled.');
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port, () => console.log(`TapCheck on http://localhost:${port}`));
}

module.exports = { createServer };
