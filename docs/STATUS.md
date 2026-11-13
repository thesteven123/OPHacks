# TapCheck Status (Planner, 2026-11-12)

## Decided
- Stack follows `docs/PLAN.md` on `main`: Next.js (Vercel), Express + Prisma + PostgreSQL (Railway), Cloudinary photos.
- Build is ported on local branch `feat/port-nextjs-railway` (commit `3d681f4`). Nothing pushed beyond `main`.
- Rate limits: 10 requests/min/IP (PLAN.md); 5 reports/device/day (Security Reviewer).
- Location: coarse (~100 m) public; precise GPS moderator-only.

## Done
| Item | Where | Status |
|---|---|---|
| Plan, MVP, roles | `main` | pushed (`24367b6`) |
| Pilot partners, demo script | `main` local `f0679a3` | not pushed |
| Scaffold (SQLite/Fly.io) | `feat/mvp-scaffold` | local, 6/6 tests |
| Port (Next.js/Express/Postgres/Cloudinary) | `feat/port-nextjs-railway` | local, 10/10 API tests, `next build` passes, browser smoke test passed |
| SDG 6 source check | Research Desk brief | done, sourced |
| Bug triage | Bug Fixer | standby, no failure reported |

## Needs a decision
1. **Pilot city or neighborhood.** Blocks pilot-language data (Research Desk) and partner outreach. Only you can name it.
2. **Push approval.** Approve pushing `feat/port-nextjs-railway` (includes the two `feat/mvp-scaffold` commits) to `thesteven123/OPHacks`, and whether to merge to `main`.
3. **Next.js version.** Port uses Next.js 16. MVP.md names 14, which is out of support with open advisories. Confirm 16.
4. **Cloudinary account.** Needed to test photo upload end to end. Not yet available.
5. **Push `f0679a3`** (pilot partners, demo script) to `main`.

## Not checked
- Lighthouse score (target ≥ 80).
- Railway and Vercel deploys.
- Photo upload with a real Cloudinary account.
- Per-moderator accounts vs. shared token (post-pilot decision).
- Vercel free-plan eligibility for a nonprofit pilot.

## Open risks
- Moderator sessions reset on server restart (scaffold); port uses NextAuth sessions (8 h).
- Offline reports are not signed.
- Export confirmation before bulk download is not built.
