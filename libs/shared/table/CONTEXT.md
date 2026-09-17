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
