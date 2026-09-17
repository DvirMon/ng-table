---
id: sidebar-navigation
kind: layout
atomic: Organism
spec: specs/layout/Sidebar Navigation.md
frame: pages/Doc Article.dc.html
owns:
  - "Sidebar container: width, sticky, padding, right divider"
  - "Section label + section group spacing"
  - "The root ('Overview') item's own bottom margin"
  - "Filtering hidden entries and empty sections out of render"
does_not_own:
  - "The nav row itself (padding, active/hover/focus states) — see nav-item's own spec"
  - "The nav tree data — see docs/design-handoff/specs/Content Model.md"
  - "The mobile slide-over drawer, trigger, scrim, focus trap — deferred, not built this pass"
  - "Active-entry resolution from the current URL — no router wiring yet; caller passes `activeSlug`"
depends_on:
  - "nav-item (a[ngptNavItem])"
  - "foundations/Layout and Sizing.md (sidebar width, scroll offset)"
  - "foundations/Spacing.md"
  - "foundations/Color.md"
  - "foundations/Typography.md"
states:
  - "default (no activeSlug match — nothing active)"
  - "one entry active (accent border/bg on that row, root and section labels unaffected)"
a11y:
  - "role=\"navigation\" aria-label=\"Docs\" on the host — no wrapper <nav>, the component host is the landmark"
  - "aria-current=\"page\" comes from nav-item's own active-state host binding, not re-declared here"
tokens: [--ngpt-sys-layout-sidebar-width, --ngpt-sys-layout-scroll-offset, --ngpt-sys-space-700, --ngpt-sys-space-500, --ngpt-comp-row-divider, --ngpt-sys-typescale-label-large, --ngpt-sys-space-250, --ngpt-sys-typescale-label-small-alt, --ngpt-text-muted, --ngpt-sys-comp-nav-section-gap, --ngpt-sys-space-100]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

> Distributed here from the design handoff bundle (`apps/site/docs/design-handoff/specs/layout/Sidebar Navigation.md`) — spec wins over the reference frame there. Built desktop-only this pass; see `decisions.md`.

# Layout — Sidebar Navigation

Sticky left column of the docs 3-column shell. One root item ("Overview", no section), then repeating
section-label + row-group pairs, generated from the nav tree (`Content Model.md`) — never hand-authored
per page.

## Anatomy

```
<ngpt-sidebar-navigation>                 (sticky, width 270px)
├─ a[ngptNavItem].sidebar__root           (root entry, e.g. "Overview")
└─ (repeated per section)
   ├─ .sidebar__section-label             (uppercase heading)
   └─ .sidebar__section-group             (flex column, gap 4px)
      └─ a[ngptNavItem]                   (one per visible entry)
```

## Container

| Property | Value | Token |
| --- | --- | --- |
| position | sticky; top: 72px | --ngpt-sys-layout-scroll-offset |
| max-height | calc(100vh - 72px), overflow-y: auto | — |
| width | 270px | --ngpt-sys-layout-sidebar-width |
| padding | 28px 20px | --ngpt-sys-space-700 / --ngpt-sys-space-500 |
| border-right | 1px solid oklch(0.24 0.005 260) | --ngpt-comp-row-divider |
| font | 400 13.5px/1.4 Inter | --ngpt-sys-typescale-label-large |

## Section label

| Property | Value | Token |
| --- | --- | --- |
| font | 600 11px/1.3 Inter, uppercase, 0.05em | --ngpt-sys-typescale-label-small-alt |
| color | oklch(0.6 0.01 260) | --ngpt-text-muted |
| margin | 18px 0 4px | --ngpt-sys-comp-nav-section-gap / --ngpt-sys-space-100 |

## Empty-section rule

A section with zero visible entries (none authored, or all `hidden`) renders nothing — no label, no
group, no gap. Enforced by the component's `visibleSections` computed, not by template conditionals.

## Public API

| Input | Default | Notes |
| --- | --- | --- |
| `root` | `DOCS_NAV_ROOT` (mock) | The single entry rendered above any section |
| `sections` | `DOCS_NAV_SECTIONS` (mock) | Reusable-organism shape — same precedent as `tab-switcher`'s `tabs` input |
| `activeSlug` | `null` | Caller-supplied; no router wiring yet, so no default assumption about current URL |

## Out of scope this pass

Mobile slide-over drawer (trigger button, scrim, close button, focus trap, `Escape` handling) — needs
wiring into `navbar`'s currently-unwired hamburger button and the scrim recipe from
`foundations/Radius and Elevation.md`. Tracked as a follow-up, not started here.
