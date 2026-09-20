---
title: Table
summary: "Standalone `@ngp/table` headless table primitive, extracted from Design System (ADR-0009)."
depends-on: []
---

# Table — context

Glossary and cross-domain vocabulary for `@ngp/table`.

Extracted from the acme monorepo's `libs/shared/design-system` — see
[ADR-0009](docs/adr/0009-table-standalone-package.md) for
the extraction record, and this lib's own `docs/adr/0001`–`0005` for the table's own
architectural decisions (sorting default, store factory, in-house store engine, source layout,
generic host).

## Glossary

**Accessor** — the single value source for a column. Every consumer that needs a
column's value for a row reads it here: the rendered cell, sorting, grouping and
filtering alike. There is no second value path, which is what makes a group
header and the column beneath it unable to disagree.

**Carrier column** — a column declared for its value alone and never rendered
(`visible: false`). How a table groups, sorts or filters by something it does not
display. It is an ordinary column in every other respect.

**Display column** — a column object standing in for a rendered thing with no
value: a selection checkbox, a row-actions cell, an expand toggle. **This
library has none.** It is headless, so those are markup the consumer writes;
the concept exists here only to name what a carrier column is not.

**Schema entry** — the one place a feature's per-column rules are declared.
Every feature that has per-column configuration owns exactly one, and they all
share the same path vocabulary and the same plumbing. There is no second
spelling: a feature does not also accept a keyed record of the same settings.
`columnsSchema` is the column surface's own entry, not a shared dumping ground
— it carries no feature's config.

**Resolver** — a method a rule callback uses to reach something it was not
handed. Every resolver names a path; what differs is the **register** it reads
that path in. *What does the data say?* is one register, *what did the user ask
for?* another, *how is this column configured?* a third. A path resolves to a
different kind of thing in each, so each register has its own resolver rather
than one name doing three jobs.

The register also decides the shape. Two of them hold exactly one value per
column, so naming the path is enough. The data register holds one value per
row — a column being a cross-section of every row rather than one of them — so
a resolver reading it must also name the subject.

## Selector prefix: `ngp`

All directives use the `ngp` prefix (`ngpTable`, `ngpTableRow`, `ngpTableCell`,
`ngpTableHeaderCell`). This is **not** an ng-primitives dependency — this package has zero
runtime dependencies beyond `@angular/core` (verified: no `ng-primitives`, `@angular/cdk`, or
state-management imports anywhere in `src/`). `ngp` predates and is unrelated to
the acme design-system's `acme` prefix convention; do not harmonize the two.

## Related

- [ADR-0001](docs/adr/0001-sorting-single-column-default.md) — sorting default
- [ADR-0002](docs/adr/0002-table-store-instance-factory.md) — store instance factory
- [ADR-0003](docs/adr/0003-in-house-table-store-engine.md) — in-house store engine, zero deps
- [ADR-0004](docs/adr/0004-table-source-layout.md) — source layout by lifecycle phase
- [ADR-0005](docs/adr/0005-generic-table-host.md) — generic table host (native `<table>`/`<div>`)
