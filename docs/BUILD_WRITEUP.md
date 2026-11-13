# TapCheck — Build Write-Up

A plain-language narrative of how the TapCheck MVP was planned, built, and checked. This document summarizes the project docs and the ported source tree; it does not re-run tests, deploys, or live services.

## How to read this document

Every claim below carries an evidence level:

- **Code-confirmed** — read directly in the source tree at the inspected commit.
- **Reported** — stated in project docs or test/build notes; not re-verified for this write-up.
- **Planned / unknown** — a goal, decision, or check that is open or unmeasured.

### Provenance

| Item | Reference |
|---|---|
| Documentation base | `main` at `f36e228e76b0f4138b975c7e96c787e6ed7b21a7` (`docs/PLAN.md`, `docs/MVP.md`, `docs/BUILD.md`, `docs/ROLES.md`, `docs/STATUS.md`, `docs/SPEC_TEMPLATE.md`) |
| Implementation inspected | `feat/port-nextjs-railway` at `86098efbc838d38abe78aa4012a70969358bb92e` (read via `git show`; no checkout) |
| Merge on local main | `783e7cc` merges the port branch; remote push state was not queried for this write-up |
| Sources consulted | `docs/PLAN.md`, `docs/MVP.md`, `docs/BUILD.md`, `docs/ROLES.md`, `docs/SPEC_TEMPLATE.md`, `docs/STATUS.md` (on `main`; STATUS.md is absent from the feature branch), plus `web/package.json`, `api/package.json`, `api/src/app.js`, `api/src/photos.js`, `api/prisma/schema.prisma`, `api/test/app.test.js`, `web/lib/queue.js`, `web/lib/server.js`, `web/app/report/page.js`, `web/app/map/page.js`, `web/app/dashboard/page.js`, `web/public/sw.js`, `README.md` at the implementation hash |

Note: `docs/STATUS.md` is a historical snapshot from 2026-11-12. Several of its "needs a decision" items (Next.js version, push/merge approval) were later answered and are treated here as settled, not still pending.

## What TapCheck is

TapCheck is a mobile-first civic reporting app: a resident submits a tap-water issue (discoloration, odor, outage, broken infrastructure, sanitation gap, or other), the report appears on a public map at a coarsened location, and a moderator triages it. The build target was a working 48-hour demo, not a production launch. It is relevant to UN SDG 6 (clean water and sanitation) but does not measure official SDG indicators and is not proof of water safety — the form itself carries the disclaimer "This is not a substitute for official water testing."

## The plan

`docs/PLAN.md` structured the work as three ~16-hour agile iterations:

1. **Iteration 1 — Foundation (hours 0–16).** Get the backend API running, the database schema live, and a basic form submitting data end-to-end. Included the Prisma schema (`reports`, `moderators`), the public report endpoints, GPS auto-detect, Cloudinary photo upload, a Railway deploy of the API, a design spec for the form, and a first security audit.
2. **Iteration 2 — Core UX (hours 16–32).** Public map with clustered, color-coded markers and filters; moderator login via NextAuth and a triage table with verify/resolve/remove actions and an internal note field; the offline queue; plus design and PR reviews and a location-privacy check (precise GPS never in public responses).
3. **Iteration 3 — Polish & Export (hours 32–48).** CSV and GeoJSON export, a public status dashboard, disclaimer copy, rate limiting, a Lighthouse mobile audit (target ≥ 80), final security and PR reviews, merge to main, and a rehearsed demo script.

In parallel, a Research Desk track was to identify candidate pilot partners — with no outreach without the owner's approval.

## Build sequence and local setup

Per the project docs, the build sequence was: an original scaffold draft (`feat/mvp-scaffold`, SQLite/Fly.io), then a port to the planned stack on `feat/port-nextjs-railway` (Express API, Next.js web, PostgreSQL via Prisma, Cloudinary), then review and a merge onto the local `main` (`783e7cc`). Role assignments include design, security, and change reviews, but this write-up does not claim each of those reviews completed.

One structural note for readers: the repository root `README.md` still describes a stale `src/frontend`, `src/backend`, `src/db` layout. The actual tree on the inspected commit is `api/` (the Express + Prisma service) and `web/` (the Next.js app) at the repository root.

Local setup recipe, condensed from `BUILD.md` (no commands were executed for this document): copy each `.env.example` and fill in private values (`DATABASE_URL`, `INTERNAL_API_KEY`, `NEXTAUTH_SECRET`, Cloudinary and `RATE_SALT` as needed). The API manifest requires Node 20+. For the API: `npm install`, `npm run migrate` against a disposable/local PostgreSQL, `npm run create-moderator`, then `npm start` (port 4000). For the web app: `npm install`, `npm run build`, `npm start` (port 3000). The service worker only registers in production builds, so `npm run dev` never serves stale files. Caution: the API test suite runs against a real database and deletes report and moderator rows — point it at a disposable database only.

## Stack and why

All version numbers below are **code-confirmed** manifest declarations (`web/package.json`, `api/package.json` at the inspected commit). Declared versions are not proof of verified runtime installs.

| Layer | Choice | Why (per plan/build notes) |
|---|---|---|
| Frontend | Next.js `^16.4.5` (App Router), React `^19.3.1`, JavaScript | SSR, mobile-friendly, fast to scaffold |
| Map | Leaflet `^1.9.4` + react-leaflet `^5.0.0` + leaflet.markercluster `^1.5.3` | Free, no API key needed for basic use |
| Backend | Express `^5.3.0` on Node `>=20` | Fast API scaffolding |
| Database | PostgreSQL via Prisma `^6.19.3` | Relational data, easy schema migrations |
| Photos | Cloudinary `^2.11.0` | Photo storage without building infra |
| Auth | next-auth `^4.24.15` (credentials), bcryptjs `^3.0.3` | Simple moderator login |
| Rate limiting | express-rate-limit `^8.7.3` | Spam mitigation per plan |
| Hosting (planned) | Vercel for the web app, Railway for API + Postgres | Free tiers, instant deploys |

Two documented deviations from earlier planning docs: **Next.js 16 instead of 14** — `BUILD.md` records support/security concerns (14.x out of support, unpatched `npm audit` advisories) as the reason for choosing 16; those vendor lifecycle/advisory claims were not independently rechecked here. The current `MVP.md` already names Next.js 16. Second, **JavaScript instead of TypeScript**, to match the earlier draft. The offline queue also moved from the earlier `PLAN.md`-era localStorage proposal to **IndexedDB** (the current `MVP.md` already specifies IndexedDB), because the service worker cannot read localStorage and photos would overflow its ~5 MB limit.

### Architecture at a glance

- Public calls from the report form and map (submission, report list, exports) go **straight from the browser to the Express API** (`web/app/map/page.js` fetches `PUBLIC_API_URL` client-side). The dashboard is different: its stats are fetched **server-side** by the Next.js app via `publicFetch` in `web/lib/server.js` and rendered into the page. Direct public calls are *intended* to preserve client IP attribution for rate limiting — whether the API actually sees the real client IP depends on trusted-proxy configuration in the deployment. CORS is restricted to the configured `FRONTEND_ORIGIN`, which controls which origins a *browser* may read responses from; it is not authentication and does not block non-browser clients (code-confirmed).
- Moderator calls go **through the Next.js app**: `moderatorProxy` in `web/lib/server.js` checks the NextAuth session server-side, then forwards the request with `INTERNAL_API_KEY` added server-side. The key never reaches the browser (code-confirmed: moderator API routes require `x-api-key`).
- Sessions: NextAuth credentials with a JWT session of about 8 hours (`SESSION_HOURS = 8` in `web/lib/server.js`); moderator accounts are bcrypt-hashed rows in the `moderators` table, checked via the internal `/api/auth/verify` route (code-confirmed).
- Data model (code-confirmed, `api/prisma/schema.prisma`): `Report`, `StatusChange`, and `Moderator` models mapping to `reports`, `status_history`, and `moderators` tables. A report stores both `precise_lat/lng` and `public_lat/lng`, plus a `submitter_hash` used for daily limiting.

## Feature walkthrough (F1–F7)

**A note on numbering.** There is no canonical F1–F7 registry in the source docs: `MVP.md` enumerates five sections (1 form+offline, 2 map, 3 triage, 4 export, 5 dashboard); `SPEC_TEMPLATE.md` calls the report form "F1"; `BUILD.md` calls the offline work "F2". The seven-part grouping below is an **editorial grouping chosen for this write-up**, not an original approved numbering. Crosswalk: editorial F1 ≈ MVP §1; F2 ≈ MVP §1 offline portion / BUILD "F2"; F3 ≈ MVP §2; F4 ≈ MVP §3; F5 ≈ MVP §4; F6 ≈ MVP §5; F7 has no single MVP section — it covers safeguards spread across the plan, security review, and code.

### F1 — Resident reporting (code-confirmed)

The report form collects: issue type (`discoloration`, `odor`, `outage`, `broken_infrastructure`, `sanitation_gap`, `other` — the enum in `app.js` and `schema.prisma`), severity 1–3, duration (`today`, `few_days`, `week_plus`), whether the water is currently usable (`yes`, `no`, `unsure`), a location via GPS auto-detect or map pin, and an optional private contact email, free-text description (capped at 280 characters server-side), and photo. The water-testing disclaimer is displayed on the form. The API checks the enumerated required fields, coordinates, email format, and photo encoding, and coerces/truncates the description — that is the observed input handling, not a comprehensive validation guarantee. It also requires a client-generated UUID as the report id, which makes retries idempotent — resubmitting the same id returns `duplicate: true` rather than a second row.

Photos are resized in the browser to a maximum of 1280 px as JPEG at quality 0.7 before upload; on the server `src/photo.js` strips JPEG metadata (EXIF/GPS, XMP, IPTC, comments) and `src/photos.js` uploads to Cloudinary as an `authenticated` asset served only through signed URLs (`sign_url: true`). Note: the code sets no expiry on the signed URL, so this write-up makes no expiry claim. If Cloudinary is not configured, reports are still accepted and their photos are dropped (logged at start-up).

### F2 — Offline queue (code-confirmed)

`web/lib/queue.js` writes submitted reports to IndexedDB first, then sends. The queue flushes on page load, on the browser `online` event, from a "Send now" button in the `OfflineSyncBanner`, and — where the browser supports Background Sync (Chromium) — from the service worker's `sync` event, even after the tab closes. Retries reuse the report id, so the API deduplicates them. If IndexedDB itself is full, the queue *attempts* to store the report without its photo; if even that smaller write fails, the queueing can fail completely — saving is attempted, not guaranteed.

The service worker (`web/public/sw.js`) runs only in production builds. It caches the `/report`, `/map`, and `/dashboard` pages and their static assets at install, other `/_next/static` files on first use, and the public reports/stats API responses network-first with cache fallback — so the map can show last-known reports offline. Moderator pages, login, and `/api/*` frontend routes are deliberately never cached. Map tiles are not cached either: offline, markers can appear on a blank basemap, and offline use requires having previously visited the app.

One honest limit: the flush loop keeps a queued report on 429, 5xx, or network failures, and also on a JSON-parse failure of the response — but a non-2xx response that *does* return valid JSON causes the report to be deleted from the queue even though it was not accepted. This describes the intended implementation, not a correctness certification.

### F3 — Public map (code-confirmed)

A Leaflet map with clustered markers, status-colored, filterable by issue type and age, with tap-to-open summary cards and photo popups. Markers come from `GET /api/reports`, which returns non-rejected reports, newest first, capped at 1000. Locations are coarsened: `public_lat`/`public_lng` are precise coordinates rounded to a 0.001-degree grid — approximately 100 m at moderate latitudes, but **not** a guaranteed anonymity radius (a rounded point can coincide with the original). The `toPublic` serializer omits the precise coordinate, contact email, and internal note *fields*, but free-text descriptions and photo contents are public and can themselves reveal locations or identities — public data still requires privacy moderation.

### F4 — Moderator triage (code-confirmed)

Moderators log in through NextAuth credentials backed by the `moderators` table (bcrypt password check). Each wrong attempt returns 401; after five recorded failures for an email within a 15-minute window, subsequent attempts return 429. The triage view lists all reports — including exact GPS, contact email, internal note, and full status history — and supports status changes to `open`, `verified`, `forwarded`, `rejected`, or `resolved`. Every change writes a `status_history` row. "Forwarded" is a status label only; there is **no** utility integration behind it.

### F5 — Exports (code-confirmed)

`GET /api/export?format=csv|geojson` is **unauthenticated** and serves a subset of the same public, non-rejected, capped-at-1000, coarsened data as the map — it drops the photo URL/flag fields and emits a selected column list. It is not a moderator-only export and not a full database backup. The CSV escapes leading `=`, `+`, `-`, `@` to neutralize spreadsheet formulas while keeping negative numbers intact.

### F6 — Status dashboard (code-confirmed)

A server-rendered public page backed by `GET /api/stats`, which returns counts by status (excluding rejected) plus a last-updated timestamp taken from the most recent `status_history` entry.

### F7 — Privacy and abuse safeguards (code-confirmed)

- The public serializer omits the precise coordinate, contact email, and internal note fields; that is a field-level omission, not a full privacy guarantee — free-text descriptions and photo contents remain public, and a coarsened point can coincide with the true location.
- Photo metadata is stripped server-side; Cloudinary assets are `authenticated` (signed-URL delivery only).
- Rate limits: 10 report submissions per IP per minute, and 5 reports per rolling 24 hours per salted hash of IP + User-Agent (`submitter_hash`). Requests carrying the internal key are exempt. The hash is an approximate device label, not a true device identity, and real client-IP attribution depends on deployment proxy configuration.
- CORS is restricted to the configured frontend origin — it limits which origins browsers can read responses from; it is not authentication and does not stop non-browser clients. Duplicate ids are deduplicated.
- These are mitigations, not a completed security audit or certification; a final security review remains open (below).

## Team roles

`docs/ROLES.md` assigns these responsibilities. They are assignments, not proof that every listed review was completed:

| Agent | Role | Responsibilities |
|---|---|---|
| Planner | Product Lead / Sprint Planner | User stories, sprint breakdown, prioritization, roadmap |
| Executive Coder | Full-Stack Lead Engineer | Frontend, backend API, DB schema |
| Handoff Spec Writer | UX/Design Spec | Developer-ready specs: components, tokens, states, edge cases |
| Design Critic | UI/UX Reviewer | Review every screen; ranked, concrete fixes |
| Bug Fixer | QA / Bug Triage | Reproduce bugs, deliver smallest confirmed fix |
| Security Reviewer | Security | Audit API, auth, location handling; ranked risks |
| Change Reviewer | Code Review | PR review before merge |
| PR Shepherd | CI/CD / PR Health | Keep PRs green, coordinate merges |
| Research Desk | Research / SDG Alignment | Water-safety sources, SDG 6, pilot partner research |
| Personal Assistant | Coordinator / PM | Task assignment, blockers, standups |
| Slack Orchestrator | Comms Hub | Route external messages, surface updates |
| Human (Steven) | Project Owner | Final approval on merges, outreach, payments |

## Reported test and build results

All outcomes in this section are **reported** from `docs/STATUS.md` and `docs/BUILD.md`; none were re-run for this write-up. The API test suite runs against a real PostgreSQL database and deletes report and moderator rows, so re-running it was out of scope here.

- Earlier scaffold (`feat/mvp-scaffold`, SQLite/Fly.io): 6/6 tests passing (reported).
- Ported API: 10/10 `node:test` tests passing against a real PostgreSQL with a fake Cloudinary store (reported). `api/test/app.test.js` covers, by test name: public view hiding precise location/email/notes with retry dedup; moderator routes requiring the internal key; bcrypt login and lockout after 5 failures; input validation and the daily limit with remaining count; per-minute rate limiting returning 429; photo metadata stripping and signed-only photo URLs; photo dropped when Cloudinary is absent; stats counting only non-rejected reports; CSV export containing no private fields and neutralizing formulas; and CORS restricted to the configured origin.
- `next build` passes; browser smoke test passed (reported).
- Cloudinary signed delivery: the build notes record "Verified 2026-11-12 with the project's Cloudinary account: an 'authenticated' upload works on its plan, the signed URL returns the photo (200) and the unsigned URL is refused (401)." An earlier revision of the same file marked photo upload unverified; the later `main` note supersedes it as a **documented** status — it was a reported check, not re-run here.

## Open decisions and incomplete work

- **Production deploys.** Railway and Vercel production deployments, production environment variables, and migrations against a production database were not verified in this writing task; the source status lists deployment as outstanding (planned).
- **Lighthouse.** The mobile score target is ≥ 80; no measured result is available in the inspected evidence (unknown).
- **Real-world offline.** Offline behavior on real mobile devices, cross-browser checks, and an accessibility pass are unverified in the inspected evidence (unknown).
- **Design backlog.** List view for screen readers, split-view triage, and an undo toast are queued Design Critic items (planned).
- **Security.** A final security review/sweep is still open; nothing here is an audit certification (planned).
- **Export policy.** A product decision is pending on whether the currently **public** export endpoint should get a confirmation step or require re-authentication (open decision).
- **Moderator accounts.** The schema supports multiple moderators; provisioning/admin UX for more than one login is a post-pilot decision (planned).
- **Hosting eligibility/cost.** Vercel free-plan eligibility for a nonprofit/noncommercial pilot is unverified; do not rely on earlier pricing notes without re-checking (unknown).
- **Pilot location and partners.** No pilot city or neighborhood is committed; a Jackson-area pilot was a provisional research recommendation, not a selected launch site, and no partner outreach is recorded in the inspected evidence — none was performed for this write-up. Language support is undecided (open decision).
- **Out of MVP scope.** Certified water testing, IoT sensor feeds, native mobile apps, real utility API integration, and multi-language support remain explicitly out of scope (planned/never promised).

## Sources

- `docs/PLAN.md` — architecture, 3×16h iterations, risk register, definition of done.
- `docs/MVP.md` — five-section feature scope, tech stack rationale, success metrics.
- `docs/BUILD.md` — build notes: layout, data flow, API table, offline implementation, hosting notes, Cloudinary verification note, next steps.
- `docs/ROLES.md` — agent role assignments and human owner.
- `docs/STATUS.md` — 2026-11-12 snapshot: done items, decisions (several since resolved), unverified checks, open risks.
- `docs/SPEC_TEMPLATE.md` — component-level design spec template for the report form.
- Code at `feat/port-nextjs-railway` @ `86098efbc838d38abe78aa4012a70969358bb92e`: `api/package.json`, `web/package.json`, `api/src/app.js`, `api/src/photo.js`/`photos.js`, `api/prisma/schema.prisma`, `api/test/app.test.js`, `web/lib/queue.js`, `web/lib/server.js`, `web/app/report/page.js`, `web/app/map/page.js`, `web/app/dashboard/page.js`, `web/public/sw.js`, `README.md`.
