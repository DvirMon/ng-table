---
title: Table extracted to standalone @acme/table package
type: adr
version: 1.0
date: 2026-08-19
status: accepted
audience: developers
---

# ADR-0009 — Table extracted to standalone `@acme/table` package

## Status

Accepted — 2026-08-19.

## Context

The table (`src/ui/table/`) has always had zero runtime dependencies beyond `@angular/core` —
no `@angular/cdk`, no `ng-primitives`, no state-management library (ADR-0003 dropped
`@ngrx/signals` in favor of an in-house signal composer, citing "a peer dependency is an
adoption tax if this ships as a standalone primitive library" as one driver). Its directive
selectors use the `ngp` prefix.

Meanwhile this design-system lib adopted `ng-primitives` as a real dependency for the
dropdown/autocomplete family (ADR-0006), and ng-primitives uses the `ngp` prefix itself
(`ngpSelect`, `ngpCombobox`, `ngpPopover`, ~50 primitives, growable in any minor). With the
table still living here, two unrelated libraries would share one selector namespace with no
way for a reader — or the compiler — to tell which `ngp*` belongs to which. The table, having
no ng-primitives dependency, has no reason to share that namespace once it isn't sharing a
package.

This decision was made in an earlier session and its record was lost during a docs
restructure — no surviving document referenced `libs/shared/table` or `@acme/table` before
this ADR.

## Decision

Move `src/ui/table/` wholesale to a new standalone lib, `libs/shared/table/` (Nx project name
`shared-table`, import alias `@acme/table`, `prefix: "ngp"`). This is a move, not a refactor:
internal layout (`api/`/`engine/`/`directives/`, ADR-0004), selectors, and the public API
(`index.ts` barrel) are unchanged.

ADR-0001 through ADR-0005 — all table-specific, all evaluated for cross-references into
non-table code and found clean — moved with it, keeping their original numbers, into
`libs/shared/table/docs/adr/`:

- [ADR-0001](../../../table/docs/adr/0001-sorting-single-column-default.md) — sorting default
- [ADR-0002](../../../table/docs/adr/0002-table-store-instance-factory.md) — store factory
- [ADR-0003](../../../table/docs/adr/0003-in-house-table-store-engine.md) — in-house store engine
- [ADR-0004](../../../table/docs/adr/0004-table-source-layout.md) — source layout
- [ADR-0005](../../../table/docs/adr/0005-generic-table-host.md) — generic table host

ADR-0006–0008 (dropdown/autocomplete/list) stay in this lib's `docs/adr/` — no table
cross-references were found into or out of them.

This ADR itself stays here in design-system, as the record of _this lib's_ decision to split
the table out, even though the artifact it describes has left.

## Consequences

- `src/ui/` in this lib is deleted entirely — it contained only the table and its dead
  re-export barrel (`ui/index.ts`).
- `@acme/shared-design-system/ui` path alias removed from `tsconfig.base.json`; replaced with
  `@acme/table` pointing at `libs/shared/table/src/index.ts`.
- The 5 table consumers in `apps/demo/src/app/` (table-demo, table-expansion-demo,
  table-expansion-row-demo, and their stores) were repointed from
  `@acme/shared-design-system/ui` to `@acme/table`.
- `libs/shared/design-system/project.json` still declares `prefix: "app"`. That field was
  already inconsistent before this move (it never matched the table's actual `ngp` selectors)
  and now describes zero components in either `app` or `acme`. Left unfixed — out of scope for
  a move ticket; tracked as a pre-existing follow-up in `CONTEXT.md`. New DS work must still
  declare and match `prefix: "acme"` per `CONTEXT.md`.
- Zero new runtime dependencies introduced by the extraction (verified: no `ng-primitives`,
  `@angular/cdk`, or `@ngrx/signals` imports anywhere in the moved `.ts` sources).
