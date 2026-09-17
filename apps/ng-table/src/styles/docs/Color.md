---
id: color
kind: foundation
atomic: Token
spec: specs/foundations/Color.md
frame: null
owns:
  - "Every color value in the system, as CSS custom properties on :root — including every --ngpt-comp-* color a component spec cites"
does_not_own:
  - "Where colors are applied — component specs decide that"
  - "Light theme (system is dark-only by design)"
depends_on: []
states: []
a11y:
  - "Every text-on-surface pair in this file meets WCAG AA (4.5:1) at the size the owning spec sets, except --ngpt-comp-menu-text-disabled (disabled text, exempt under 1.4.3) and --ngpt-comp-code-gutter-text at 4.78:1 which passes"
tokens: [--ngpt-bg-app, --ngpt-bg-deep, --ngpt-bg-surface, --ngpt-bg-raised, --ngpt-bg-row, --ngpt-bg-hover, --ngpt-bg-active, --ngpt-bg-elevated, --ngpt-comp-tab-item-active-bg, --ngpt-comp-tab-track-bg, --ngpt-bg-code-chip, --ngpt-border-subtle, --ngpt-border-strong, --ngpt-comp-control-border-default, --ngpt-comp-pill-border-default, --ngpt-comp-pill-border-hover, --ngpt-comp-pagination-border, --ngpt-comp-row-divider, --ngpt-text-base, --ngpt-text-primary, --ngpt-text-secondary, --ngpt-text-tertiary, --ngpt-text-muted, --ngpt-comp-nav-text-default, --ngpt-comp-dropdown-text, --ngpt-comp-tab-text-inactive, --ngpt-comp-select-placeholder, --ngpt-comp-menu-text-disabled, --ngpt-comp-pagination-title-default, --ngpt-comp-toc-nested-text, --ngpt-comp-code-gutter-text, --ngpt-accent, --ngpt-accent-surface, --ngpt-accent-bg, --ngpt-comp-link-hover, --ngpt-onband-fill, --ngpt-onband-fill-inverse, --ngpt-navbar-scrolled, --ngpt-focus-ring, --ngpt-status-success, --ngpt-status-warning, --ngpt-status-error, --ngpt-status-neutral, --ngpt-comp-callout-note-bg, --ngpt-comp-callout-note-border, --ngpt-comp-callout-note-accent, --ngpt-comp-callout-warning-bg, --ngpt-comp-callout-warning-border, --ngpt-comp-callout-tip-bg, --ngpt-comp-callout-tip-border]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

> Distributed here from the design handoff bundle (`apps/ng-table/docs/design-handoff/`) during Wave 0 spec distribution — this is the single source of truth for its token `:root` block; `src/styles/tokens/` mirrors it verbatim.

# Foundations — Color

Cool-neutral dark scale + one accent hue (magenta, 328°) held at fixed chroma/lightness for state tints. No separate "primary" — every colored element in the source uses this one accent at varying lightness/chroma.

Component-scoped colors (`--ngpt-comp-*`) live here too. A component spec picks which token it uses; it never declares the value.

## Surfaces

| Token | Value | Usage |
| --- | --- | --- |
| --ngpt-bg-app | oklch(0.16 0.005 260) | Page background |
| --ngpt-bg-deep | oklch(0.11 0.004 260) | Navbar, code block background |
| --ngpt-bg-surface | oklch(0.13 0.004 260) | Preview canvas |
| --ngpt-bg-raised | oklch(0.17 0.005 260) | Input / trigger fill |
| --ngpt-bg-row | oklch(0.19 0.005 260) | Table header row |
| --ngpt-bg-hover | oklch(0.2 0.005 260) | Nav item + control hover fill (single canonical value) |
| --ngpt-bg-elevated | oklch(0.2 0.005 260) | Floating surfaces — dropdown menu, search panel. Same value as hover, which is why rows inside them hover at `--ngpt-bg-active`; see `foundations/Radius and Elevation.md` |
| --ngpt-bg-active | oklch(0.24 0.005 260) | Nav item active (neutral); row hover inside a floating surface |
| --ngpt-comp-tab-track-bg | oklch(0.22 0.005 260) | Tab Switcher track |
| --ngpt-comp-tab-item-active-bg | oklch(0.3 0.005 260) | Tab Switcher active item only — needs extra lift against its 0.22 track |
| --ngpt-bg-code-chip | oklch(0.24 0.005 260) | Inline code chip background |

## Borders

| Token | Value | Usage |
| --- | --- | --- |
| --ngpt-border-subtle | oklch(0.26 0.005 260) | Card / divider borders |
| --ngpt-comp-row-divider | oklch(0.24 0.005 260) | Table row divider, sidebar right edge, footer top edge |
| --ngpt-comp-pagination-border | oklch(0.28 0.005 260) | Pagination card border |
| --ngpt-comp-control-border-default | oklch(0.3 0.005 260) | Icon button / dropdown pill / search field / preview toolbar borders |
| --ngpt-comp-pill-border-default | oklch(0.32 0.005 260) | Pill button default border |
| --ngpt-border-strong | oklch(0.34 0.005 260) | Select trigger default border |
| --ngpt-comp-pill-border-hover | oklch(0.45 0.005 260) | Control hover border |

## Text

Ratios are against `--ngpt-bg-app` unless noted.

| Token | Value | Contrast | Usage |
| --- | --- | --- | --- |
| --ngpt-text-primary | oklch(1 0 0) | 17.0 | Headings, active label text |
| --ngpt-text-secondary | oklch(0.85 0.01 260) | 11.6 | Body emphasis, hovered nav text, code text, keyboard chips |
| --ngpt-comp-nav-text-default | oklch(0.78 0.005 260) | 9.7 | Sidebar nav item, resting |
| --ngpt-comp-dropdown-text | oklch(0.75 0.01 260) | 8.7 | Dropdown pill label |
| --ngpt-comp-pagination-title-default | oklch(0.9 0.005 260) | 14.4 | Pagination card title, resting |
| --ngpt-comp-tab-text-inactive | oklch(0.64 0.01 260) | 5.2 on the 0.22 track | Tab switcher inactive item |
| --ngpt-text-tertiary | oklch(0.62 0.01 260) | 5.3 | Paragraph body, table description column, footer, menu options |
| --ngpt-text-muted | oklch(0.6 0.01 260) | 4.9 | Section labels, eyebrows on cards, placeholders, group labels, result second lines |
| --ngpt-comp-select-placeholder | oklch(0.6 0.01 260) | 4.9 on 0.17 raised | Select trigger placeholder |
| --ngpt-comp-toc-nested-text | oklch(0.6 0.01 260) | 4.9 | H3 items in the TOC |
| --ngpt-comp-code-gutter-text | oklch(0.58 0.005 260) | 4.8 on 0.11 deep | Code block line numbers |
| --ngpt-comp-menu-text-disabled | oklch(0.42 0.005 260) | 2.1 on 0.2 elevated | Disabled menu option — exempt under WCAG 1.4.3 |
| --ngpt-text-base | oklch(0.92 0.005 260) | 15.3 | Page shell inherited text color |

`--ngpt-text-muted` was 0.55 and measured 3.4–4.0:1 across the surfaces it is used on, which failed AA at
every size it appears at. It is now 0.60. Its distance from `--ngpt-text-tertiary` is small on purpose:
the two are separated by role, not by much lightness, because there is no darker step that reads as text
on a 0.16 page.

## Accent and state

| Token | Value | Usage |
| --- | --- | --- |
| --ngpt-accent | oklch(0.68 0.22 328) | Active state, links, icons, category badge. 6.0 on `--ngpt-bg-app`. This is the **text** tier — never fill a surface with it: white on it is only 3.2:1. |
| --ngpt-comp-link-hover | oklch(0.74 0.19 328) | Prose link hover. 7.7 on `--ngpt-bg-app` |
| --ngpt-accent-surface | oklch(0.55 0.25 328) | Full-bleed accent band. Marketing hero only — `pages/Home.md`. Never on a docs page. The **fill** tier, darker than `--ngpt-accent` on purpose: white on it reaches 5.60:1, where the text tier would fail at 3.2:1. Body copy on it must be full white, never a reduced alpha. |
| --ngpt-accent-bg | oklch(0.2 0.05 328) | Active nested-item tint. `--ngpt-accent` text on it measures 5.71:1; at 1.06 against the 0.16 page it still reads as a tint. |
| --ngpt-bg-accent-solid | `var(--ngpt-accent-surface)` | Solid on-accent row fill — search overlay active row. Aliases the fill tier, not `--ngpt-accent`. |
| --ngpt-text-on-accent | white | Text/icons over `--ngpt-bg-accent-solid`. 5.60:1. Was a near-black neutral under the old orange accent, where white failed at 3.9:1 — the darker magenta inverts that result. |
| --ngpt-onband-fill | white | Primary action on the accent band — see `Pill Button.md` |
| --ngpt-onband-fill-inverse | oklch(0.18 0.02 328) | Secondary action on the accent band |
| --ngpt-navbar-scrolled | #18181C | Home navbar once scrolled past the hero band. Deliberately not `--ngpt-bg-deep` — it must read as a distinct bar against the dark sections beneath it. Marketing page only. |
| --ngpt-focus-ring | oklch(0.68 0.22 328 / 0.6) | Keyboard focus ring — tracks `--ngpt-accent` |
| --ngpt-status-success | oklch(0.75 0.13 150) | "Active" status text; copy-confirmed glyph |
| --ngpt-status-warning | oklch(0.8 0.12 85) | "Pending" status text; warning callout icon + title |
| --ngpt-status-error | oklch(0.7 0.19 25) | Failure state — the copy affordance's failed glyph. 7.0 on `--ngpt-bg-deep` |
| --ngpt-status-neutral | oklch(0.6 0.01 260) | "Inactive" status text |

## Callout tints

`--ngpt-status-*` extended from typographic-only into surface tints, chroma held at 0.03 for backgrounds
and 0.06 for borders so the tint reads as tone rather than color.

| Token | Value | Usage |
| --- | --- | --- |
| --ngpt-comp-callout-note-bg | oklch(0.19 0.005 260) | Note surface |
| --ngpt-comp-callout-note-border | oklch(0.28 0.005 260) | Note border |
| --ngpt-comp-callout-note-accent | oklch(0.7 0.01 260) | Note icon + title |
| --ngpt-comp-callout-warning-bg | oklch(0.21 0.03 85) | Warning surface |
| --ngpt-comp-callout-warning-border | oklch(0.34 0.06 85) | Warning border |
| --ngpt-comp-callout-tip-bg | oklch(0.21 0.03 150) | Tip surface |
| --ngpt-comp-callout-tip-border | oklch(0.34 0.06 150) | Tip border |

```css
:root {
  /* surfaces */
  --ngpt-bg-app: oklch(0.16 0.005 260);
  --ngpt-bg-deep: oklch(0.11 0.004 260);
  --ngpt-bg-surface: oklch(0.13 0.004 260);
  --ngpt-bg-raised: oklch(0.17 0.005 260);
  --ngpt-bg-row: oklch(0.19 0.005 260);
  --ngpt-bg-hover: oklch(0.2 0.005 260);
  --ngpt-bg-elevated: oklch(0.2 0.005 260);
  --ngpt-bg-active: oklch(0.24 0.005 260);
  --ngpt-comp-tab-track-bg: oklch(0.22 0.005 260);
  --ngpt-comp-tab-item-active-bg: oklch(0.3 0.005 260);
  --ngpt-bg-code-chip: oklch(0.24 0.005 260);

  /* borders */
  --ngpt-border-subtle: oklch(0.26 0.005 260);
  --ngpt-comp-row-divider: oklch(0.24 0.005 260);
  --ngpt-comp-pagination-border: oklch(0.28 0.005 260);
  --ngpt-comp-control-border-default: oklch(0.3 0.005 260);
  --ngpt-comp-pill-border-default: oklch(0.32 0.005 260);
  --ngpt-border-strong: oklch(0.34 0.005 260);
  --ngpt-comp-pill-border-hover: oklch(0.45 0.005 260);

  /* text */
  --ngpt-text-primary: oklch(1 0 0);
  --ngpt-text-secondary: oklch(0.85 0.01 260);
  --ngpt-text-base: oklch(0.92 0.005 260);
  --ngpt-comp-pagination-title-default: oklch(0.9 0.005 260);
  --ngpt-comp-nav-text-default: oklch(0.78 0.005 260);
  --ngpt-comp-dropdown-text: oklch(0.75 0.01 260);
  --ngpt-comp-tab-text-inactive: oklch(0.64 0.01 260);
  --ngpt-text-tertiary: oklch(0.62 0.01 260);
  --ngpt-text-muted: oklch(0.6 0.01 260);
  --ngpt-comp-select-placeholder: oklch(0.6 0.01 260);
  --ngpt-comp-toc-nested-text: oklch(0.6 0.01 260);
  --ngpt-comp-code-gutter-text: oklch(0.58 0.005 260);
  --ngpt-comp-menu-text-disabled: oklch(0.42 0.005 260);

  /* accent + state */
  --ngpt-accent: oklch(0.68 0.22 328);
  --ngpt-comp-link-hover: oklch(0.74 0.19 328);
  --ngpt-accent-surface: oklch(0.55 0.25 328);
  --ngpt-accent-bg: oklch(0.2 0.05 328);
  --ngpt-bg-accent-solid: var(--ngpt-accent-surface);
  --ngpt-text-on-accent: oklch(1 0 0);
  --ngpt-onband-fill: white;
  --ngpt-onband-fill-inverse: oklch(0.18 0.02 328);
  --ngpt-navbar-scrolled: #18181C;
  --ngpt-focus-ring: oklch(0.68 0.22 328 / 0.6);
  --ngpt-status-success: oklch(0.75 0.13 150);
  --ngpt-status-warning: oklch(0.8 0.12 85);
  --ngpt-status-error: oklch(0.7 0.19 25);
  --ngpt-status-neutral: oklch(0.6 0.01 260);

  /* callout tints */
  --ngpt-comp-callout-note-bg: oklch(0.19 0.005 260);
  --ngpt-comp-callout-note-border: oklch(0.28 0.005 260);
  --ngpt-comp-callout-note-accent: oklch(0.7 0.01 260);
  --ngpt-comp-callout-warning-bg: oklch(0.21 0.03 85);
  --ngpt-comp-callout-warning-border: oklch(0.34 0.06 85);
  --ngpt-comp-callout-tip-bg: oklch(0.21 0.03 150);
  --ngpt-comp-callout-tip-border: oklch(0.34 0.06 150);
}
```
