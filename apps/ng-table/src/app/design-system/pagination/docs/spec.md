---
id: pagination
kind: component
atomic: Molecule
spec: specs/Pagination Footer.md
frame: components/Pagination Footer.dc.html
owns:
  - "Prev/next card pair at the end of the content column: border, radius, eyebrow, title, arrow shift on hover"
does_not_own:
  - "The site-wide footer — see layout/Page Footer.md"
depends_on:
  - "foundations/Color.md (color)"
  - "foundations/Radius and Elevation.md (shape)"
  - "foundations/Motion.md (motion)"
  - "foundations/Typography.md (typography)"
states:
  - "default"
  - "hover (arrow shifts)"
  - "focus-visible"
  - "prev-only"
  - "next-only"
a11y:
  - "nav element with aria-label=\"Pagination\"; the eyebrow gives the direction in text"
tokens: [--ngpt-sys-space-400, --ngpt-sys-space-350, --ngpt-sys-space-450, --ngpt-sys-shape-corner-small-alt, --ngpt-comp-pagination-border, --ngpt-sys-typescale-label-small-2, --ngpt-text-muted, --ngpt-sys-space-100, --ngpt-sys-typescale-body-medium, --ngpt-comp-pagination-title-default, --ngpt-accent, --ngpt-bg-hover, --ngpt-comp-pagination-arrow-shift]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

> Distributed here from the design handoff bundle (`apps/ng-table/docs/design-handoff/`) during Wave 0 spec distribution — spec wins over the reference frame there.

# Pagination Footer

**Atomic level:** Molecule

Previous/Next link cards at the bottom of a docs page. Title text is neutral by default; accent color and arrow-shift only appear on hover, and the whole card (not just the text) is the hover target.

## Composition

- Eyebrow row: direction arrow + "Previous"/"Next" label
- Title row: page name

## States

| State | Trigger | Visual change |
|---|---|---|
| Default | — | Neutral title text, no bg |
| Hover | Pointer anywhere in card | Bg lifts, title turns accent, arrow shifts 3px toward its direction |

## Build spec

| Property | Value | Token |
|---|---|---|
| Layout | flex row, 16px gap, two equal-width cards | `--ngpt-sys-space-400` |
| Card padding | 14px 18px | `--ngpt-sys-space-350 --ngpt-sys-space-450` |
| Card radius | 10px | `--ngpt-sys-shape-corner-small-alt` |
| Card border | 1px solid oklch(0.28 0.005 260) | `--ngpt-comp-pagination-border` |
| Eyebrow font | 12.5px | `--ngpt-sys-typescale-label-small-2` |
| Eyebrow color | oklch(0.55 0.01 260) | `--ngpt-text-muted` |
| Eyebrow-to-title gap | 4px | `--ngpt-sys-space-100` |
| Title font (default) | 14.5px / 600 | `--ngpt-sys-typescale-title-small` |
| Title color (default) | oklch(0.9 0.005 260) | `--ngpt-comp-pagination-title-default` |
| Title color (hover) | oklch(0.62 0.19 52) | `--ngpt-accent` |
| Card bg (hover) | oklch(0.2 0.005 260) | `--ngpt-bg-hover` |
| Arrow transform (hover) | translateX(±3px), fast / standard | `--ngpt-comp-pagination-arrow-shift` + `foundations/Motion.md` |
| Alignment | Previous card left-aligned; Next card right-aligned | `—` |


## One side only

At the ends of the tree one side is `null` (`Content Model.md` § Order). The remaining card keeps its
own half of the row and its own alignment — a prev-only footer is one left-aligned card on the left, a
next-only footer one right-aligned card on the right. The empty half stays empty rather than the card
stretching across it, so the direction stays readable at a glance.

## HTML/CSS mock

```html
<div class="pagination-footer">
  <a class="page-card page-card--prev" href="#">
    <div class="page-card__eyebrow"><span class="arrow">←</span> Previous</div>
    <div class="page-card__title">Getting Started</div>
  </a>
  <a class="page-card page-card--next" href="#">
    <div class="page-card__eyebrow">Next <span class="arrow">→</span></div>
    <div class="page-card__title">State Layer Architecture</div>
  </a>
</div>
```

```css
.pagination-footer { display: flex; gap: 16px; padding-top: 24px; border-top: 1px solid var(--ngpt-comp-row-divider); }
.page-card {
  flex: 1;
  border: 1px solid var(--ngpt-comp-pagination-border);
  border-radius: 10px;
  padding: 14px 18px;
  text-decoration: none;
}
.page-card--next { text-align: right; }
.page-card__eyebrow {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: var(--ngpt-text-muted);
  margin-bottom: 4px;
}
.page-card--next .page-card__eyebrow { justify-content: flex-end; }
.page-card__title {
  font: var(--ngpt-sys-typescale-title-small);
  color: var(--ngpt-comp-pagination-title-default);
}
.arrow {
  display: inline-block;
  transition: transform var(--ngpt-sys-motion-duration-fast) var(--ngpt-sys-motion-easing-standard);
}
.page-card:hover { background: var(--ngpt-bg-hover); }
.page-card:hover .page-card__title { color: var(--ngpt-accent); }
.page-card--prev:hover .arrow { transform: translateX(calc(-1 * var(--ngpt-comp-pagination-arrow-shift))); }
.page-card--next:hover .arrow { transform: translateX(var(--ngpt-comp-pagination-arrow-shift)); }
```
