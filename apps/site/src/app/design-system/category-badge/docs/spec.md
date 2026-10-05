---
id: category-badge
kind: component
atomic: Atom
spec: specs/Category Badge.md
frame: components/Category Badge.dc.html
owns:
  - 'Uppercase accent eyebrow that sits above an H1'
does_not_own: []
depends_on:
  - 'foundations/Typography.md (typography)'
  - 'foundations/Color.md (color)'
states:
  - 'default'
a11y:
  - 'Purely visual; do not use as the accessible heading'
tokens: [--ngpt-sys-typescale-label-small, --ngpt-accent, --ngpt-sys-comp-eyebrow-gap]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

> Distributed here from the design handoff bundle (`apps/site/docs/design-handoff/`) during Wave 0 spec distribution — spec wins over the reference frame there.

# Category Badge (eyebrow)

**Atomic level:** Atom

Small uppercase label sitting above an H1 to indicate section/category (e.g. "PRIMITIVES").

## Composition

- Single uppercase text run

## Build spec

| Property       | Value                                                                                                         | Token                              |
| -------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Font           | Inter, 12px / 700, uppercase                                                                                  | `--ngpt-sys-typescale-label-small` |
| Letter spacing | 0.08em                                                                                                        | `—`                                |
| Color          | oklch(0.68 0.22 328)                                                                                          | `--ngpt-accent`                    |
| Margin         | 0 0 6px (sits directly above H1)                                                                              | `--ngpt-sys-comp-eyebrow-gap`      |
| Text           | The resolved `eyebrow` from `Routing and Page State.md` (`entry.eyebrow ?? section.label`), uppercased by CSS | `—`                                |

## API

Attribute-hosted on the consumer's own `<span>` (ADR-0005) — no wrapper element ships. `<span>`
rather than a semantic element because the a11y note above requires the eyebrow to add no meaning
of its own; `:host` promotes it to `display: block`.

|                 |                            |
| --------------- | -------------------------- |
| Selector        | `span[ngptCategoryBadge]`  |
| Inputs          | none — projected text only |
| Outputs         | none                       |
| Host attributes | none                       |

```html
<span ngptCategoryBadge>Primitives</span>
<h1>…</h1>
```

## HTML/CSS mock

The reference mock below predates ADR-0005. It ships as the API above: the `.eyebrow` class becomes
the `ngptCategoryBadge` attribute on a `<span>` and its rules live on `:host`. The mock's `<div>` is
not the shipped element — both are non-semantic, and the block layout it implies is preserved by
`display: block`.

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
