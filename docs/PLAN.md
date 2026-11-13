# TapCheck — Project Plan

## Architecture Overview

```
[Mobile Browser]
    |
    v
[Next.js Frontend — Vercel]
    ├── /report    → Report submission form (offline-capable)
    ├── /map       → Public map (Leaflet, clustered markers)
    ├── /dashboard → Status summary
    └── /mod       → Moderator triage (auth-protected)
         |
         v
[Express REST API — Railway]
    ├── POST /api/reports      → Submit new report
    ├── GET  /api/reports      → Fetch all (coarse location)
    ├── GET  /api/reports/:id  → Moderator detail (precise location)
    ├── PATCH /api/reports/:id → Update status (mod only)
    └── GET  /api/export       → CSV / GeoJSON export
         |
         v
[PostgreSQL — Railway]
    └── Tables: reports, moderators
         |
         v
[Cloudinary]  → Photo uploads
```

## Agile Iterations (3 × ~16h)

### Iteration 1 — Foundation (Hours 0–16)
**Goal:** Backend API running, DB schema live, basic form submitting data.

| Task | Owner | Done When |
|------|-------|-----------|
| DB schema (reports, moderators) | Executive Coder | Prisma migrate runs clean |
| POST /api/reports endpoint | Executive Coder | Accepts JSON + photo URL, stores to DB |
| GET /api/reports endpoint | Executive Coder | Returns coarse location array |
| Report submission form (UI) | Executive Coder | Submits to API, shows success |
| GPS auto-detect | Executive Coder | Coordinates appear pre-filled |
| Cloudinary photo upload | Executive Coder | Photo URL stored in report row |
| Deploy backend to Railway | Executive Coder | /api/reports responds in production |
| Security audit: input validation, SQL injection | Security Reviewer | No unparameterized queries; validation on all fields |
| Design spec for form | Handoff Spec Writer | Component list with states, error messages |

**Retro target:** Form → API → DB pipeline confirmed end-to-end.

---

### Iteration 2 — Core UX (Hours 16–32)
**Goal:** Public map live, moderator triage working, offline queue functional.

| Task | Owner | Done When |
|------|-------|-----------|
| Public map with clustered markers | Executive Coder | Reports from API appear color-coded |
| Map filters (type, age) | Executive Coder | Filter controls update markers |
| Marker tap → summary card | Executive Coder | Card shows type, date, thumbnail, status |
| Moderator login (NextAuth) | Executive Coder | /mod redirects to login; session persists |
| Triage table + actions | Executive Coder | Verify/Resolve/Remove updates status in DB |
| Internal note field | Executive Coder | Note saved per report, mod-only |
| Offline queue (localStorage) | Executive Coder | Report queued when offline, syncs on reconnect |
| Design review: form + map | Design Critic | Top 3 fixes applied |
| PR review: Iteration 1 code | Change Reviewer | No critical bugs merged |
| Security: auth, session, location privacy | Security Reviewer | Precise GPS never in public API response |

**Retro target:** Full public flow + mod triage confirmed in staging.

---

### Iteration 3 — Polish & Export (Hours 32–48)
**Goal:** Export, dashboard, demo polish, Lighthouse ≥ 80.

| Task | Owner | Done When |
|------|-------|-----------|
| CSV export endpoint | Executive Coder | Downloads valid CSV from /api/export |
| GeoJSON export | Executive Coder | Valid GeoJSON, importable in QGIS |
| Status dashboard page | Executive Coder | Shows open/resolved counts, last updated |
| Disclaimer copy on form | Executive Coder | "Not a substitute for official water testing" visible |
| Rate limiting (spam mitigation) | Executive Coder | >10 req/min from same IP returns 429 |
| Lighthouse mobile audit | Executive Coder | Score ≥ 80 |
| Final security sweep | Security Reviewer | No high-severity open findings |
| Final PR review | Change Reviewer | All Iteration 3 PRs reviewed |
| PR merge to main | PR Shepherd | Main branch green, all checks pass |
| SDG alignment fact-check | Research Desk | SDG 6 target numbers verified against un.org |
| Demo script | Personal Assistant | 5-step walkthrough written, timing rehearsed |

**Retro target:** Demo-ready deploy on Vercel + Railway.

---

## Pilot Partner Research (Async — Research Desk)
Run in parallel with Iteration 1. Identify 3–5 candidate pilot partner types (neighborhood association, school, community clinic, housing authority, local NGO) and what to ask each. No outreach without Steven's approval.

## Risk Register

| Risk | Mitigation |
|------|-----------|
| Spam / false reports | Rate limiting + moderation queue |
| Privacy: precise GPS leaked | Coarse-only in public API; precise stored server-side |
| Photo storage cost | Cloudinary free tier (25 GB); compress client-side |
| DB overload at demo | Railway hobby plan + pagination on GET /reports |
| Offline sync conflicts | Last-write-wins; timestamp-based dedup |

## Definition of Done
- All Iteration 3 tasks checked
- No high-severity security findings open
- Vercel + Railway deploys responding
- 5 test reports visible on live map
- Export downloads valid CSV
