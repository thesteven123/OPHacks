const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { openDb, coarse, ISSUE_TYPES, STATUSES, DURATIONS, USABLE } = require('./db');
const { verifyPassword, safeEqual } = require('./auth');
const { decodeJpegDataUrl } = require('./photo');

const APP_DIR = path.join(__dirname, '..', 'app');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg' };
const PUBLIC_COLS = 'id, created_at, issue_type, description, severity, duration, water_usable, has_photo, public_lat, public_lng, status';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY = 2 * 1024 * 1024;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES = 5;

function createServer({
  db = openDb(),
  photoDir = process.env.PHOTO_DIR || fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'tapcheck-photos-')),
  salt = process.env.RATE_SALT || crypto.randomBytes(16).toString('hex'),
  dailyLimit = Number(process.env.DAILY_LIMIT || 5),
  modEmail = process.env.MOD_EMAIL,
  modPasswordHash = process.env.MOD_PASSWORD_HASH,
  sessionTtlMs = 8 * 60 * 60 * 1000,
} = {}) {
  fs.mkdirSync(photoDir, { recursive: true });
  const sessions = new Map();
  const loginFailures = new Map();

  const send = (res, code, body, type = 'application/json') => {
    res.writeHead(code, { 'content-type': type, 'x-content-type-options': 'nosniff' });
    res.end(type === 'application/json' ? JSON.stringify(body) : body);
  };

  const readJson = (req) =>
    new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      req.on('data', (c) => {
        size += c.length;
        if (size > MAX_BODY) { reject(new Error('too large')); req.destroy(); } else chunks.push(c);
      });
      req.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch (e) { reject(e); }
      });
    });

  const isModerator = (req) => {
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    const expires = sessions.get(token);
    if (expires && expires > Date.now()) return true;
    sessions.delete(token);
    return false;
  };

  const publicReports = () =>
    db.prepare(`SELECT ${PUBLIC_COLS} FROM reports WHERE status != 'rejected' ORDER BY created_at DESC`).all();

  async function createReport(req, res) {
    const b = await readJson(req);
    const lat = Number(b.lat), lng = Number(b.lng), severity = Number(b.severity);
    const email = String(b.contact_email || '').trim();
    if (typeof b.id !== 'string' || !UUID.test(b.id)) return send(res, 400, { error: 'id must be a UUID' });
    if (!ISSUE_TYPES.includes(b.issue_type)) return send(res, 400, { error: 'invalid issue_type' });
    if (![1, 2, 3].includes(severity)) return send(res, 400, { error: 'severity must be 1, 2 or 3' });
    if (!DURATIONS.includes(b.duration)) return send(res, 400, { error: 'invalid duration' });
    if (!USABLE.includes(b.water_usable)) return send(res, 400, { error: 'invalid water_usable' });
    if (email && (email.length > 254 || !EMAIL.test(email))) return send(res, 400, { error: 'invalid contact_email' });
    if (!(Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return send(res, 400, { error: 'invalid location' });
    const photo = b.photo ? decodeJpegDataUrl(b.photo) : null;
    if (b.photo && !photo) return send(res, 400, { error: 'photo must be a JPEG data URL' });

    b.id = b.id.toLowerCase();
    if (db.prepare('SELECT 1 FROM reports WHERE id = ?').get(b.id)) return send(res, 200, { id: b.id, duplicate: true });

    const hash = crypto.createHash('sha256').update(`${salt}|${req.socket.remoteAddress}|${req.headers['user-agent'] || ''}`).digest('hex');
    const since = new Date(Date.now() - 864e5).toISOString();
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM reports WHERE submitter_hash = ? AND created_at > ?').get(hash, since);
    if (n >= dailyLimit && !isModerator(req)) return send(res, 429, { error: 'daily report limit reached', remaining: 0 });

    if (photo) fs.writeFileSync(path.join(photoDir, `${b.id.toLowerCase()}.jpg`), photo);
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO reports (id, created_at, issue_type, description, severity, duration, water_usable, contact_email, has_photo,
                precise_lat, precise_lng, public_lat, public_lng, submitter_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(b.id.toLowerCase(), now, b.issue_type, String(b.description || '').slice(0, 280), severity, b.duration, b.water_usable,
        email, photo ? 1 : 0, lat, lng, coarse(lat), coarse(lng), hash);
    db.prepare('INSERT INTO status_history (report_id, status, changed_at) VALUES (?, ?, ?)').run(b.id.toLowerCase(), 'open', now);
    send(res, 201, { id: b.id.toLowerCase(), remaining: Math.max(0, dailyLimit - n - 1) });
  }

  async function login(req, res) {
    const ip = req.socket.remoteAddress;
    const recent = (loginFailures.get(ip) || []).filter((t) => t > Date.now() - LOGIN_WINDOW_MS);
    if (recent.length >= MAX_LOGIN_FAILURES) return send(res, 429, { error: 'too many failed logins, try again later' });
    const b = await readJson(req);
    if (!modEmail || !modPasswordHash || !safeEqual(String(b.email || '').toLowerCase(), modEmail.toLowerCase()) || !verifyPassword(b.password, modPasswordHash)) {
      loginFailures.set(ip, [...recent, Date.now()]);
      return send(res, 401, { error: 'wrong email or password' });
    }
    loginFailures.delete(ip);
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, Date.now() + sessionTtlMs);
    send(res, 200, { token, expires_in: sessionTtlMs / 1000 });
  }

  async function updateStatus(req, res, id) {
    const b = await readJson(req);
    if (!STATUSES.includes(b.status)) return send(res, 400, { error: 'invalid status' });
    const note = String(b.note || '').slice(0, 500);
    const { changes } = db.prepare('UPDATE reports SET status = ?, moderator_note = ? WHERE id = ?').run(b.status, note, id);
    if (!changes) return send(res, 404, { error: 'not found' });
    db.prepare('INSERT INTO status_history (report_id, status, note, changed_at) VALUES (?, ?, ?, ?)').run(id, b.status, note, new Date().toISOString());
    send(res, 200, { id, status: b.status });
  }

  function stats(res) {
    const counts = Object.fromEntries(STATUSES.filter((s) => s !== 'rejected').map((s) => [s, 0]));
    for (const { status, n } of db.prepare("SELECT status, COUNT(*) AS n FROM reports WHERE status != 'rejected' GROUP BY status").all()) counts[status] = n;
    const { last } = db.prepare('SELECT MAX(changed_at) AS last FROM status_history').get();
    send(res, 200, { total: Object.values(counts).reduce((a, b) => a + b, 0), ...counts, last_updated: last });
  }

  function exportCsv(res) {
    const cols = ['id', 'created_at', 'issue_type', 'description', 'severity', 'duration', 'water_usable', 'public_lat', 'public_lng', 'status'];
    const esc = (v) => `"${(typeof v === 'number' ? String(v) : String(v).replace(/^[=+\-@]/, "'$&")).replace(/"/g, '""')}"`;
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

  function servePhoto(req, res, id) {
    const row = db.prepare('SELECT status, has_photo FROM reports WHERE id = ?').get(id);
    if (!row?.has_photo || (row.status === 'rejected' && !isModerator(req))) return send(res, 404, { error: 'not found' });
    send(res, 200, fs.readFileSync(path.join(photoDir, `${id}.jpg`)), 'image/jpeg');
  }

  function serveStatic(res, urlPath) {
    const file = path.normalize(path.join(APP_DIR, urlPath === '/' ? 'index.html' : urlPath));
    if (!file.startsWith(APP_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, { error: 'not found' });
    send(res, 200, fs.readFileSync(file), MIME[path.extname(file)] || 'application/octet-stream');
  }

  return http.createServer(async (req, res) => {
    const { pathname } = new URL(req.url, 'http://x');
    const modMatch = pathname.match(/^\/api\/mod\/reports\/([0-9a-f-]{36})$/i);
    const photoMatch = pathname.match(/^\/photos\/([0-9a-f-]{36})\.jpg$/i);
    try {
      if (req.method === 'POST' && pathname === '/api/reports') return await createReport(req, res);
      if (req.method === 'GET' && pathname === '/api/reports') return send(res, 200, publicReports());
      if (req.method === 'GET' && pathname === '/api/stats') return stats(res);
      if (req.method === 'GET' && pathname === '/api/export.csv') return exportCsv(res);
      if (req.method === 'GET' && pathname === '/api/export.geojson') return exportGeoJson(res);
      if (req.method === 'POST' && pathname === '/api/mod/login') return await login(req, res);
      if (req.method === 'GET' && photoMatch) return servePhoto(req, res, photoMatch[1].toLowerCase());
      if (pathname.startsWith('/api/mod/') && !isModerator(req)) return send(res, 401, { error: 'moderator login required' });
      if (req.method === 'GET' && pathname === '/api/mod/reports')
        return send(res, 200, db.prepare('SELECT * FROM reports ORDER BY created_at DESC').all().map(({ submitter_hash, ...r }) => r));
      if (req.method === 'PATCH' && modMatch) return await updateStatus(req, res, modMatch[1].toLowerCase());
      if (req.method === 'GET' && !pathname.startsWith('/api/')) return serveStatic(res, pathname);
      send(res, 404, { error: 'not found' });
    } catch {
      if (!res.headersSent) send(res, 400, { error: 'bad request' });
    }
  });
}

if (require.main === module) {
  if (!process.env.MOD_EMAIL || !process.env.MOD_PASSWORD_HASH) console.warn('MOD_EMAIL or MOD_PASSWORD_HASH is not set: moderator login is disabled.');
  if (!process.env.PHOTO_DIR) console.warn('PHOTO_DIR is not set: photos go to a temp folder and are lost on restart.');
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port, () => console.log(`TapCheck on http://localhost:${port}`));
}

module.exports = { createServer };
