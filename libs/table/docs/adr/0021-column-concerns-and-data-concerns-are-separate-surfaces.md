# ADR-0021 — Column concerns and data concerns are separate surfaces

**Status:** accepted — path-vocabulary rule superseded by
[ADR-0024](0024-single-value-source-accessor.md) (2026-09-20); the capability test stands
**Date:** 2026-09-18

> **Read ADR-0024 before acting on the "Path vocabulary follows the surface" section below.**
> Its row for a feature's config — "path names row fields (`Extract<keyof TRow, string>`)" — no
> longer holds. Since the column `accessor` is now the single value source, a feature reads a
> value *through* its column and therefore keys by declared column id. The Decision's own test —
> a capability belongs to the column surface if it needs nothing from the row data, to a feature
> if it reads rows — is unaffected, as is everything in "Applying the test".
**Related:** [ADR-0019](0019-columns-path-keyed-by-declared-column-ids.md) (narrowed by this ADR
to `columnsSchema` only), [ADR-0020](0020-open-stage-registration-for-third-party-features.md)
(third-party feature authors are bound by the rule below),
[ADR-0018](0018-when-vs-enable-predicate-naming.md) (the other naming rule a schema fn obeys),
[ADR-0004](0004-table-source-layout.md) (layout by contract boundary)

**Source:** grouping decision D7 —
[`../1-state/work/grouping/active/grouping-config-simplification/2-decisions.md`](../1-state/work/grouping/active/grouping-config-simplification/2-decisions.md).
Pinning evidence —
[`../2-columns/work/pinning/discovery-pinning-under-grouping.md`](../2-columns/work/pinning/discovery-pinning-under-grouping.md).

## Context

The library has two declaration surfaces that both take a schema function and both hand it a
structural `path` proxy:

- `TableConfig.columnsSchema` — `applyVisible`, `applySortNulls`, `metadata()`
- a feature's own config — `withFiltering({ schema })`, `withGrouping({ schema })`

They drifted into keying their paths differently with nobody deciding it: `FiltersPath<TRow>` is a
mapped type over `Extract<keyof TRow, string>`, while grouping's path was `ColumnsPath<TRow, TId>`,
keyed by declared column ids. One table, two vocabularies for naming the same thing, and no stated
rule saying which a new feature should pick.

Several libraries avoid the question by not having it — AG Grid configures nearly everything
through column definitions, so there is one entry point and no split to get wrong. This library
deliberately does not do that. The separation is the architecture, which means the boundary has to
be stated rather than inferred.

## Decision

**A capability belongs to the column surface if it needs nothing from the row data. It belongs to
a feature if it reads rows.**

That is the whole test. Everything below follows from it.

### Path vocabulary follows the surface

| Declared on | Path names | Examples |
|---|---|---|
| `TableConfig.columnsSchema` | declared column ids (`ColumnsPath`, ADR-0019) | `applyVisible`, `applySortNulls`, `metadata()` |
| a feature's config | row fields (`Extract<keyof TRow, string>`) | `withFiltering`, `withGrouping` |

A feature's schema fn never names a column. It names the data it operates on.

### Applying the test

| Capability | Reads rows? | Surface |
|---|---|---|
| visibility | no | column |
| null-sort policy | no | column |
| column metadata | no | column |
| column pinning | no | column |
| sorting | yes — compares row values | feature |
| grouping | yes — partitions row values | feature |
| filtering | yes — tests row values | feature |
| selection, expansion | yes — keys on row ids | feature |

A table with zero rows loaded still renders its columns, their visibility and their pinned regions
correctly. That is the operational form of the test: **if it works on an empty table, it is a
column concern.**

### A capability may split at the seam

Sorting is the worked example, and it is the reason this is a seam rather than a wall:

- the ordered `SortRule[]`, compared against row values → `withSorting()`, a feature
- one column's own null-handling policy → `applySortNulls`, the column path

Both halves are "sorting". They live on different surfaces because one reads rows and the other
does not. A new capability that splits this way is following the rule, not bending it.

## Alternatives considered

- **Purpose decides — display concerns to columns, data concerns to features.** Rejected as
  underspecified. "Display" has no edge: a feature that configures how something looks but derives
  it from rows (a heat-map cell background, a value-driven row class) would be miscategorised. The
  rows/no-rows test has an edge you can check.
- **Declaration site decides, full stop.** Rejected as circular. It describes the outcome without
  saying how to pick the declaration site for something new. It is a true *consequence* of this
  ADR, not its rule.
- **State ownership / cross-column scope decides.** Rejected — and it is worth recording why,
  because it was argued at length before being discarded. It conflates two independent axes:
  whether state is per-column or spans columns (a question *inside* the column layer), and whether
  it derives from columns or from rows (this ADR's question). Total pinned width spans columns and
  reads no rows; under this alternative it would wrongly land in a feature.
- **One entry point through column definitions, AG Grid style.** Rejected — it is the architecture
  this library was built to avoid. Recorded here so the rejection is visible rather than implicit.

## Consequences

- **Grouping moves to a data-keyed path** (D7). `GroupingSchemaFn`'s path becomes a mapped type
  over `Extract<keyof TRow, string>`; value extraction moves to the rule via `applyGroupKey` (D9).
- **Filtering was already correct.** `FiltersPath<TRow>` needs no change — it was ahead of the
  rule rather than inconsistent with it.
- **ADR-0019 narrows to `columnsSchema`.** Its cross-argument `ColumnIdOf<S>` recovery had no
  consumer left and is retracted there.
- **Column pinning lands on the column surface** if it is built. It reads no rows; see the pinning
  decisions file for what remains open about it.
- **Third-party features (ADR-0020) are bound by this rule.** An author registering a stage and
  declaring a schema names row fields, not columns.
- **The cost is a second copy of the value fact.** A column's `accessor` and a feature rule's
  `applyGroupKey` extractor can compute different things with nothing checking they agree — a
  group header can disagree with the column beneath it. Accepted knowingly in exchange for
  features that operate on data the table does not display. See D7.
- **A capability that reads rows *and* wants column-scoped policy declares on both surfaces**, as
  sorting already does. That is two declarations, not one with a mode flag.

## Open

1. **Rendering is not covered by this rule.** The test partitions *state and declaration*. It says
   nothing about the render layer, where a column concern and a data concern genuinely collide: a
   full-width spanning group row versus pinned columns split into separate scroll regions. AG Grid
   needed a dedicated grid option plus per-region renderer instantiation to reconcile exactly that
   pair. This library's grouping uses the spanning-row shape. Unresolved, and it belongs to
   whatever ADR covers the pinned render model — not to this one.
</content>
