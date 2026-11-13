# TapCheck MVP draft: build notes

Owner: Executive Coder. A runnable build of every feature in `docs/MVP.md`, for design, security and change review. Not production-ready.

> **Stack note:** `docs/PLAN.md` proposes Next.js + Express + Postgres/Prisma + Cloudinary on Vercel + Railway. This draft does the same features with zero dependencies (Node + built-in SQLite + disk photos) so it runs with no accounts or API keys, and deploys as one process (hosting option A below). The API maps one-to-one onto the planned routes if the team decides to port it.

## Run it
Needs Node 22.5 or later (it uses the built-in `node:sqlite`). No npm install is needed.

```bash
export MOD_EMAIL=mod@example.org
export MOD_PASSWORD_HASH="$(npm run -s hash-password -- 'choose-a-long-password')"
DB_FILE=tapcheck.db PHOTO_DIR=photos npm start   # http://localhost:3000, moderators at /mod.html
npm test
```

| Env var | Default | Purpose |
|---|---|---|
| `PORT` | 3000 | HTTP port |
| `DB_FILE` | `:memory:` | SQLite file; set it so data survives restarts |
| `PHOTO_DIR` | temp folder | Where stripped photos are stored; set it so photos survive restarts |
| `MOD_EMAIL`, `MOD_PASSWORD_HASH` | unset | Shared moderator login (scrypt hash from `npm run hash-password`); login is disabled when unset |
| `RATE_SALT` | random per boot | Salt for the hashed IP + User-Agent used by the rate limit |
| `DAILY_LIMIT` | 5 | Reports per device per 24 h (Security Reviewer's value) |

## Layout
```
api/db.js           schema, enums, coarse-location rounding (0.001° ≈ 110 m)
api/auth.js         scrypt password hashing + `npm run hash-password`
api/photo.js        JPEG metadata stripping (removes EXIF/GPS, XMP, IPTC, comments)
api/server.js       HTTP API + static file server (no dependencies)
api/server.test.js  node:test behavior tests
app/index.html      report form: 3 quick questions, GPS or pin drop, photo, private email, disclaimer
app/queue.js        offline queue (localStorage, client UUID makes retries idempotent; drops the photo if storage is full)
app/sw.js           service worker: app pages load offline; API and photos are never cached
app/map.html        public map: clustered markers, type and age filters (default 7 days), photo thumbnails, export links
app/dashboard.html  public status: total, open, in progress, resolved, last updated
app/mod.html        moderator login + triage queue (sort, verify / forward / resolve / spam, internal note)
```

## API
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/reports` | none | `{id (uuid), issue_type, severity 1-3, duration, water_usable, lat, lng, description?, contact_email?, photo? (JPEG data URL)}`; 201 new with `remaining`, 200 duplicate, 429 over limit |
| GET | `/api/reports` | none | Non-rejected reports; coarse location only; no email, note or exact GPS |
| GET | `/api/stats` | none | Counts by status + last update |
| GET | `/api/export.csv`, `/api/export.geojson` | none | Same public fields as the map |
| GET | `/photos/:id.jpg` | none (moderator for rejected) | Stripped photo |
| POST | `/api/mod/login` | none | `{email, password}` → session token (8 h); 5 failed tries per 15 min per IP, then 429 |
| GET | `/api/mod/reports` | Bearer session | All reports including exact GPS and contact email |
| PATCH | `/api/mod/reports/:id` | Bearer session | `{status, note}`; every change is written to `status_history` |

## MVP coverage (docs/MVP.md)
| Feature | State |
|---|---|
| 1. Report form | Done: issue type, severity, duration, usable?, GPS or pin drop, photo resized in the browser to ≤1280 px JPEG and stripped again on the server, optional private email, disclaimer, soft warning at the 4th report |
| 1. Offline | Done: queue in localStorage + service worker for page loads |
| 2. Public map | Done: clusters, status colors, type/age filters, thumbnail popups, ~100 m coarse location |
| 3. Moderator triage | Done: shared email + password login (scrypt, not bcrypt, to stay dependency-free), sort, actions, internal note, exact GPS moderator-only |
| 4. Export | Done: CSV (formula-safe, numbers untouched) and GeoJSON |
| 5. Status dashboard | Done |

Known gaps: sessions live in memory (a restart logs moderators out); no neighborhood picker (pin drop instead); no per-moderator accounts; offline reports in localStorage are not signed (Security Reviewer's medium risk); Lighthouse score not measured yet.

## Hosting options (answer to PLAN.md open question 2)
Prices checked on 2026-11-12 at fly.io/docs/about/pricing, supabase.com/pricing and vercel.com/pricing.

**A. Fly.io, one Machine + SQLite and photos on a volume**: about $4–8/month, often $0.
- 1× `shared-cpu-1x` 512 MB: $3.69; 3 GB volume: $0.45; snapshots: free up to 10 GB; egress: $0.02/GB.
- Fly waives personal-org bills under $5, so pilot scale is likely $0. A card is required; there's no free tier.
- Pros: runs this draft as is; one process; cheapest. Cons: one machine (no failover); we build moderator auth and photo handling ourselves; daily snapshots are our only backup.

**B. Vercel frontend/functions + Supabase (Postgres, Storage for photos, Auth for moderators)**: $0 for the hackathon, about $25–45/month for a pilot.
- Free: Supabase 500 MB DB, 1 GB files, project pauses after 1 week idle; Vercel Hobby $0.
- Pilot: Supabase Pro $25 (8 GB DB, 100 GB files, daily backups 7 days); Vercel Pro $20 if Hobby's terms don't fit.
- Pros: managed backups, photo storage, and real moderator accounts; scales to many communities. Cons: port the API to serverless + Postgres; two vendors; the free Supabase tier pauses, so it's risky for a live pilot.

Photos are small at pilot scale: 30 reports × ~300 KB ≈ 10 MB.

Recommendation: A for the hackathon demo and first pilot; move to B when a second community or more than a few moderators join.

## Next build steps
1. Design Critic / Handoff Spec Writer fixes once wireframes exist.
2. Lighthouse mobile audit (target ≥ 80).
3. Deploy to Fly.io (option A) with `DB_FILE` and `PHOTO_DIR` on a volume.
4. Per-moderator accounts and persistent sessions before the pilot.
