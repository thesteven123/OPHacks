# TapCheck — MVP Definition

## Goal
Ship a working demo in 48 hours that lets a resident report a tap water issue, see it on a public map, and let a moderator triage it.

## In-Scope Features (MVP)

### 1. Report Submission Form (Mobile-first)
- Issue type selector: discoloration, odor, outage, broken infrastructure, sanitation gap
- Optional photo upload (max 5 MB, compressed client-side)
- GPS auto-detect OR manual neighborhood pick
- 3 quick questions: severity (1–3), duration, is water currently usable?
- Optional contact email (stored privately, never shown publicly)
- Offline-capable: queues in localStorage, syncs on reconnect
- Disclaimer: "This is not a substitute for official water testing"

### 2. Public Map View
- Leaflet/Mapbox map with clustered markers
- Color-coded by status: open (red), verified (orange), resolved (green)
- Filter by issue type and age (last 24h / 7d / all)
- Tap marker → show summary card (type, date, photo thumbnail, status)
- No precise location shown publicly (coarse to ~100m)

### 3. Moderator Triage View (Simple Auth)
- Single shared moderator login (email + password, bcrypt)
- Table of all reports, sortable by date/type/status
- Actions: Verify, Forward to Utility, Resolve, Spam/Remove
- Internal note field per report
- Precise GPS visible only here

### 4. Data Export
- CSV export of all non-spam reports (date, type, coarse location, status)
- GeoJSON export for mapping tools

### 5. Status Dashboard
- Public page: total reports, open vs. resolved counts, last updated timestamp

## Out of Scope (Post-MVP)
- Lab water testing integration
- IoT sensor feeds
- Full user accounts / auth for reporters
- Real utility API integrations
- Multi-language support
- Native mobile apps

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Frontend | Next.js 14 (App Router) | SSR, mobile-friendly, fast to scaffold |
| Map | Leaflet + react-leaflet | Free, no API key for basic use |
| Backend | Node.js + Express | Fast setup, easy API scaffolding |
| DB | PostgreSQL + Prisma ORM | Relational, easy schema migrations |
| File Storage | Cloudinary (free tier) | Photo upload without infra setup |
| Auth | NextAuth.js (credentials) | Simple moderator login |
| Deploy | Vercel (frontend) + Railway (backend) | Free tiers, instant deploys |

## Success Metrics for Judges
1. ≥5 test reports submitted during demo
2. Median triage time < 2 minutes (live demo)
3. CSV/GeoJSON export working
4. Mobile Lighthouse score ≥ 80
