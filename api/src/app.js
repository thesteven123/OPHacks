const crypto = require('node:crypto');
const express = require('express');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const { decodeJpegDataUrl } = require('./photo');

const ISSUE_TYPES = ['discoloration', 'odor', 'outage', 'broken_infrastructure', 'sanitation_gap', 'other'];
const STATUSES = ['open', 'verified', 'forwarded', 'rejected', 'resolved'];
const DURATIONS = ['today', 'few_days', 'week_plus'];
const USABLE = ['yes', 'no', 'unsure'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GRID = 0.001;
const DAY_MS = 864e5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES = 5;
const MAX_LOGIN_TRACKED = 1000;
const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 256;
const PUBLIC_LIST_LIMIT = 1000;

const coarse = (v) => Math.round(Math.round(v / GRID) * GRID * 1e6) / 1e6;
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

function createApp({
  prisma,
  photos = null,
  apiKey = process.env.INTERNAL_API_KEY,
  frontendOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:3000').split(','),
  salt = process.env.RATE_SALT || crypto.randomBytes(16).toString('hex'),
  dailyLimit = Number(process.env.DAILY_LIMIT || 5),
  perMinuteLimit = Number(process.env.PER_MINUTE_LIMIT || 10),
  loginPerMinuteLimit = Number(process.env.LOGIN_PER_MINUTE_LIMIT || 30),
} = {}) {
  const app = express();
  const loginFailures = new Map();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));

  const isInternal = (req) => Boolean(apiKey) && safeEqual(req.get('x-api-key') || '', apiKey);
  const requireInternal = (req, res, next) => (isInternal(req) ? next() : res.status(401).json({ error: 'unauthorized' }));
  const photoUrl = (r) => (r.photo_public_id && photos ? photos.url(r.photo_public_id) : null);

  const toPublic = (r) => ({
    id: r.id, created_at: r.created_at, issue_type: r.issue_type, description: r.description, severity: r.severity,
    duration: r.duration, water_usable: r.water_usable, public_lat: r.public_lat, public_lng: r.public_lng, status: r.status,
    has_photo: Boolean(r.photo_public_id), photo_url: photoUrl(r),
  });
  const toModerator = ({ submitter_hash, history, ...r }) => ({ ...r, has_photo: Boolean(r.photo_public_id), photo_url: photoUrl(r), history });
  const publicReports = async () =>
    (await prisma.report.findMany({ where: { status: { not: 'rejected' } }, orderBy: { created_at: 'desc' }, take: PUBLIC_LIST_LIMIT })).map(toPublic);

  const pub = cors({ origin: frontendOrigins });
  const perMinute = rateLimit({ windowMs: 60_000, limit: perMinuteLimit, standardHeaders: 'draft-8', legacyHeaders: false, skip: isInternal,
    message: { error: 'too many requests, slow down' } });

  // Not skipped for internal callers: every valid /api/auth/verify request is internal. The API sees the shared Next.js
  // origin IP, so this is one deliberate cap for all moderator logins combined, not a per-user limit.
  const loginPerMinute = rateLimit({ windowMs: 60_000, limit: loginPerMinuteLimit, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'too many login attempts, slow down' } });

  const recentFailures = (email, now) => (loginFailures.get(email) || []).filter((t) => t > now - LOGIN_WINDOW_MS);
  const recordLoginFailure = (email, recent, now) => {
    for (const [key, times] of loginFailures) if (!times.some((t) => t > now - LOGIN_WINDOW_MS)) loginFailures.delete(key);
    loginFailures.delete(email);
    loginFailures.set(email, [...recent, now]);
    while (loginFailures.size > MAX_LOGIN_TRACKED) loginFailures.delete(loginFailures.keys().next().value);
  };

  app.get('/health', (req, res) => res.json({ ok: true }));
  app.options('/api/reports', pub);

  app.post('/api/reports', pub, perMinute, async (req, res) => {
    const b = req.body || {};
    const lat = b.lat, lng = b.lng, severity = Number(b.severity);
    const email = String(b.contact_email || '').trim();
    if (typeof b.id !== 'string' || !UUID.test(b.id)) return res.status(400).json({ error: 'id must be a UUID' });
    if (!ISSUE_TYPES.includes(b.issue_type)) return res.status(400).json({ error: 'invalid issue_type' });
    if (![1, 2, 3].includes(severity)) return res.status(400).json({ error: 'severity must be 1, 2 or 3' });
    if (!DURATIONS.includes(b.duration)) return res.status(400).json({ error: 'invalid duration' });
    if (!USABLE.includes(b.water_usable)) return res.status(400).json({ error: 'invalid water_usable' });
    if (email && (email.length > 254 || !EMAIL.test(email))) return res.status(400).json({ error: 'invalid contact_email' });
    if (!(typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return res.status(400).json({ error: 'invalid location' });
    const jpeg = b.photo ? decodeJpegDataUrl(b.photo) : null;
    if (b.photo && !jpeg) return res.status(400).json({ error: 'photo must be a JPEG data URL' });

    const id = b.id.toLowerCase();
    if (await prisma.report.findUnique({ where: { id }, select: { id: true } })) return res.json({ id, duplicate: true });

    const submitter_hash = crypto.createHash('sha256').update(`${salt}|${req.ip}|${req.get('user-agent') || ''}`).digest('hex');
    const used = await prisma.report.count({ where: { submitter_hash, created_at: { gt: new Date(Date.now() - DAY_MS) } } });
    if (used >= dailyLimit && !isInternal(req)) return res.status(429).json({ error: 'daily report limit reached', remaining: 0 });

    const photo_public_id = jpeg && photos ? await photos.upload(jpeg, id) : null;
    try {
      await prisma.report.create({
        data: {
          id, issue_type: b.issue_type, description: String(b.description || '').slice(0, 280), severity, duration: b.duration,
          water_usable: b.water_usable, contact_email: email, photo_public_id, precise_lat: lat, precise_lng: lng,
          public_lat: coarse(lat), public_lng: coarse(lng), submitter_hash, history: { create: { status: 'open' } },
        },
      });
    } catch (e) {
      if (e.code === 'P2002') return res.json({ id, duplicate: true });
      throw e;
    }
    res.status(201).json({ id, remaining: Math.max(0, dailyLimit - used - 1), photo_saved: Boolean(photo_public_id) });
  });

  app.get('/api/reports', pub, async (req, res) => res.json(await publicReports()));

  app.get('/api/stats', pub, async (req, res) => {
    const counts = Object.fromEntries(STATUSES.filter((s) => s !== 'rejected').map((s) => [s, 0]));
    for (const g of await prisma.report.groupBy({ by: ['status'], where: { status: { not: 'rejected' } }, _count: { _all: true } })) counts[g.status] = g._count._all;
    const last = await prisma.statusChange.aggregate({ _max: { changed_at: true } });
    res.json({ total: Object.values(counts).reduce((a, n) => a + n, 0), ...counts, last_updated: last._max.changed_at });
  });

  app.get('/api/export', pub, async (req, res) => {
    const rows = (await publicReports()).map(({ photo_url, has_photo, ...r }) => ({ ...r, created_at: r.created_at.toISOString() }));
    if (req.query.format === 'geojson') {
      return res.type('application/geo+json').json({
        type: 'FeatureCollection',
        features: rows.map(({ public_lat, public_lng, ...props }) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [public_lng, public_lat] }, properties: props })),
      });
    }
    const cols = ['id', 'created_at', 'issue_type', 'description', 'severity', 'duration', 'water_usable', 'public_lat', 'public_lng', 'status'];
    const esc = (v) => `"${(typeof v === 'number' ? String(v) : String(v).replace(/^[=+\-@]/, "'$&")).replace(/"/g, '""')}"`;
    res.type('text/csv').attachment('tapcheck-reports.csv').send([cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n'));
  });

  // Server-to-server only: the Next.js app calls these with INTERNAL_API_KEY after checking the moderator session.
  app.post('/api/auth/verify', requireInternal, loginPerMinute, async (req, res) => {
    const { email: rawEmail, password } = req.body || {};
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL.test(email)) return res.status(400).json({ error: 'invalid email' });
    if (typeof password !== 'string' || password.length > MAX_PASSWORD_LENGTH) return res.status(400).json({ error: 'invalid password' });
    const now = Date.now();
    const recent = recentFailures(email, now);
    if (recent.length >= MAX_LOGIN_FAILURES) return res.status(429).json({ error: 'too many failed logins, try again later' });
    const mod = await prisma.moderator.findUnique({ where: { email } });
    if (!mod || !(await bcrypt.compare(password, mod.password_hash))) {
      recordLoginFailure(email, recent, now);
      return res.status(401).json({ error: 'wrong email or password' });
    }
    loginFailures.delete(email);
    res.json({ id: String(mod.id), email: mod.email });
  });

  app.get('/api/mod/reports', requireInternal, async (req, res) =>
    res.json((await prisma.report.findMany({ orderBy: { created_at: 'desc' }, include: { history: { orderBy: { changed_at: 'asc' } } } })).map(toModerator)));

  app.get('/api/reports/:id', requireInternal, async (req, res) => {
    const r = UUID.test(req.params.id) && (await prisma.report.findUnique({ where: { id: req.params.id.toLowerCase() }, include: { history: { orderBy: { changed_at: 'asc' } } } }));
    return r ? res.json(toModerator(r)) : res.status(404).json({ error: 'not found' });
  });

  app.patch('/api/reports/:id', requireInternal, async (req, res) => {
    const { status } = req.body || {};
    const note = String(req.body?.note || '').slice(0, 500);
    if (!STATUSES.includes(status)) return res.status(400).json({ error: 'invalid status' });
    const id = req.params.id.toLowerCase();
    if (!UUID.test(id) || !(await prisma.report.findUnique({ where: { id }, select: { id: true } }))) return res.status(404).json({ error: 'not found' });
    await prisma.report.update({ where: { id }, data: { status, moderator_note: note, history: { create: { status, note } } } });
    res.json({ id, status });
  });

  app.use((req, res) => res.status(404).json({ error: 'not found' }));
  app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'request too large' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid JSON' });
    console.error(err);
    res.status(500).json({ error: 'server error' });
  });
  return app;
}

module.exports = { createApp, coarse };
