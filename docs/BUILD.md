# TapCheck MVP draft: build notes

Owner: Executive Coder. This is a first runnable draft of F1–F7 for design and security review. It is not production-ready.

## Run it
Needs Node 22.5 or later (it uses the built-in `node:sqlite`). No npm install is needed.

```bash
MOD_TOKEN=<long-random-string> DB_FILE=tapcheck.db npm start   # http://localhost:3000
npm test
```

| Env var | Default | Purpose |
|---|---|---|
| `PORT` | 3000 | HTTP port |
| `DB_FILE` | `:memory:` | SQLite file; set it so data survives restarts |
| `MOD_TOKEN` | unset | Shared moderator token; moderator routes stay closed when it is unset |
| `RATE_SALT` | random per boot | Salt for the hashed submitter id used by the rate limit |
| `DAILY_LIMIT` | 5 | Reports per submitter per 24 h (F5; Security Reviewer to confirm the value) |

## Layout
```
api/db.js           schema, issue types, statuses, coarse-location rounding (0.002° ≈ 200 m)
api/server.js       HTTP API + static file server (no dependencies)
api/server.test.js  node:test behavior tests
app/index.html      F1 report form + F7 disclaimer
app/queue.js        F2 offline queue (localStorage, client UUID makes retries idempotent)
app/map.html        F3 public map (Leaflet + OpenStreetMap tiles) + F6 export links
app/mod.html        F4 moderation queue
```

## API
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/reports` | none | `{id (uuid), issue_type, description?, lat, lng}`; 201 new, 200 duplicate, 429 over limit |
| GET | `/api/reports` | none | Non-rejected reports with coarse location only |
| GET | `/api/export.csv`, `/api/export.geojson` | none | Same public fields as the map (F6) |
| GET | `/api/mod/reports` | Bearer `MOD_TOKEN` | All reports including precise location |
| PATCH | `/api/mod/reports/:id` | Bearer `MOD_TOKEN` | `{status, note}`; every change is written to `status_history` |

## MVP coverage
| Feature | State in this draft |
|---|---|
| F1 Report form | Done, but **no photo upload yet**: EXIF stripping needs an image library or object storage; planned next |
| F2 Offline queue | Done with localStorage; a service worker for offline page loads is still to do |
| F3 Public map | Done: color by status, filter by type and age, coarse location |
| F4 Moderation | Done with one shared token; per-moderator accounts are needed before the pilot |
| F5 Rate limit | Done: salted IP hash, rejected reports hidden. IP-based limits are weak behind shared NAT |
| F6 Export | Done: CSV (formula-safe) and GeoJSON, no precise coordinates |
| F7 Disclaimer | On the form and map popups |

## Hosting options (answer to PLAN.md open question 2)
1. **Single small VM or Fly.io/Render instance with SQLite on a volume.** Matches this code as is, lowest cost (free tier to a few $/month), one process to run. Weak point: one machine, so backups are manual.
2. **Vercel/Netlify static frontend + managed Postgres (Supabase/Neon free tier) + object storage for photos.** Scales and handles photos better; needs the API ported to serverless functions and the SQL moved to Postgres.

Recommendation: option 1 for the hackathon and pilot, option 2 if the pilot grows past one community. Prices are from general knowledge; check current pricing pages before deciding.

## Next build steps
1. Photo upload with metadata stripping (F1).
2. Service worker for offline page loads (F2).
3. Moderator accounts with hashed passwords instead of a shared token (F4).
4. Apply the Handoff Spec Writer's design tokens once Phase 1 is signed off.
