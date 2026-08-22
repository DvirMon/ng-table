---
id: page-footer
kind: layout
atomic: Molecule
spec: specs/layout/Page Footer.md
frame: components/Page Footer.dc.html
owns:
  - "Full-width footer below the grid: top divider, padding, muted text"
does_not_own:
  - "Prev/next page cards — that is Pagination Footer.md, which lives inside the content column"
depends_on:
  - "foundations/Color.md (color)"
  - "foundations/Typography.md (typography)"
states:
  - "default"
a11y:
  - "role=\"contentinfo\""
tokens: [--ngpt-sys-space-700, --ngpt-comp-row-divider, --ngpt-sys-typescale-label-large-sm, --ngpt-text-tertiary]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

> Distributed here from the design handoff bundle (`apps/ng-table/docs/design-handoff/`) during Wave 0 spec distribution — spec wins over the reference frame there.

# Layout — Page Footer

Full-width strip below the page grid (outside the 3-column layout, spans the whole viewport width).


## Container

| Property | Value | Token |
| --- | --- | --- |
| text-align | center | — |
| padding | 28px | --ngpt-sys-space-700 |
| border-top | 1px solid oklch(0.24 0.005 260) | --ngpt-comp-row-divider |
| font-size | 13px | --ngpt-sys-typescale-label-large-sm |
| color | oklch(0.62 0.01 260) | --ngpt-text-tertiary |



```html
<footer class="page-footer">Copyright © 2026 NGP Table</footer>
```


```css
.page-footer {
  text-align: center;
  padding: 28px;
  font-size: 13px;
  color: var(--ngpt-text-tertiary);
  border-top: 1px solid var(--ngpt-comp-row-divider, oklch(0.24 0.005 260));
}
```


The footer text was `oklch(0.5 0.01 260)`, which measured 3.24:1 at 13px and failed AA. It is now
`--ngpt-text-tertiary` (5.33:1) — the same token the body copy above it uses, since a copyright line at
body contrast is not a hierarchy problem.

Not to be confused with the **Pagination Footer** (prev/next cards) — that lives inside the Content Column, above this page-wide copyright strip.
