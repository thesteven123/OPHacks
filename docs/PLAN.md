# TapCheck Project Plan

## Phases
| Phase | Output | Exit criteria | Owner |
|---|---|---|---|
| 0. Discovery (week 1) | Pilot community chosen, 5 resident interviews, list of water-issue categories used by the local authority | Pilot partner confirmed in writing | Personal assistant (logistics), Research Desk (sources) |
| 1. Design (week 1–2) | Wireframes for report form, map, moderator queue; design spec with tokens and states | Design Critic review passed, spec signed off | Handoff Spec Writer, Design Critic |
| 2. Build MVP (week 2–4) | F1–F7 implemented on a branch per feature | All acceptance criteria in MVP.md pass | Executive Coder (lead), Bug Fixer (on reported failures) |
| 3. Review and hardening (week 4) | Security and change review of all PRs; privacy checks | No open high-severity findings | Security Reviewer, Change Reviewer, PR Shepherd |
| 4. Pilot (week 5–8) | Live pilot with the partner community | Success measures in MVP.md reached or reasons documented | Personal assistant (coordination), Research Desk (weekly summary) |

## Architecture (proposed, to confirm in Phase 2)
- **Frontend:** mobile-responsive web app (report form, public map, moderator views). Map tiles from an open provider.
- **Backend:** small REST API with one reports table, one status-history table, and one moderators table. Auth for moderators only.
- **Storage:** relational database for reports; object storage for photos with metadata stripped on upload.
- **Offline:** service worker queues the report locally and retries.
- **Hosting:** decision deferred to Phase 2; keep it simple and free-tier if possible.

## Repo workflow
- `main` is protected: changes come through pull requests.
- Branch names: `feat/<short-name>`, `fix/<short-name>`, `docs/<short-name>`.
- Every PR states which MVP feature (F1–F7) it covers and which acceptance criteria it meets.
- PR Shepherd tracks open PRs; Change Reviewer and Security Reviewer review before merge.

## Milestones
| Milestone | Date (relative) | Content |
|---|---|---|
| M0 | Day 0 | Repo and planning docs in place (this commit) |
| M1 | End week 2 | Design signed off; API contract written |
| M2 | End week 3 | F1, F2, F4 working end to end |
| M3 | End week 4 | F3, F5, F6, F7 working; security review closed |
| M4 | Week 5 | Pilot starts |

## Decisions to make (open questions)
1. Which pilot community and partner? (Personal assistant to propose options.)
2. Which hosting and database? (Executive Coder to propose two options with cost.)
3. Exact rate limit per device per day? (Security Reviewer to recommend.)
4. Which languages for the pilot? (Research Desk to check the local population.)

## Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Spam or false reports | Map loses trust | Moderation queue, rate limits, public view only shows verified or open reports with a note |
| Location privacy | Residents harmed | Coarse public location, precise location moderator-only, no exports of precise location |
| Users read reports as official tests | Health risk | Disclaimer on form, report page, and map |
| Authority doesn't respond | No real change | Pilot partner agreed before build; track response time as a success measure |
| Low adoption | Too few reports | Partner outreach, simple form, accessible in the local language |

## Out of this plan
Implementation details beyond the architecture above, hardware sensors, and any official water-quality claims.
