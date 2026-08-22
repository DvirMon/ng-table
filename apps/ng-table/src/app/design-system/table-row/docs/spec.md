---
id: table-row
kind: component
atomic: Molecule
spec: specs/Table Row.md
frame: components/Table Row.dc.html
owns:
  - "Docs-table header + body row: cell padding, divider, header type, name/type cell treatment"
does_not_own:
  - "The NGP Table product component — that is styled by the shipped library, not this system"
depends_on:
  - "foundations/Typography.md (typography)"
  - "foundations/Color.md (color)"
  - "foundations/Spacing.md (spacing)"
states:
  - "header row"
  - "body row"
  - "last row (no divider)"
a11y:
  - "Real <table> with <th scope=\"col\">"
tokens: [--ngpt-sys-space-275, --ngpt-sys-space-400, --ngpt-bg-row, --ngpt-sys-typescale-label-large-strong, --ngpt-text-secondary, --ngpt-sys-typescale-label-large, --ngpt-accent, --ngpt-text-tertiary, --ngpt-comp-row-divider, --ngpt-border-subtle, --ngpt-sys-shape-corner-small-alt]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

> Distributed here from the design handoff bundle (`apps/ng-table/docs/design-handoff/`) during Wave 0 spec distribution — spec wins over the reference frame there.

# Table Row

**Atomic level:** Molecule

Header + body row pattern used for API reference tables and the tech-stack table.

## Composition

- Header row: bold label cells on a tinted background
- Body rows: identifier (mono accent, unfilled) + type `code-chip` (filled, secondary text) + description cell

The two mono cells are deliberately **not** the same treatment. An identifier takes its color from this
spec and no background; a type takes the whole `Inline Code Chip.md` treatment. Merging them — accent text
on the chip fill — measures 4.25:1 and fails AA, and it also makes the two columns look like one field.

## Build spec

| Property | Value | Token |
|---|---|---|
| Header padding | 11px 16px | `--ngpt-sys-space-275 --ngpt-sys-space-400` |
| Header background | oklch(0.19 0.005 260) | `--ngpt-bg-row` |
| Header font | 13px / 600 | `--ngpt-sys-typescale-label-large-strong` |
| Header text color | oklch(0.85 0.01 260) | `--ngpt-text-secondary` |
| Body row padding | 11–12px 16px | `--ngpt-sys-space-275/300 --ngpt-sys-space-400` |
| Body font | 13.5px | `--ngpt-sys-typescale-label-large` |
| Identifier column | Mono, `--ngpt-accent`, **no chip fill** — accent on the row background is 5.01:1; on the `--ngpt-bg-code-chip` fill it drops to 4.25:1 and fails AA | `--ngpt-accent` + `--ngpt-sys-typescale-code` |
| Type column | A full `code-chip` per `Inline Code Chip.md` — chip fill with `--ngpt-text-secondary` text (11.6:1), `white-space: nowrap` | `--ngpt-bg-code-chip` + `--ngpt-text-secondary` |
| Description column color | oklch(0.62 0.01 260) | `--ngpt-text-tertiary` |
| Row divider | 1px solid oklch(0.24 0.005 260) | `--ngpt-comp-row-divider` |
| Structure | A real `<table>` with `<th scope="col">` — one layout context for the whole table | `—` |
| Columns (API) | Name (180px) / Type (`nowrap`) / Description (fills) | `—` |
| Columns (tech-stack) | Two: label and description | `—` |
| Table min-width | 600px, so the wrapper scrolls instead of a cell wrapping | `—` |
| Container border | 1px solid oklch(0.26 0.005 260), radius 10px | `--ngpt-border-subtle / --ngpt-sys-shape-corner-small-alt` |


## Why a real table, and not a grid per row

An API table has three columns, not two: `pages/API Reference.md` requires type values as `code-chip`s, and
a type is a third field, not part of the name.

**The table is one element, not a stack of grid rows.** Sibling grids size their tracks independently, so
the Type column resolves to a different width in every row and the Description column starts at a
different x in each — including under nothing in the header. No set of track values fixes that; only one
layout context does. A `<table>` is also what the `a11y` line above already required.

The Type cell is `white-space: nowrap` and the table carries a `min-width`, so an unbreakable chip like
`Signal<Set<string>>` pushes the table past the wrapper and the wrapper scrolls — which is what
`foundations/Responsive and Breakpoints.md` § Confirmed says code-like content does: scroll, never wrap. A
fixed-width type track did the opposite: the chip overran it and painted its background over the
description text.

Earlier revisions described a two-column `180px / 1fr` grid, then a three-track grid per row. Both are
superseded here.

## HTML/CSS mock

```html
<div class="spec-table-scroll" tabindex="0" role="group" aria-label="API table">
  <table class="spec-table">
    <thead>
      <tr><th scope="col">Name</th><th scope="col">Type</th><th scope="col">Description</th></tr>
    </thead>
    <tbody>
      <tr>
        <td><code>rowIdentifier</code></td>
        <td><code>(row: T) =&gt; string</code></td>
        <td>Row description</td>
      </tr>
    </tbody>
  </table>
</div>
```

```css
.spec-table-scroll {
  border: 1px solid var(--ngpt-border-subtle);
  border-radius: var(--ngpt-sys-shape-corner-small-alt);
  overflow-x: auto; /* the type column can push the table wider than the content column */
}
.spec-table {
  width: 100%;
  min-width: 600px;
  border-collapse: collapse;
  font: var(--ngpt-sys-typescale-label-large);
}
.spec-table th {
  padding: var(--ngpt-sys-space-275) var(--ngpt-sys-space-400);
  text-align: left;
  background: var(--ngpt-bg-row);
  font: var(--ngpt-sys-typescale-label-large-strong);
  color: var(--ngpt-text-secondary);
}
.spec-table th:first-child { width: 180px; }
.spec-table td {
  padding: var(--ngpt-sys-space-275) var(--ngpt-sys-space-400);
  border-top: 1px solid var(--ngpt-comp-row-divider);
  vertical-align: top;
  color: var(--ngpt-text-tertiary);
}
.spec-table code { white-space: nowrap; font: var(--ngpt-sys-typescale-code); }
/* identifier: color only, no fill */
.spec-table td:first-child code { color: var(--ngpt-accent); }
/* type: the full inline-code-chip treatment */
.spec-table td:nth-child(2) code {
  background: var(--ngpt-bg-code-chip);
  border-radius: var(--ngpt-sys-shape-corner-extra-small);
  padding: var(--ngpt-sys-space-050) var(--ngpt-sys-space-150);
  color: var(--ngpt-text-secondary);
}
```
