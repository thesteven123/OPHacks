# TapCheck MVP

## Goal
Let a resident report a water or sanitation problem in under a minute, and let a moderator turn reports into a verified, public status map.

## Users
- **Resident:** reports an issue from a phone. May be anonymous.
- **Moderator:** a volunteer or NGO staffer who checks and forwards reports. Logs in.
- **Public viewer / city staff:** views the map and exports data.

## In scope
| # | Feature | Acceptance criteria |
|---|---|---|
| F1 | Report form | Issue type (discoloration, odor, outage, broken standpipe, sanitation gap, other); photo optional; location via GPS or pin drop; 3 questions max; submits in under 60 seconds on a phone. |
| F2 | Offline queue | If offline, the report is saved on the device and sent when online. No duplicate on retry. |
| F3 | Public map | Shows reports as pins colored by type and marked open/verified/resolved; filters by type and date; shows coarse location (about 200 m) only. |
| F4 | Moderation queue | Moderator sees new reports, can mark verified, forwarded, rejected, or resolved, with a note. Every change is logged with a time. |
| F5 | Rate limiting and spam guard | Max N reports per device/IP per day (value set in plan); rejected reports are not shown publicly. |
| F6 | Export | CSV and GeoJSON of non-rejected reports, with precise location removed. |
| F7 | Disclaimer | Every report page and the form say: "Not an official water test. For emergencies, contact your local authority." |

## Out of scope for MVP
- Laboratory water testing or IoT sensors
- Integration with utility billing or ticketing systems
- Native mobile apps (mobile-responsive web only)
- Public user accounts (residents stay anonymous)
- Multi-language UI beyond the pilot language

## Data captured per report
- id, created_at, issue_type, description (max 280 chars), photo (optional, stripped of EXIF), precise_lat/lng (moderator-only), public_lat/lng (rounded), status, moderator_note, status_history.

## Privacy rules
- Precise location is never shown publicly and never exported.
- Photos have metadata removed before storage.
- No account is needed to report; device identifiers are not stored, only a salted hash for rate limits.

## Success measures for the pilot
- At least 30 reports from the pilot area in 4 weeks.
- Median time from report to first moderator action under 48 hours.
- At least 1 report forwarded to the responsible authority and answered.

## Definition of done for MVP
All F1–F7 acceptance criteria pass on a phone-sized screen and desktop; the moderator flow is walked through end to end with at least 3 real test users; privacy rules are checked by the Security Reviewer.
