---
id: toc
kind: layout
atomic: Organism
spec: specs/layout/TOC Column.md
frame: components/TOC Column.dc.html
owns:
  - 'TOC column width, sticky offset, padding'
  - '"On this page" label'
  - 'TOC item + nested (H3) item styling'
  - 'Scroll-spy active behavior'
does_not_own:
  - 'Which headings appear — derived from Content Prose H2/H3'
depends_on:
  - 'Content Prose.md (prose)'
  - 'foundations/Typography.md (typography)'
  - 'foundations/Motion.md (motion)'
  - 'foundations/Color.md (color)'
states:
  - 'item default'
  - 'item hover'
  - 'item active (scroll-spy)'
  - 'hidden below lg'
a11y:
  - 'aria-label="On this page"; active item gets aria-current="location"'
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

# Layout — TOC Column ("On this page")

The right column of the page grid. Mirrors the sidebar's nav-item visual treatment but drives scroll-to-section instead of page navigation.

## Container

| Property          | Value     | Token                                     |
| ----------------- | --------- | ----------------------------------------- |
| Grid column width | 220px     | --ngpt-sys-layout-toc-width               |
| padding           | 36px 20px | --ngpt-sys-space-900 --ngpt-sys-space-500 |
| font-size (base)  | 13px      | --ngpt-sys-typescale-label-large-sm       |

## Structure

| Property               | Value                                               | Token                                     |
| ---------------------- | --------------------------------------------------- | ----------------------------------------- |
| Label ("On this page") | 11px / 600 / uppercase / 0.05em, 10px margin-bottom | --ngpt-sys-typescale-label-small-alt      |
| Item list gap          | 4px                                                 | --ngpt-sys-space-100                      |
| Item padding           | 9px 10px                                            | --ngpt-sys-space-225 --ngpt-sys-space-250 |

```html
<aside class="toc">
  <div class="toc-label">On this page</div>
  <div class="toc-list">
    <a class="toc-item" href="#sec-tech">Technology Stack</a>
    <a class="toc-item is-active" href="#sec-ui">Layer 1 — UI Layer</a>
    <!-- … -->
  </div>
</aside>
```

```css
.toc {
  padding: 36px 20px;
  font-size: 13px;
}
.toc-label {
  font:
    600 11px Inter,
    sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ngpt-text-muted);
  margin-bottom: 10px;
}
.toc-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.toc-item {
  padding: 9px 10px;
  border-left: 2px solid transparent;
  color: var(--ngpt-text-muted);
  text-decoration: none;
}
.toc-item:hover {
  color: var(--ngpt-text-secondary);
  background: var(--ngpt-bg-hover);
}
.toc-item.is-active {
  color: var(--ngpt-accent);
  border-left-color: var(--ngpt-accent);
}
.toc-item--nested {
  padding-left: var(--ngpt-comp-toc-nested-indent, 22px);
  font-size: 12.5px;
  color: var(--ngpt-comp-toc-nested-text, oklch(0.6 0.01 260));
}
```

## Nested items (H3)

The TOC lists H2 and H3 only. H4 is omitted — at 220px wide, a third indent level wraps every label.

| Property                | Value                                      | Token                                |
| ----------------------- | ------------------------------------------ | ------------------------------------ |
| H3 item padding-left    | 22px (vs 10px for H2)                      | `--ngpt-comp-toc-nested-indent`      |
| H3 item font-size       | 12.5px                                     | `--ngpt-sys-typescale-label-small-2` |
| H3 item color (default) | oklch(0.6 0.01 260)                        | `--ngpt-comp-toc-nested-text`        |
| H3 active treatment     | Same accent text + left border as H2 items | `--ngpt-accent`                      |

## Sticky behavior

The TOC is `position: sticky` at `top: var(--ngpt-sys-layout-scroll-offset)` (72px — the 56px navbar plus
16px of clearance; see `foundations/Layout and Sizing.md`) with
`max-height: calc(100vh - var(--ngpt-sys-layout-scroll-offset))` and `overflow-y: auto`.

Sticky, not scroll-with-page: the TOC's whole purpose is jumping between sections of a long article, and
a TOC that has scrolled away cannot be used for the part of the article where it matters most. The
max-height plus its own scroll is what makes that safe — a heading list longer than the viewport scrolls
within the column instead of being clipped.

When the list fits, no scrollbar appears and the column reads as static. Scroll-spy still drives the
active item; the sticky container only changes where the list sits.

## Scroll-spy

Active item = the last heading whose top edge has passed `--ngpt-sys-layout-scroll-offset`. Implement with an IntersectionObserver whose root margin matches that offset; do not recompute on every scroll event.

Edge cases: at the very top of the page, before any heading passes the line, the first item is active. At the bottom, the last heading stays active even if it is short — never leave zero items active.

Scroll offset is shared with heading anchors (`specs/Content Prose.md`) so clicking a TOC item and pasting a `#hash` URL land in the same place.

Behavior: clicking an item smooth-scrolls the content column so the target heading sits at the scroll offset, and marks that item active. Labels wrap; they are never truncated or ellipsised — a clipped heading is not a usable target. Dropped entirely below the `md` breakpoint (1024px) — see `Responsive and Breakpoints.md`.
