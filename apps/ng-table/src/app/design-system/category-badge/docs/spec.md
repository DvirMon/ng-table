---
id: category-badge
kind: component
atomic: Atom
spec: specs/Category Badge.md
frame: components/Category Badge.dc.html
owns:
  - "Uppercase accent eyebrow that sits above an H1"
does_not_own: []
depends_on:
  - "foundations/Typography.md (typography)"
  - "foundations/Color.md (color)"
states:
  - "default"
a11y:
  - "Purely visual; do not use as the accessible heading"
tokens: [--ngpt-sys-typescale-label-small, --ngpt-accent, --ngpt-sys-comp-eyebrow-gap]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

> Distributed here from the design handoff bundle (`apps/ng-table/docs/design-handoff/`) during Wave 0 spec distribution — spec wins over the reference frame there.

# Category Badge (eyebrow)

**Atomic level:** Atom

Small uppercase label sitting above an H1 to indicate section/category (e.g. "PRIMITIVES").

## Composition

- Single uppercase text run

## Build spec

| Property | Value | Token |
|---|---|---|
| Font | Inter, 12px / 700, uppercase | `--ngpt-sys-typescale-label-small` |
| Letter spacing | 0.08em | `—` |
| Color | oklch(0.62 0.19 52) | `--ngpt-accent` |
| Margin | 0 0 6px (sits directly above H1) | `--ngpt-sys-comp-eyebrow-gap` |
| Text | The resolved `eyebrow` from `Routing and Page State.md` (`entry.eyebrow ?? section.label`), uppercased by CSS | `—` |


## HTML/CSS mock

```html
<div class="eyebrow">Primitives</div>
```

```css
.eyebrow {
  font: var(--ngpt-sys-typescale-label-small);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ngpt-accent);
  margin: 0 0 6px;
}
```
