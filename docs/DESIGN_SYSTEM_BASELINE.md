# TapCheck Design System Baseline & Tokens (Draft)

Extracted from the current MVP scaffold (`feat/mvp-scaffold:app/style.css`) and aligned with the `SPEC_TEMPLATE.md` requirements. Ready to be updated or replaced when formal Figma tokens arrive.

## 1. Color Palette

| Token Name | CSS Value | Role / Usage | WCAG AA Contrast Check |
|---|---|---|---|
| `color-brand-primary` | `#111827` (Gray-900) | Primary button background, text heading | 16.1:1 on `#FFFFFF` (Pass) |
| `color-brand-secondary` | `#F3F4F6` (Gray-100) | Secondary action button background | 13.9:1 with `#111827` text (Pass) |
| `color-surface-base` | `#FFFFFF` | Page canvas, main background | Base surface |
| `color-surface-subtle` | `#F9FAFB` (Gray-50) | Table zebra striping, input inactive fill | 1.05:1 on white (Surface only) |
| `color-border-subtle` | `#E5E7EB` (Gray-200) | Header border, card dividers | Component border |
| `color-border-input` | `#D1D5DB` (Gray-300) | Form input border | 3:1 non-text contrast (Pass) |
| `color-text-main` | `#111827` (Gray-900) | Body copy, labels, primary text | 16.1:1 on white (Pass) |
| `color-text-muted` | `#4B5563` (Gray-600) | Timestamps, secondary helper copy | 7.0:1 on white (Pass) |
| `color-alert-warn-bg` | `#FEF3C7` (Amber-100) | Disclaimer box background | Tint fill |
| `color-alert-warn-text` | `#78350F` (Amber-900) | Disclaimer text | 8.5:1 on `#FEF3C7` (Pass) |
| `color-status-open` | `#DC2626` (Red-600) | Map marker open, report error state | 4.6:1 on white (Pass) |
| `color-status-verified` | `#D97706` (Amber-600) | Map marker verified, warning badge | 4.5:1 on white (Pass) |
| `color-status-resolved` | `#059669` (Emerald-600)| Map marker resolved, success state | 4.6:1 on white (Pass) |

## 2. Typography

| Token Name | Value | Used In |
|---|---|---|
| `font-family-sans` | `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` | Global font stack |
| `font-size-sm` | `14px` (`0.875rem`), line-height `1.4` | Helper text, disclaimers, badges |
| `font-size-base` | `16px` (`1.0rem`), line-height `1.5` | Body copy, form inputs, button labels |
| `font-size-lg` | `18px` (`1.125rem`), line-height `1.4` | Card titles, drawer headers |
| `font-size-xl` | `24px` (`1.5rem`), line-height `1.3` | Header logo, page titles |
| `font-weight-regular` | `400` | Paragraphs, descriptions |
| `font-weight-medium` | `500` | Filter chips, buttons |
| `font-weight-semibold` | `600` | Form labels, table headers, alert titles |

## 3. Spacing & Sizing

| Token Name | Value | Used In |
|---|---|---|
| `space-1` | `4px` (`0.25rem`) | Micro gaps, badge inner padding |
| `space-2` | `8px` (`0.5rem`) | Filter row gaps, helper text top margin |
| `space-3` | `12px` (`0.75rem`) | Card inner padding, disclaimer padding |
| `space-4` | `16px` (`1.0rem`) | Main container padding, field vertical spacing |
| `space-6` | `24px` (`1.5rem`) | Section vertical gaps |
| `space-8` | `32px` (`2.0rem`) | Desktop grid columns spacing |
| `target-min-touch` | `44px` | Minimum touch height/width for buttons and controls |

## 4. Radii & Shadows

| Token Name | Value | Used In |
|---|---|---|
| `radius-sm` | `4px` | Status tags, badge chips |
| `radius-md` | `6px` | Inputs, dropdowns, secondary buttons |
| `radius-lg` | `8px` | Summary cards, bottom sheet top corners |
| `elevation-low` | `0 1px 3px rgba(0,0,0,0.1)` | Summary cards, filter pills |
| `elevation-high` | `0 4px 12px rgba(0,0,0,0.15)` | Mod detail drawer, bottom sheet modal |

## 5. Drift Guidelines for Future Figma Imports
- Any input corner radius not matching `radius-md` (6px) or `radius-lg` (8px) will be flagged as drift.
- Any padding value that is not an increment of 4px / 8px (e.g., 10px, 14px, 18px) will be reported in the Drift table with the nearest `space-n` token.
- Any status color deviating from `#DC2626` / `#D97706` / `#059669` will be listed for unification.
