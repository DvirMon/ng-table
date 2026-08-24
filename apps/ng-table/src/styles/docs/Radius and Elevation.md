---
id: shape
kind: foundation
atomic: Token
spec: specs/foundations/Radius and Elevation.md
frame: null
owns:
  - "Corner radius scale"
  - "Elevation (shadow) levels"
  - "z-index ladder"
  - "Scrim color + blur"
  - "The floating-surface recipe shared by Dropdown Menu and Search overlay"
does_not_own:
  - "Which surface floats at which level — the component spec picks a z token"
depends_on:
  - "foundations/Color.md (color)"
states: []
a11y: []
tokens: [--ngpt-sys-shape-corner-none, --ngpt-sys-shape-corner-extra-small, --ngpt-sys-shape-corner-extra-small-alt, --ngpt-sys-shape-corner-small, --ngpt-sys-shape-corner-small-alt, --ngpt-sys-shape-corner-medium, --ngpt-sys-shape-corner-large, --ngpt-sys-shape-corner-full, --ngpt-sys-elevation-level0, --ngpt-sys-elevation-level1, --ngpt-sys-elevation-level2, --ngpt-bg-elevated, --ngpt-sys-scrim, --ngpt-sys-z-base, --ngpt-sys-z-navbar, --ngpt-sys-z-drawer-scrim, --ngpt-sys-z-drawer, --ngpt-sys-z-popover, --ngpt-sys-z-modal-scrim, --ngpt-sys-z-modal, --ngpt-border-subtle, --ngpt-bg-hover, --ngpt-bg-active]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

> Distributed here from the design handoff bundle (`apps/ng-table/docs/design-handoff/`) during Wave 0 spec distribution — this is the single source of truth for its token `:root` block; `src/styles/tokens/` mirrors it verbatim.

# Foundations — Radius, Elevation & Overlays

Shape tokens follow Material 3's corner-radius scale naming. Elevation in this UI is expressed almost entirely through borders rather than shadows — only level2 is a proposed extension.

## Shape (corner radius)

| Token | Value | Usage |
| --- | --- | --- |
| --ngpt-sys-shape-corner-none | 0px | Active nav row (flush left border) |
| --ngpt-sys-shape-corner-extra-small | 4px | Inline code chip |
| --ngpt-sys-shape-corner-extra-small-alt | 6px | Small buttons, tab pills |
| --ngpt-sys-shape-corner-small | 8px | Icon buttons, tab-group track |
| --ngpt-sys-shape-corner-small-alt | 10px | Cards, code blocks, tables |
| --ngpt-sys-shape-corner-medium | 12px | Preview window canvas |
| --ngpt-sys-shape-corner-large | 20px | Sponsor pill, config dropdown |
| --ngpt-sys-shape-corner-full | 24px (pill) | Select / combobox trigger |

## Elevation

| Token | Value | Usage |
| --- | --- | --- |
| --ngpt-sys-elevation-level0 | none | Flat surfaces — page bg, sidebar, content |
| --ngpt-sys-elevation-level1 | none (border only) | Cards, code blocks, tables |
| --ngpt-sys-elevation-level2 | 0 8px 24px oklch(0 0 0 / 0.35) | Dropdown menu, search panel — every floating surface |

```css
:root {
  --ngpt-sys-shape-corner-none: 0px;
  --ngpt-sys-shape-corner-extra-small: 4px;
  --ngpt-sys-shape-corner-extra-small-alt: 6px;
  --ngpt-sys-shape-corner-small: 8px;
  --ngpt-sys-shape-corner-small-alt: 10px;
  --ngpt-sys-shape-corner-medium: 12px;
  --ngpt-sys-shape-corner-large: 20px;
  --ngpt-sys-shape-corner-full: 24px;
  --ngpt-sys-elevation-level0: none;
  --ngpt-sys-elevation-level1: none;
  --ngpt-sys-elevation-level2: 0 8px 24px oklch(0 0 0 / 0.35);
  --ngpt-bg-elevated: oklch(0.2 0.005 260);
  --ngpt-sys-scrim: rgba(9, 10, 17, 0.8);
  --ngpt-sys-z-base: 0;
  --ngpt-sys-z-navbar: 10;
  --ngpt-sys-z-drawer-scrim: 25;
  --ngpt-sys-z-drawer: 30;
  --ngpt-sys-z-popover: 40;
  --ngpt-sys-z-modal-scrim: 50;
  --ngpt-sys-z-modal: 60;
}
```

## Layering (z-index scale)

One scale, no ad-hoc values. Anything floating picks a step from this table; nothing invents its own.

| Token | Value | Layer |
| --- | --- | --- |
| --ngpt-sys-z-base | 0 | Page content, sidebar, TOC |
| --ngpt-sys-z-navbar | 10 | Sticky top navbar |
| --ngpt-sys-z-drawer-scrim | 25 | Mobile drawer scrim |
| --ngpt-sys-z-drawer | 30 | Mobile sidebar drawer |
| --ngpt-sys-z-popover | 40 | Dropdown menu, select listbox, tooltip |
| --ngpt-sys-z-modal-scrim | 50 | Search overlay scrim |
| --ngpt-sys-z-modal | 60 | Search panel |

Popovers sit above the drawer so a select inside the mobile drawer still works. The search overlay sits above everything, including the navbar it was opened from.

The drawer (30) also covers the navbar (10) that opened it, hamburger included. That is intended: the
drawer carries its own header with the logo and a close button (`layout/Sidebar Navigation.md` § Mobile
variant), so the bar underneath has nothing left to offer while it is open.

## Floating surface recipe

Every non-scrim floating surface in the system — dropdown menu, select listbox, search panel — is the same box:

| Property | Value | Token |
| --- | --- | --- |
| Background | oklch(0.2 0.005 260) | --ngpt-bg-elevated |
| Border | 1px solid oklch(0.26 0.005 260) | --ngpt-border-subtle |
| Radius | 10px (12px for the search panel) | --ngpt-sys-shape-corner-small-alt / -medium |
| Shadow | level2 | --ngpt-sys-elevation-level2 |

Elevated surfaces sit at 0.20 against a 0.16 page, so the global `--ngpt-bg-hover` (also 0.20) is invisible on them. Rows inside a floating surface use `--ngpt-bg-active` (0.24) for hover instead — see `specs/Dropdown Menu.md`.

## Scrim

| Property | Value | Token |
| --- | --- | --- |
| Fill | rgba(9, 10, 17, 0.8) | --ngpt-sys-scrim |
| Backdrop filter | none | — |

Shared by the mobile drawer (not yet built) and the search overlay. Clicking a scrim always
dismisses what it sits under, and whatever it covers is scroll-locked.

**2026-08-23:** changed from a translucent `oklch(0 0 0 / 0.5)` fill + 2px blur to a solid,
unblurred fill, matched against a live scrape of the Angular Primitives reference overlay — see
`apps/ng-table/src/app/design-system/search/docs/decisions.md` § scrim token. `--ngpt-sys-scrim-blur`
was removed entirely (the reference has no blur, permanently, not a variable value) — the mobile
drawer, when built, should not reintroduce it.
