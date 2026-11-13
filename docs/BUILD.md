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
1. Photo upload with metadata stripping (F1).
2. Service worker for offline page loads (F2).
3. Moderator accounts with hashed passwords instead of a shared token (F4).
4. Apply the Handoff Spec Writer's design tokens once Phase 1 is signed off.
