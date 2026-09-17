---
title: Spec — the column↔grouping-level relation on withGrouping() (#115)
type: spec
status: ready
date: 2026-09-17
audience: developers
---

# Spec — the column↔grouping-level relation on `withGrouping()`

Synthesized from [`2-decisions.md`](2-decisions.md) (D1–D7, all settled). Nothing below is open
for relitigation. N5/N6 stay open there and are out of scope here.

The issue was filed as "`groupIndex` on `ColumnDef`". D3 dropped both the index and the
placement — the title outlived its evidence. The slug and issue number are kept; the shape is
not.

## Problem Statement

A person using a table with a **dynamic group-by panel** — an ordered chip strip of the current
levels, plus a per-column toggle row — needs to see which columns are grouping levels, in what
order, and under what names. The table publishes `grouping()` as bare column ids and `columns()`
as `ColumnDef`s, and nothing joins the two.

So every consumer building that panel hand-rolls the join, twice, in opposite directions:

- **level → its label**, to render a chip. Present in 4 of 4 grouping story hosts as
  `columnLabelById`.
- **column → is it a level**, to render a toggle's pressed state. Present in 2 of 4 as
  `isGroupedById`, and again as an inline `grouping.includes(column.id)` in a third place.

Both are re-derived per host, both re-derive a relation the feature already owns, and both can
silently disagree with what the pipeline actually clusters on: `resolveGroupingLevels` drops a
level naming no known column (runtime degrade, D14 of `with-grouping`), and a consumer-side
`Object.fromEntries(grouping().map(...))` does not.

A developer whose levels are fixed at construction (`initial`, no UI control) needs none of this
(D1). The need exists only where levels are edited at runtime.

## Solution

`withGrouping()` publishes the relation it already owns, as two members on `GroupingMembers`:

```ts
readonly groupingLevels: Signal<ColumnDef<TRow>[]>;   // ordered, outermost first
readonly isGroupedBy: (columnId: string) => boolean;  // O(1)
```

They are the two inverse lookups of one relation, and a group-by panel does both on every
render — `groupingLevels` iterates levels → columns and serves the chip strip; `isGroupedBy`
queries a column → membership and serves the toggles. Shipping only one leaves the consumer
hand-rolling the other half of the same control (D2).

Both derive from the same resolved level list, so the pipeline, the chips and the toggles can
never disagree — including about a dropped level (D4).

The write surface is unchanged: `table.grouping.update(updater)` with the existing updater
factories. These two members are read-only projections.

## User Stories

1. As a developer building a dynamic group-by panel, I want the current grouping levels as
   ordered `ColumnDef`s, so that I can render a chip strip with real column labels without
   joining `grouping()` against `columns()` myself.
2. As a developer, I want that list ordered outermost-level-first, so that the chip strip reads
   in the same direction as the nesting the table renders.
3. As a developer, I want a chip's position in the list to be its level depth, so that I can pass
   `from`/`to` indices straight to `reorderGroupLevels` without a separate index lookup.
4. As a developer, I want each entry to be the full `ColumnDef`, so that a chip can render
   `label`, and a richer panel can reach `id`, `order`, `visible` or `meta` off the same object.
5. As a developer, I want to ask whether one column is currently a grouping level, so that a
   per-column toggle can render its pressed state.
6. As a developer, I want that question answered in constant time, so that a toggle row over many
   columns does not become a quadratic scan of `grouping()` per render.
7. As a developer, I want the same answer at click time as in the template, so that a toggle's
   handler can branch on membership without a second, differently-written check.
8. As a developer, I want both members to reflect only levels the pipeline actually clusters on,
   so that a level naming no known column never appears as a chip for a group the table does not
   render.
9. As a developer, I want the two members to agree with each other by construction, so that a
   column can never be absent from the chip strip while its toggle reads pressed.
10. As a developer, I want both members to be reactive, so that a chip strip and a toggle row
    both update after `grouping.update(...)` with no manual refresh.
11. As a developer, I want both to react to column-list changes too, so that adding a column via
    `setColumns()` — or removing the column a level names — is reflected without re-registering
    anything.
12. As a developer, I want both to be correct when a grouping `rule`/`schema`/`groupingRule`
    overlay is what decides the levels, so that a panel works the same whether levels come from a
    person's writes or from a declarative rule.
13. As a developer, I want both to be correct while an async grouping rule is still pending, so
    that the panel shows the levels currently in effect rather than the ones about to be.
14. As a developer with an ungrouped table, I want an empty level list and an always-`false`
    membership answer, so that a panel renders its empty state without a special case.
15. As a developer, I want to reach both members straight off the table handle, so that a panel
    component needs no extra construction step and no second object to pass around.
16. As a developer composing `withGrouping()` with other features, I want these members present
    regardless of composition order, so that a panel does not depend on where grouping sits in
    the feature list.
17. As a developer, I want both members to appear on the table's type, so that my editor
    autocompletes them and a typo is a compile error rather than a blank chip strip.
18. As a developer reading the library's story hosts to learn the API, I want them to use these
    members rather than a hand-rolled join, so that the sample I copy is the supported one.
19. As a developer, I want the hand-rolled joins removed from the story hosts in the same change,
    so that the repo does not ship two competing answers to the same question.
20. As a developer using `groupedColumnMode`-style behaviour (hide or move a column once it
    becomes a level), I want to drive it off the published membership check, so that the rule
    that decides a column's fate is the same one the toggle displays.
21. As a maintainer, I want the relation computed once inside the feature, so that a future
    change to level resolution reaches every consumer at once instead of needing a sweep of
    hand-rolled copies.
22. As a maintainer, I want the members added without touching `ColumnDef`, so that this ships
    independently of #134's placement rule for per-column feature config.
23. As a maintainer, I want the `grouping` member to keep exactly one meaning, so that its read
    type and its write updaters stay describing the same thing.
24. As a maintainer, I want no new engine contribution slot or column rule for this, so that the
    static column-rule registry keeps its current scope and the dynamic case stays uncovered by
    design rather than by accident.
25. As a maintainer, I want no `columns → grouping` reactive edge introduced, so that a consumer
    rule predicate reading `table.columns()` cannot close a computed cycle.
26. As a developer, I want the reference docs for grouping to describe both members, so that the
    supported shape of a group-by panel is findable without reading a decisions doc.

## Implementation Decisions

**D2 — Two members on `withGrouping()`, nothing on `ColumnDef`.** `GroupingMembers<TRow>` gains
`groupingLevels: Signal<ColumnDef<TRow>[]>` and `isGroupedBy: (columnId: string) => boolean`.
`ColumnDef` is unchanged. This is the arm whose correctness does not depend on #134 landing a
particular placement rule.

**D3 — `isGroupedBy(): boolean`, not `groupIndexOf(): number | undefined`.** Every existing call
site asks *is this column a level*, never *which*. `groupingLevels()` already answers "which" by
position. Adding `groupIndexOf` later stays available and is not part of this scope.

**D4 — Both derive from the resolved level list, not from `grouping()`.** The id list is resolved
against the current columns once — dropping any id naming no known column, the same runtime
degrade the engine already applies for the pipeline — and both members read that one result. The
two cannot disagree with each other, nor with what the table clusters on.

**Order.** `groupingLevels()` preserves level order, outermost first, index 0 = outermost —
matching `grouping`'s existing ordering contract (`with-grouping` D3). It reflects level order
only; cluster order (`groupOrder`) and row order (`sorting`) are orthogonal and untouched (D7).

**Lookup cost.** `isGroupedBy` is backed by a set/map derived alongside `groupingLevels`, so a
toggle row over N columns stays O(N), not O(N × levels). It is a plain function on the members
object, not a `Signal`, and is read inside whatever reactive context calls it.

**Empty state.** Ungrouped: `groupingLevels()` is `[]` and `isGroupedBy(anything)` is `false`. An
unknown column id is `false`, not an error — consistent with the drop semantics above.

**D5 — Rejected: widening `grouping`'s `WritableView` read type.** The seam exists — the writable
view already separates read from write — but it would make `grouping` mean two things depending
on which half is touched, against the id-based write updaters (`with-grouping` D1). A separate
member keeps one name and one meaning.

**D6 — Rejected: a standalone `createGroupBy(table)` helper.** `createFilters()` exists because
R10's construction cycle forced it (ADR-0016), not for ergonomics. No cycle here, so the
precedent does not transfer.

**Rejected: a `ColumnDef.groupIndex` contributed through the column-rule registry.** The registry
is static for the table's lifetime while both the level list and the column list are dynamic, so
a per-column entry registered at construction cannot cover a column added later. It would also
need either a second special-cased internal rule key or a new contribution slot, and would create
a `columns → grouping` edge that a consumer `when()` predicate reading `table.columns()` could
close into a cycle. None of that is needed for the shape chosen.

**Level resolution stays one implementation.** The members reuse the engine's existing level
resolution rather than re-filtering ids at the feature layer, so the drop rule has exactly one
definition. Mapping resolved ids to `ColumnDef`s is the only new derivation.

**Public surface.** `GroupingMembers` is already exported from the library barrel and `ColumnDef`
is already public through the api types barrel; no new export is introduced. Adding members to
`GroupingMembers` is additive — no existing consumer breaks.

**Consumer cleanup, same change.** The four grouping story hosts drop their hand-rolled joins and
read the members instead: `columnLabelById` (async-rule, collapsible, crud, static),
`isGroupedById` (collapsible, static), the private `isGroupedBy()` method (static), and the
inline `grouping.includes(column.id)` in the static host's grouped-column-mode sync. Chip strips
that currently iterate `grouping()` and look a label up by id iterate `groupingLevels()` instead.

**Docs.** The grouping feature reference gains a note for both members, in the same form the
`groupIds` (#131) and `rowsOf` (#65) entries take. The columns reference gets a pointer stating
that the column↔level relation lives on the grouping feature, not on `ColumnDef` — so a reader
looking for it in the obvious wrong place is redirected.

## Testing Decisions

**What makes a good test here.** Drive the public API and assert published values —
`createTable(data, columnsConfig, withGrouping(...))`, then read `groupingLevels()` /
`isGroupedBy(...)` and, where agreement is the point, `renderRows()`. Never reach into the
derivation, the backing set, or the engine helper. A test that would still pass if the two members
were computed from different sources is not testing D4.

**One seam.** `libs/table/src/api/features/with-grouping.spec.ts`, as new top-level
`describe('groupingLevels')` and `describe('isGroupedBy')` blocks. No new seam is introduced and
nothing is tested at the engine layer — level resolution already has its coverage there. Prior art
is immediate and in the same file: the existing `describe('rowsOf')` and `describe('groupIds')`
blocks, added for #65 and #131, test exactly this class of published projection through the same
construction helpers and fixtures.

**Cases to cover.**

- `groupingLevels()` returns the level columns in level order, outermost first, as `ColumnDef`s
  carrying the real `label`.
- Positional agreement: entry *i* is the column named by resolved level *i*.
- Ungrouped table: `groupingLevels()` is `[]`; `isGroupedBy(anyId)` is `false`.
- `isGroupedBy` is `true` for every level id and `false` for a non-level column id and for an
  unknown id.
- Dropped level (D4): a level naming no known column appears in neither member, and the members
  agree with the headers `renderRows()` actually emits.
- Reactivity: a `computed()` reading each member recomputes after `grouping.update(...)` and after
  `setColumns(...)` — including `setColumns` removing the column a level names.
- Overlay-decided levels: a `rules`/`schema`/`groupingRule` fold is reflected by both members, and
  an async rule still pending shows the levels currently in effect.
- Composition order: both members are present and correct with `withGrouping()` composed before
  and after another feature.

**Story hosts are not a test seam.** Their cleanup is verified by the project typecheck, which is
template-aware and therefore catches a template still binding a deleted member.

## Out of Scope

- **`groupIndexOf(columnId)`** — no call site wants an index (D3). Reversible later.
- **`ColumnDef.groupIndex`**, and any new column-rule key or engine contribution slot for it.
- **#134's placement rule** for per-column feature config (`sortFn` / `enableSorting` /
  `aggregateFn` / `applySortNulls`). This spec is deliberately independent of its outcome.
- **N5** — whether `grouping: string[]` stays the only write surface. Expected trivially yes;
  unconfirmed, and this spec adds no write surface either way.
- **N6** — the same treatment for `withSelection()` / `withExpansion()`. A look, not a commitment,
  and not this ticket.
- **A shipped group-by panel component.** This publishes the data a panel needs; building one as a
  library component is not in scope. The story hosts stay the reference.
- **Any change to level order, cluster order (`groupOrder`) or row order (`sorting`)** — D7 keeps
  the three orthogonal and this changes none of them.
- **`manual: true`** and routing a header click to `groupOrder` — still deliberately unbuilt from
  `with-grouping`'s own Open section.

## Further Notes

The issue's original body was corrected before grilling on four counts, recorded in
`2-decisions.md`: `sortFn`/`enableSorting`/`aggregateFn` are consumer-authored, not
feature-contributed, so `groupIndex` would have been the first of its kind rather than an instance
of a precedent; the column-rule entry shape cannot express it as written; the rule registry is
static while the inputs are dynamic; and the relation is two-directional, which is what turned a
one-member proposal into a two-member one.

Difficulty is low once written — two derivations inside the feature's spec builder, plus consumer
cleanup across four story hosts and two reference docs. The surface change is what made it need a
spec, not the work.
