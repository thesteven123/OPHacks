# TapCheck Design Specification Template (Phase 1)

**Source:** Pending Figma frames / wireframes (Values marked `[Pending Design]`)  
**Target:** Mobile Web (Next.js 14, Responsive 360px–1280px)  
**Design System:** [Pending - write "no system to compare" or token names once Figma provided]  
**Date:** 2026-11-12  

---

## 1. Screen: Report Submission Form (`/report` — Feature F1)

### Frame Info
- **Frame Name:** `Report-Form-Mobile`
- **Viewport Target:** 360px–428px (Mobile primary), scalable to desktop (max-width 640px)
- **Source:** [Pending Design / Wireframe]

### Components
- `HeaderBar` — Custom (Logo, title, offline status pill)
- `DisclaimerBanner` — Alert / Warning variant ("This is not a substitute for official water testing")
- `OfflineSyncBanner` — Alert / Info variant (shows pending queue count & sync status)
- `IssueTypeSelector` — Segmented control or ChipGroup (Options: Discoloration, Odor, Outage, Broken Infrastructure, Sanitation Gap)
- `LocationPicker` — Custom composite:
  - `GPSDetectButton` — Button / Secondary with icon
  - `ManualLocationInput` — TextInput / Outlined (Neighborhood / Cross street / Address)
  - `LocationPrivacyNotice` — HelperText ("Public view shows approximate ~100m location only")
- `SeverityRating` — RadioGroup or SegmentedRating (1: Mild, 2: Moderate, 3: Severe)
- `DurationPicker` — Select / Dropdown (e.g., Just started, Few hours, 1-3 days, >1 week)
- `WaterUsabilityToggle` — SegmentedControl / Radio ("Is water currently usable? Yes / No / Boil Notice")
- `PhotoUploadField` — FilePicker / Drag-drop area:
  - Empty upload tile with camera/gallery icon
  - Upload progress bar
  - Thumbnail preview card with remove icon button (max 5 MB client-compressed)
- `ContactEmailInput` — TextInput / Outlined (Optional, with privacy helper note: "Stored privately, never public")
- `SubmitButtonGroup` — Stack:
  - `SubmitReportButton` — Button / Primary (Full-width, 48px height)
  - `CancelOrClearButton` — Button / Text

### Layout & Spacing
- **Container:** Vertical stack, max-width `[Pending]`, padding `[Pending]`
- **Section Gap:** `[Pending]`
- **Field Gap:** `[Pending]`
- **Resize Behavior:** Mobile (100% width, fixed bottom submit action bar); Tablet/Desktop (centered card, max-width 560px, auto margins)

### Tokens
| Kind | Token | Value | Used In |
|---|---|---|---|
| Color (Brand) | `[Pending]` | `[Pending]` | Primary actions, active chips |
| Color (Surface) | `[Pending]` | `[Pending]` | Page background, cards, input fills |
| Color (Text) | `[Pending]` | `[Pending]` | Headings, body text, helper copy |
| Color (Status) | `[Pending]` | `[Pending]` | Error, warning disclaimer, offline sync |
| Typography | `[Pending]` | `[Pending]` | Headings, labels, input values, disclaimers |
| Spacing | `[Pending]` | `[Pending]` | Card padding, field gaps, margins |
| Radius | `[Pending]` | `[Pending]` | Inputs, buttons, cards, upload tile |
| Shadow | `[Pending]` | `[Pending]` | Sticky action bar, modal overlays |

### Drift
| Place | Value | Nearest Token | Note |
|---|---|---|---|
| *To be evaluated upon Figma frame inspection* | — | — | — |

### Interactive Element States
| Element | Default | Hover | Focus | Disabled | Loading | Empty | Error | Offline-Queued |
|---|---|---|---|---|---|---|---|---|
| `IssueTypeSelector` | Unselected / Outline | Tint background | 2px focus ring | Opacity 50% | Skeleton pulse | No selection | Red border + text | Shows selected, saved in storage |
| `GPSDetectButton` | Active secondary | Tint background | 2px focus ring | Disabled when GPS off | Spinner icon | Location null | "GPS unavailable" inline msg | "Cached / manual only" |
| `LocationInput` | Placeholder shown | Border darken | Focus ring | Non-editable | Skeleton | Empty string | Red border + aria-errormsg | Preserved in queue |
| `PhotoUploadField` | Empty dashed box | Highlight border | Focus ring | Upload blocked | Linear progress / spinner | Empty tile | "File > 5MB" or compression error | Cached local data URI |
| `SubmitReportButton`| Enabled primary | Hover shade | Focus ring | Incomplete required fields | "Submitting..." + spinner | N/A | "Retry submission" | "Save to Device Queue" |

### Accessibility Notes (WCAG 2.1 AA)
- **Labels & Descriptions:** Every form control must have a visible `<label>` tied via `for`/`id` and helper text linked with `aria-describedby`.
- **Error Handling:** Invalid fields receive `aria-invalid="true"` and reference inline error text IDs. Focus shifts to first error on submit.
- **Offline & Status Announcements:** `OfflineSyncBanner` wrapped in `aria-live="polite"` to announce reconnection and queue sync count.
- **Touch Targets:** Minimum 44×44 pt touch targets for mobile (radio chips, file picker, submit button).
- **Color Independence:** Issue types and severity levels must not rely on color alone; use distinct icons and clear text labels.

### Motion & Animation
- **Upload Progress:** Smooth progress fill (`[Pending duration]`, ease-out).
- **Reduced Motion:** If `prefers-reduced-motion: reduce`, replace animated spinners with static loading text; disable screen transitions.

### Content Rules
- **Disclaimer Text:** Fixed copy: *"This is not a substitute for official water testing."*
- **Issue Type:** Exactly 1 selection required.
- **Photo:** Optional. Format: JPEG/PNG. Max size: 5 MB client-compressed before upload.
- **Email:** Optional. Validated against RFC 5322 regex format.

### Open Questions
1. Should offline reports permit multiple photo attachments or strictly 1 photo to avoid `localStorage` quota overflow (5 MB limit)? — *Ask: Executive Coder / Security Reviewer*
2. Does the manual location input support autocomplete or free-form neighborhood text? — *Ask: Planner / Executive Coder*

---

## 2. Screen: Public Map View (`/map` — Feature F2)

### Frame Info
- **Frame Name:** `Public-Map-View`
- **Viewport Target:** 360px–1440px responsive full-viewport map
- **Source:** [Pending Design / Wireframe]

### Components
- `MapContainer` — Leaflet / Mapbox wrapper (full screen height minus top/bottom bars)
- `MapControls` — Zoom buttons, Geolocation recenter button
- `FilterHeaderBar` — Sticky / Floating card:
  - `IssueTypeFilterDropdown` — Multi/single select filter
  - `AgeFilterSegmented` — Filter pills (Last 24h, 7 days, All)
  - `TotalReportsCounter` — Badge indicator
- `MapClusterMarker` — Map marker cluster icon with count badge
- `ReportMarkerPin` — Color-coded pin:
  - Red: Open
  - Orange: Verified
  - Green: Resolved
- `ReportSummaryCard` (Bottom sheet on mobile, sidebar / callout popup on desktop):
  - `CardHeader` — Issue type title + status badge
  - `CardTimestamp` — Relative time (e.g., "3 hours ago")
  - `CardLocation` — Coarse neighborhood label (approx ~100m, no exact address)
  - `PhotoThumbnail` — Optional preview image (tappable to enlarge lightbox)
  - `CloseButton` — Icon button
- `OfflineMapNotification` — Toast notification: "Viewing cached reports. Reconnect for updates."

### Layout & Spacing
- **Map Viewport:** 100vw × 100vh (minus safe-area-insets)
- **Floating Filter Bar:** Top inset `[Pending]`, horizontal padding `[Pending]`, border-radius `[Pending]`
- **Bottom Sheet Summary:** Fixed bottom, mobile height `[Pending]`, swipe-down dismiss
- **Resize Behavior:** Mobile (<768px): floating top pill filter + bottom sheet card. Desktop (≥768px): top left filter panel + floating left sidebar card (380px wide).

### Tokens
| Kind | Token | Value | Used In |
|---|---|---|---|
| Color (Pin: Open) | `[Pending]` | `[Pending]` | Map pin red |
| Color (Pin: Verified) | `[Pending]` | `[Pending]` | Map pin orange |
| Color (Pin: Resolved) | `[Pending]` | `[Pending]` | Map pin green |
| Color (Surface/Overlay) | `[Pending]` | `[Pending]` | Filter bar fill, summary sheet |
| Typography | `[Pending]` | `[Pending]` | Marker labels, card header, time stamps |
| Spacing | `[Pending]` | `[Pending]` | Floating offsets, card padding |
| Radius | `[Pending]` | `[Pending]` | Filter pills, summary sheet corners |
| Shadow | `[Pending]` | `[Pending]` | Floating filters, bottom sheet elevation |

### Drift
| Place | Value | Nearest Token | Note |
|---|---|---|---|
| *To be evaluated upon Figma frame inspection* | — | — | — |

### Interactive Element States
| Element | Default | Hover | Focus | Disabled | Loading | Empty | Error | Offline-Queued |
|---|---|---|---|---|---|---|---|---|
| `MapMarkerPin` | Colored pin | Scale 1.1 + tooltip | High-contrast outline | Low opacity (filtered out) | Skeleton pin / fade | N/A | Gray broken marker | "Cached report" badge |
| `FilterPills` | Outline / muted | Background tint | 2px focus ring | Disabled filter | N/A | Zero matching count | Filter error | Active on cached data |
| `ReportSummaryCard`| Collapsed / Hidden | N/A | Focus on card header | Dismissed | Loading spinner for photo | "No report selected" | "Failed to load report" | Shows cached details |
| `RecenterButton` | Secondary circle | Darken fill | Focus ring | Geolocation denied | Pulse icon | N/A | Geolocation failed toast | Disabled offline |

### Accessibility Notes (WCAG 2.1 AA)
- **Alternative List View:** An accessible toggle button ("List View" / "Map View") is required for keyboard and screen reader users who cannot navigate spatial Leaflet canvases.
- **Marker Focusability:** Markers or list items must have accessible names (e.g., `aria-label="Discoloration report, 2 hours ago, status open"`).
- **Color Independence:** Pins must include distinct glyphs/icons inside the marker shape (e.g., exclamation mark for open, checkmark for resolved), not color alone.
- **Focus Trapping:** Bottom sheet on mobile traps focus when open, with `Escape` key dismissing the card.
- **Target Sizes:** Filter chips and zoom controls must be ≥ 44×44 pt.

### Motion & Animation
- **Bottom Sheet:** Slide-up transition (`[Pending duration]`, ease-out).
- **Map Pan & Zoom:** Smooth pan to selected marker (`[Pending ms]`).
- **Reduced Motion:** If `prefers-reduced-motion: reduce`, disable fly-to animations; snap directly to marker coordinates; snap bottom sheet open instantly.

### Content Rules
- **Location Privacy:** Never display latitude/longitude or street address on public card. Display coarse neighborhood label or "~100m approximate radius".
- **Timestamp Format:** Relative time for < 24 hours ("X hours ago"), absolute date for older ("Oct 24, 2026").
- **Photo Fallback:** If no photo attached, display issue-type placeholder illustration or collapse media container.

### Open Questions
1. Does the hackathon map include a "List View" fallback tab for screen reader accessibility and low-bandwidth mode? — *Ask: Executive Coder / Design Critic*
2. What map tile provider is used in offline mode (Service Worker caching Leaflet tiles vs raster fallback)? — *Ask: Executive Coder*

---

## 3. Screen: Moderator Triage Queue (`/mod` — Feature F3 & F4)

### Frame Info
- **Frame Name:** `Moderator-Queue-Desktop`
- **Viewport Target:** 1024px–1440px (Desktop primary) with responsive mobile fallback
- **Source:** [Pending Design / Wireframe]

### Components
- `ModNavBar` — Header with App title, Moderator role badge, Export action dropdown, and Logout button
- `StatsSummaryBar` — Metric cards: Pending Triage, Verified Today, Resolved, Spam Blocked
- `TriageFilterToolbar`:
  - `StatusFilterTabs` (All, Pending Triage, Verified, Resolved, Flagged)
  - `IssueTypeFilterSelect`
  - `SortDropdown` (Date: newest/oldest, Severity: high/low)
  - `ExportControls` (CSV Export button, GeoJSON Export button per F4)
- `ReportsDataTable` / `TriageList`:
  - Columns: Timestamp, Issue Type, Severity, Coarse Location, Precise GPS (Mod only), Contact Email, Photo Thumbnail, Status, Quick Actions
- `TriageDetailDrawer` / Modal (Deep review view):
  - Full report metadata
  - Precise coordinate map snippet + link to map
  - Uncompressed / full-size photo viewer
  - Contact reporter action (mailto link)
  - `InternalNotesField` — Textarea with "Save Note" action
  - `StatusActionButtons`:
    - `VerifyButton` (Orange / Secondary)
    - `ForwardUtilityButton` (Blue / Secondary)
    - `ResolveButton` (Green / Primary)
    - `MarkSpamButton` (Red / Destructive)

### Layout & Spacing
- **Container:** Fluid desktop layout, max-width 1440px, auto margins, padding `[Pending]`
- **Table Row Height:** `[Pending]`
- **Action Button Spacing:** `[Pending]`
- **Detail Drawer Width:** 480px fixed right drawer with scrim overlay
- **Resize Behavior:** Desktop: multi-column responsive table. Tablet/Mobile: card-based feed with stacked action buttons.

### Tokens
| Kind | Token | Value | Used In |
|---|---|---|---|
| Color (Action: Verify) | `[Pending]` | `[Pending]` | Status tag and action button |
| Color (Action: Resolve) | `[Pending]` | `[Pending]` | Status tag and primary action |
| Color (Action: Spam) | `[Pending]` | `[Pending]` | Destructive action button |
| Color (Surface: Table) | `[Pending]` | `[Pending]` | Table header, zebra striping |
| Typography | `[Pending]` | `[Pending]` | Table data cells, notes monospace/sans, metrics |
| Spacing | `[Pending]` | `[Pending]` | Table cell padding, drawer padding |
| Radius | `[Pending]` | `[Pending]` | Action buttons, metric cards, status pills |
| Shadow | `[Pending]` | `[Pending]` | Drawer elevation, modal popup |

### Drift
| Place | Value | Nearest Token | Note |
|---|---|---|---|
| *To be evaluated upon Figma frame inspection* | — | — | — |

### Interactive Element States
| Element | Default | Hover | Focus | Disabled | Loading | Empty | Error | Offline-Queued |
|---|---|---|---|---|---|---|---|---|
| `StatusActionButton`| Enabled filled/outline| Brightness adjust | 2px focus ring | Permission locked | Spinner on button | N/A | Toast: "Update failed" | "Disabled offline (Mod online only)" |
| `InternalNotesField` | Saved text display | Outline hover | 2px focus ring | Read-only | Saving indicator | "Add internal note..." | Red border + "Failed to save" | Draft saved in local buffer |
| `ExportButton` | Secondary with icon | Background tint | Focus ring | Zero reports | Spinner "Generating..." | Export disabled | "Export error" | Disabled |
| `DataTableRows` | Default row background| Row tint | Row focus ring | Strikethrough if spam | Skeleton rows (5) | "No reports in queue" | "Failed to load queue" | "Stale data warning" |

### Accessibility Notes (WCAG 2.1 AA)
- **Table Markup:** Proper semantic `<table>`, `<thead>`, `<th>` with `scope="col"`, and `aria-sort="ascending|descending"` on sortable headers.
- **Action Confirmation Dialogs:** Destructive actions ("Mark Spam / Remove") must prompt an accessible confirmation modal (`role="alertdialog"`) with focus trapped on "Cancel".
- **Keyboard Shortcuts:** If row triage actions support hotkeys (e.g., `V` for Verify, `R` for Resolve), they must have a visible key hint and single-key toggle disable option.
- **Contrast:** Status pill badges (e.g., Verified orange text) must maintain at least 4.5:1 text-to-badge background contrast, or 3:1 against surrounding card surface.

### Motion & Animation
- **Detail Drawer:** Slide from right (`[Pending duration]`, ease-in-out).
- **Row Resolution Animation:** Fade out / collapse upon triage action.
- **Reduced Motion:** If `prefers-reduced-motion: reduce`, rows remove instantly without collapse animation; drawer appears without sliding.

### Content Rules
- **Precise Location Display:** Formatted as decimal degrees `lat, lon` (6 decimal places), mod view only.
- **Email Masking:** Show truncated/masked preview in table row (e.g., `j***@example.com`), reveal full address on drawer open or hover tooltip.
- **Internal Note Limit:** Max 1,000 characters; auto-timestamped with moderator ID/session.

### Open Questions
1. Should CSV/GeoJSON export be protected by a secondary token confirmation or re-authentication prompt to prevent bulk data scraping? — *Ask: Security Reviewer / Executive Coder*
2. Does the moderator queue require real-time WebSocket updates, or is periodic polling / manual refresh button sufficient for MVP? — *Ask: Planner / Executive Coder*
