---
title: Decisions — groupIndex on ColumnDef (#115)
type: decisions
status: drilling — D1-D7 settled (shape decided); N5-N7 open, none blocking.
date: 2026-09-17
audience: developers
---

# groupIndex on ColumnDef — decisions

Source: [#115](https://github.com/DvirMon/acme/issues/115).
Directly re-opens **D2** in [`../with-grouping/2-decisions.md`](../../archive/with-grouping/2-decisions.md).

## Corrections to the issue body, made before grilling (2026-09-16)

- **"The slot already exists and is precedented — `withSorting()` uses it" is wrong.**
  `sortFn` / `enableSorting` / `aggregateFn` are *consumer-authored* fields on
  `ColumnDefInput`, read by a feature at pipeline time (`with-sorting.ts:112,157`;
  `engine/grouping.ts:186`). No feature writes them. The `types.ts:79` comment
  ("Feature-contributed fields, populated when the corresponding feature is registered")
  mis-describes them, and D2 says the opposite in words: `ColumnDef` carries *static
  predicates supplied at column-definition time*. `groupIndex` would be the **first**
  feature-derived top-level `ColumnDef` field, not an instance of an existing pattern.

- **`columnRules` cannot express it as written.** `ColumnRuleEntry` is
  `{ columnId, key: ColumnMetaKey, result }`, and `foldColumnRules` writes exactly two
  destinations: `visible` (special-cased `VISIBLE` key) and `column.meta`
  (`engine/columns.ts`). A top-level `groupIndex` needs either a second special-cased
  internal key or a new contribution slot. Q1 is therefore not "rules vs fold" — both
  arms need new engine surface.

- **The registry is static for the table's lifetime** (`engine/columns.ts`,
  `ColumnRuleRegistry` doc) while grouping levels and the column list are both dynamic
  (`setColumns()`, `grouping.update()`). A per-column rule entry registered at
  construction cannot cover a column added later.

- **The join is two-directional, and the issue only addresses one direction.** Across four
  story hosts:
  - *column → is it a level, and which* — `isGroupedById` (static, collapsible).
    `groupIndex` answers this cleanly.
  - *level → its label* — `columnLabelById` (static, collapsible, async-rule, crud; 4 of 4).
    `groupIndex` answers this only by inverting the iteration — filter `columns()` on
    `groupIndex !== undefined` and sort by it, instead of iterating the ordered
    `grouping()` array that already exists.

- **New cycle edge.** Today `grouping()` reads only `baseGrouping` + rule entries; it never
  reads `columns()`. Contributing `groupIndex` creates `columns → grouping`. A consumer
  `groupingRule`/`rules` `when()` predicate is an arbitrary closure and may read
  `table.columns()`, which would then close a computed cycle. Needs an explicit stance.

## Node graph (per `decompose-by-dependency-graph`)

| Node | Question | Rank |
|---|---|---|
| N1 | What shape carries the column↔level relation (does D2 stand)? | **core** |
| N2 | Contribution mechanism + registry dynamism | dependent (N1) |
| N3 | Index semantics when `resolveGroupingLevels` drops a level (D14 / Q2) | dependent (N1) |
| N4 | Cycle stance: may a column projection read feature state? | dependent (N1) |
| N5 | Write surface stays `grouping: string[]` only (Q3) | independent |
| N6 | Same treatment for `withSelection()` / `withExpansion()` (Q4) | independent (leaf) |
| N7 | Story-host cleanup + columns-reference docs | dependent (N1, N2) |

```
N1 ──▶ N2 ──▶ N7
 ├───▶ N3
 └───▶ N4

N5   (independent)
N6   (independent, leaf — issue already scopes it to "a look, not a commitment")
```

## Settled

- **D1 (2026-09-17) — The scenario is a *dynamic* group-by panel, not grouping in general.**
  A table whose levels are fixed by the developer (`initialGrouping`, no control) needs none of
  this data. The need appears only when a person edits levels at runtime. Two UI pieces:
  an ordered level chip strip (reorder/remove) and a per-column toggle row.

- **D2 (2026-09-17) — Option B: two feature members on `withGrouping()`. Nothing on `ColumnDef`.**

  ```ts
  readonly groupingLevels: Signal<ColumnDef<TRow>[]>;      // ordered, outermost first
  readonly isGroupedBy: (columnId: string) => boolean;     // O(1), Map-backed
  ```

  They are inverse lookups of one relation and the panel does both every render:
  `groupingLevels` iterates levels → columns (serves the chips); `isGroupedBy` queries a
  column → membership (serves the toggles). Shipping one leaves the consumer hand-rolling
  the other half of the same control.

  Deletes `columnLabelById` (4 of 4 grouping story hosts), `isGroupedById` (2), the private
  `isGroupedBy()` method, and `grouping.includes(column.id)` in `syncGroupedColumnMode`.

- **D3 (2026-09-17) — `isGroupedBy(): boolean`, not `groupIndexOf(): number | undefined`.**
  Every existing call site asks *is this column a level*, never *which level*. `groupingLevels()`
  already answers "which" by position. Rejecting the index also drops the name `groupIndex` that
  #115 was filed under — the issue's title outlived its own evidence. Reversible: add
  `groupIndexOf` if a per-column index need ever appears.

- **D4 (2026-09-17) — Both members derive from `groupingLevels()`, not from `grouping()`.**
  So `resolveGroupingLevels`'s D14 drop (a level naming no known column) applies exactly once
  and the two members cannot disagree with each other or with what the pipeline clusters on.

- **D5 (2026-09-17) — Rejected: widening `grouping`'s `WritableView` read type.**
  The seam exists (`createWritableView` already separates read from write), but it would make
  `grouping` mean two things depending on which half you touch, against id-based write updaters
  (`with-grouping` D1). A separate member keeps one name, one meaning.

- **D6 (2026-09-17) — Rejected: a standalone `createGroupBy(table)` helper.**
  `createFilters()` exists because R10's construction cycle forced it (ADR-0016), not for
  ergonomics. No cycle here, so the precedent does not transfer.

- **D7 (2026-09-17) — Level order and `groupOrder` stay unrelated, and this changes neither.**
  Three orthogonal orderings: levels (which column nests in which), clusters (`groupOrder`,
  sibling buckets within a level, `with-grouping` D4), rows (`sorting`, leaves within a cluster,
  `with-grouping` D5). `groupingLevels` reflects level order only.

## Open

- N5 (Q3) — `grouping: string[]` stays the only write surface. Expected trivially yes; confirm.
- N6 (Q4) — same treatment for `withSelection()` / `withExpansion()`. Issue already scopes this
  to "a look, not a commitment". Leaf, not blocking.
- N7 — story-host cleanup + columns/grouping reference docs. Implementation, not a decision.

Collapsed by D2 — no longer questions:

- N2 (contribution mechanism) — moot, the shape needs no engine surface beyond two computeds.
- N3 (dropped-level index semantics) — answered by D4.
- N4 (cycle stance) — moot, no `columns → grouping` edge is created.

## N0 added (2026-09-16) — raised in grill, upstream of N1

User question: should `sortFn` / `enableSorting` / `aggregateFn` / `applySortNulls` move to
feature-level schema APIs, since filtering and grouping put no per-column config on `ColumnDef`?

Audit of where per-column feature config lives today — **three placements, no rule**:

| Feature | Per-column fact | Placement | Shape |
|---|---|---|---|
| sorting | `sortFn` | `ColumnDef` literal | static pure fn |
| sorting | `enableSorting` | `ColumnDef` literal | static boolean |
| sorting | null/empty placement | `columnsSchema` → `applySortNulls` → `SORT_NULLS` meta | static opts, reactive channel |
| grouping | is-this-column-a-level | `withGrouping(schemaFn)` → `GroupingRule.enable` | reactive, async-capable |
| grouping | `aggregateFn` | `ColumnDef` literal | static pure fn |
| visibility | `visible` | `ColumnDef` literal **and** `columnsSchema` → `applyVisible` | both |
| filtering | — | none (row predicates, ADR-0016) | n/a |

Findings:

- **Both sorting and grouping are internally split** across two placements. The split is
  historical — `ColumnDef` fields predate the feature-level schema-fn API.
- **D4 already condemns the current state on its own terms.** It rejected
  `ColumnDef.compareGroups` partly because it "would sit as dead config on every column that is
  not the active group-by". `aggregateFn` is dead config unless `withGrouping()` is composed;
  `sortFn`/`enableSorting` unless `withSorting()` is. Same objection, unapplied.
- **Filtering is not a clean precedent for "feature-level".** It has no column config because
  R10's construction cycle pushed the whole filter set out to `createFilters()`, outside the
  table (ADR-0016). Structural, not stylistic.
- **A real distinction may justify a split**: `sortFn`/`aggregateFn` are *static pure functions*
  in the same class as `accessor` — they never change. `GroupingRule.enable` / `applyVisible` are
  *reactive, conditional, async-capable* state. `enableSorting` is a static boolean where a
  reactive `applySortable()` (mirroring `applyVisible()`) would be the consistent shape.

Consequence for #115: N0 is **upstream of N1**. `groupIndex` would add a fourth field to a
surface that may be about to relocate. Revised graph:

```
N0 (placement rule for per-column feature config)
 └──▶ N1 (shape/channel for column↔level) ──▶ N2 ──▶ N7
       ├──▶ N3
       └──▶ N4
N5, N6 independent
```

Likely an ADR, not a ticket decision — it sets library-wide policy across four features.

- **N0 spun out to [#134](https://github.com/DvirMon/acme/issues/134) (2026-09-16).** Placement
  rule for per-column feature config — library-wide policy across four features, too big for this
  ticket. Rules A (nothing on `ColumnDef`) and B (static pure fns stay, reactive state moves)
  drafted there with Q1-Q5.

  **#115 is not blocked on it.** Decision: scope #115 so its outcome does not depend on #134's.
  Consequence for N1 — a shape that adds a **top-level `ColumnDef` field** is the one arm whose
  correctness depends on #134 landing rule B. A feature member is #134-independent by
  construction; a `meta` key is partly exposed (#134 Q3 covers the `columnsSchema` channel).
