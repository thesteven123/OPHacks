# TapCheck — Demo Script (Phase 4)

*5-step walkthrough for judges. Target time: ~8 minutes total. Practice run recommended to hit < 2-min triage window.*

---

## Setup Checklist (before judges arrive)
- [ ] App running: `cd ~/Desktop/tapcheck && MOD_TOKEN=<token> npm start`
- [ ] 4 seed reports already in DB (run `npm run seed` if implemented; otherwise submit manually beforehand)
- [ ] Browser tabs open: `/report` on mobile (or DevTools 375px), `/map` on desktop, `/mod` on desktop
- [ ] Network throttled to "Slow 3G" in DevTools for the offline demo step
- [ ] Export path confirmed: `/api/export?format=csv` and `?format=geojson` both return 200

---

## Step 1 — The Problem (1 min)
**Say:** "Every day, people notice tap water that smells wrong, runs brown, or stops entirely. There's no easy way to report it that gets it on a map someone can act on. TapCheck fixes that."

**Show:** The SDG 6 target on screen (or slide): *"Safe and affordable drinking water for all by 2030."*

---

## Step 2 — Submit a Report (2 min)
**Say:** "Here's what a resident sees on their phone."

**Do (live on mobile viewport):**
1. Open `/report`
2. Point out the disclaimer banner at the top
3. Tap **Discoloration**
4. Tap **Use my GPS** — show coordinates appear
5. Answer the 3 quick questions (severity, duration, usability) — tap only, no typing
6. Skip photo (or show camera tap) — mention client-side compression
7. Tap **Submit** — show success confirmation

**Say:** "30 seconds. Anonymous. No account needed."

**Offline demo (optional, 30s):** Turn off Wi-Fi, submit again — show "Saved to device, Queue: 1" banner. Turn Wi-Fi back on — show auto-sync.

---

## Step 3 — The Public Map (1.5 min)
**Say:** "Every report becomes a pin on a shared map — instantly visible to anyone in the community."

**Do (desktop `/map`):**
1. Show 5 colored pins (open red, verified orange, resolved green)
2. Tap a pin — show summary card with type, date, photo thumbnail, coarse location only
3. Use the filter: switch to "Last 24h" — pins update
4. Filter by "Outage" — only outage pins remain

**Say:** "Location is coarsened to ~100 meters. No addresses, no precise GPS — by design."

---

## Step 4 — Moderator Triage (2 min)
**Say:** "A local volunteer, housing coordinator, or NGO staffer logs into the triage view."

**Do (desktop `/mod`):**
1. Show the login (use the demo moderator token)
2. Show the report table — point out precise GPS is visible here only
3. Click a report → open detail drawer
4. Tap **Verify** — status updates to orange in real time
5. Add an internal note: "Forwarded to Public Works 11/12"
6. Tap **Resolve** on a second report — status turns green
7. Click **Export CSV** — download opens

**Say:** "Median triage time under 2 minutes. The CSV goes straight to a city GIS system or NGO grant report."

---

## Step 5 — Impact & Handoff (1.5 min)
**Say:** "Here's what this means at scale."

**Show (status dashboard `/dashboard`):**
- Total reports, open vs. resolved, last updated timestamp

**Say:**
- "SDG 6.b: support community participation in water management — this is exactly that."
- "SDG 16.6: accountable institutions — public map makes the pipeline transparent."
- "A neighborhood association could deploy this in a week. A city utility could embed the export in their GIS today."

**Close:** "TapCheck: a report in 30 seconds, a resolved issue on the map, a dataset a city can use."

---

## Timing Summary

| Step | Target | Buffer |
|------|--------|--------|
| Problem | 1:00 | 0:30 |
| Submit report | 2:00 | 0:30 |
| Public map | 1:30 | 0:30 |
| Mod triage | 2:00 | 0:30 |
| Impact & close | 1:30 | 0:30 |
| **Total** | **8:00** | **2:30** |

---

## Q&A Prep

**"What stops spam?"** → 5 reports/day per hashed IP. Moderation queue removes bad reports before they appear on the public map.

**"Is this HIPAA compliant?"** → No personal health data is collected. Contact email is optional and never shown publicly.

**"Could a city actually use this?"** → CSV/GeoJSON export is importable in any GIS tool today. The moderator role can be a city employee; we designed for that handoff.

**"What's next?"** → EXIF metadata stripping on photos, service worker for full offline support, per-moderator accounts, and a pilot with [chosen partner type].
