---
id: toc-column
kind: layout
atomic: Organism
spec: specs/layout/TOC Column.md
frame: components/TOC Column.dc.html
owns:
  - 'TOC column width, sticky offset, padding'
  - '"On this page" label'
  - 'TOC item + nested (H3) item styling'
does_not_own:
  - "Which headings appear — derived from the current article's own H2/H3, not authored here"
  - 'Scroll-spy active behavior — deferred, not built this pass'
depends_on:
  - 'foundations/Layout and Sizing.md (toc width, scroll offset)'
  - 'foundations/Typography.md'
  - 'foundations/Color.md'
states:
  - 'item default'
  - 'item hover'
  - 'item active (activeId input match — scroll-spy not wired)'
a11y:
  - 'aria-label="On this page" on the host'
  - 'active item gets aria-current="location"'
tokens:
  [
    --ngpt-sys-layout-toc-width,
    --ngpt-sys-space-900,
    --ngpt-sys-space-500,
    --ngpt-sys-typescale-label-large-sm,
    --ngpt-sys-typescale-label-small-alt,
    --ngpt-sys-space-100,
    --ngpt-sys-space-225,
    --ngpt-sys-space-250,
    --ngpt-text-muted,
    --ngpt-text-secondary,
    --ngpt-bg-hover,
    --ngpt-accent,
    --ngpt-comp-toc-nested-indent,
    --ngpt-comp-toc-nested-text,
    --ngpt-sys-typescale-label-small-2,
    --ngpt-sys-layout-scroll-offset,
  ]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

> Distributed here from the design handoff bundle (`apps/site/docs/design-handoff/specs/layout/TOC Column.md`) — spec wins over the reference frame there. Built desktop-only this pass, mock headings, no scroll-spy; see `decisions.md`.

# Layout — TOC Column ("On this page")

Right column of the page grid. Mirrors the sidebar's nav-item visual treatment but scrolls within one
article instead of navigating pages.

## Anatomy

```
<ngpt-toc-column>                 (sticky, width 220px)
├─ .toc__label                    ("On this page")
└─ .toc__list                     (flex column, gap 4px)
   └─ a.toc__item                 (one per heading, [data-nested] for H3)
```

## Public API

| Input      | Default                    | Notes                                                                                  |
| ---------- | -------------------------- | -------------------------------------------------------------------------------------- |
| `headings` | `TOC_MOCK_HEADINGS` (mock) | Real data is always derived from the current article's own H2/H3 — never hand-authored |
| `activeId` | `null`                     | Caller-supplied; scroll-spy (`IntersectionObserver`) not implemented this pass         |

## Out of scope this pass

Scroll-spy (`IntersectionObserver` tracking which heading has passed the scroll offset), smooth-scroll on
click, and the `md` breakpoint drop. There's no real scrollable article to observe yet — tracked as a
follow-up once `Content Prose` articles exist.
