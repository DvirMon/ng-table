---
title: State Layer Reference — withSorting()
type: architecture
version: 1.2
date: 2026-08-12
status: drafted
audience: developers
parent: ../1-state/architecture.md
---

# withSorting()

## Executive Summary

Sort via an ordered array of rules, with a three-state toggle cycle per column (ascending → descending → unsorted). By default, clicking a column replaces the sort with that column alone (single-column). Multi-column accumulation by click sequence is available via the `multi` config option. Reads column definitions from core `columns` config — no feature-level dependency.

## State Shape

```ts
type SortDirection = 'asc' | 'desc';

interface SortRule {
  columnId: string;
  direction: SortDirection;
}

interface SortingState {
  sorting: SortRule[];   // ordered — array position = sort priority
}
```

## Behavior

- **Sort state:** an ordered array of rules; earlier entries take priority. In single-column mode (the default) the array holds at most one rule.
- **Toggle cycle (three-state):** clicking a column cycles `ascending → descending → unsorted`. Reaching "unsorted" removes that column's rule from the array.
- **Adding columns (`multi: false`, default):** clicking a column replaces the sort — the array becomes just that column's rule at `ascending`. Clicking the same (sole) column again continues the three-state cycle; clicking a *different* column replaces the sort with that column instead of accumulating.
- **Adding columns (`multi: true`):** additive — any click adds/updates that column's rule in the array, no modifier key required. Order in the array is determined by click sequence (first clicked = first priority).
- **Direction representation:** string enum `'asc' | 'desc'` (not boolean, not numeric) — chosen for readability, TanStack-style.

## Methods

| Method | Description |
|---|---|
| `toggleSort(columnId: string)` | Advances the column through the three-state cycle; single-column replace or multi-column accumulate depending on the `multi` config option (see below); no-ops if the column has `enableSorting: false` |
| `setSorting(rules: SortRule[])` | Programmatically replace the full sort state |
| `clearSorting()` | Clears all sort rules |

## `multi` Contract

```ts
withSorting({ multi: true })
```

- Default is `multi: false` — `toggleSort()` on a different column replaces the sort array with just that column's rule (still asc → desc → unsorted for repeated clicks on the same column).
- `multi: true` restores the original accumulate-by-click-sequence behavior: any click adds/updates that column's rule in the array without disturbing the others, array position set by click order.
- This governs only `toggleSort()`'s click behavior. `setSorting()` always accepts an arbitrary `SortRule[]` regardless of `multi`.

## `manual` Contract

```ts
withSorting({ manual: true })
```

When `manual: true`:
- `toggleSort` / `setSorting` still update state normally.
- The reactive pipeline **skips the client-side sort step** (assumes data arrives pre-sorted).
- A `sortChanged` event fires. The consumer wires their own `effect()` to react to the new sort state and writes freshly server-sorted data into their own `data` signal.
- No loader abstraction exists inside the store — this pattern is consistent across all `manual`-capable features.

## Comparator Logic

Per-column custom comparator, TanStack-style:

```ts
interface ColumnDef {
  sortFn?: (a: Row, b: Row) => number;
  enableSorting?: boolean; // default true
}
```

- If `sortFn` is supplied on the column def, it's used directly.
- If omitted, the store falls back to built-in auto-detection (string/number/date comparison) — no auto-detection logic beyond this was specified.
- `enableSorting: false` makes `toggleSort` a no-op for that column (default `true`).

## Null / Empty Value Ordering — REQUIRED, NOT IMPLEMENTED

**Status:** gap identified 2026-08-12. No configuration exists and the built-in comparators
mishandle null/undefined/empty outright. Must ship with, or before, editable rows.

### Why it is required now

The editable-rows work (`docs/1-state/work/with-mutations/`) adds a blank-row flow: insert an
empty row, then fill it in. Under an active sort the blank row's position is decided entirely by
how the comparator treats `""`/`null` — and today that position **flips with sort direction**
(first ascending, last descending). A user who clicks "Add row", then toggles the sort header,
watches the row they are filling jump from top to bottom.

### Current defects in `detectComparator` / `sortRows`

`detectComparator` skips nullish values when *sampling* to detect the column type, but the
comparators it returns never guard the individual values:

| Detected type | Cell value | Actual behavior |
|---|---|---|
| Date | `null` / `undefined` | `(value as Date).getTime()` **throws `TypeError`** — a single empty date cell crashes the sort |
| number | `null` | coerces to `0`; sorts among genuine zeros, indistinguishable |
| number | `undefined` | comparator returns `NaN`; `Array.prototype.sort` ordering becomes implementation-defined for the whole array |
| string | `null` / `undefined` | `String(null)` is `"null"` — sorts alphabetically among "n" words as if it were data |
| string | `""` | sorts before all values ascending, after all descending — the blank-row flip |

The Date case is a crash, not a mis-ordering, and is independent of the editing work — any table
with a nullable date column and `withSorting()` hits it today.

### Required behavior

Null ordering must be **independent of sort direction** — this is the whole point, and it is the
SQL / AG Grid convention. Reversing the direction must not move empties from one end to the other.

Proposed surface — **provisional, and its premise is now questioned** (see "Unresolved scenarios"
below; the `nulls`-on-`ColumnDef` shape assumes emptiness is a per-cell property and that sorting
is the right owner, both of which are open):

```ts
type NullsOrder = 'first' | 'last';

interface ColumnDef {
  sortFn?: (a: Row, b: Row) => number;
  enableSorting?: boolean;   // default true
  nulls?: NullsOrder;        // NEW — default TBD
}
```

Nullish handling belongs in `sortRows`, wrapping whichever comparator is in play, so that it
applies uniformly to auto-detected comparators **and** to consumer-supplied `sortFn` — a custom
`sortFn` should not have to re-implement null guards. That also fixes the Date crash for free,
since nullish values never reach `.getTime()`.

What counts as "null" needs deciding too: `null` and `undefined` certainly; `""` is the open one,
since an empty string is a legitimate value in some columns and a stand-in for "not filled in" in
others — and the blank-row flow depends on which reading wins.

### Unresolved scenarios — recorded 2026-08-12, deliberately not analyzed

Raised from a real case. Captured as-is so the editable-rows discussion is not derailed;
no option here has been weighed, and nothing below implies a direction.

**S1 — A newly added row is not guaranteed to be empty.** The blank-row flow assumes an all-empty
row, but an added row can arrive partly populated: column defaults, values copied from a
duplicated row, a pre-set foreign key, a server-assigned id. "New" and "empty" are not the same
predicate.

**S2 — "Empty" is not "null".** Candidate empties include `null`, `undefined`, `""`, whitespace-only
strings, `0`, `false`, `[]`, `{}`. Which of these count is domain-specific — `0` is a real quantity
in one column and "not entered" in another.

**S3 — Emptiness may be a row-level predicate, not a cell-level one.** The proposed `nulls` field
sits on `ColumnDef`, i.e. per cell. But the product-level concept is "an empty row", which cannot
be derived cell-by-cell without a rule for combining cells.

**S4 — "Empty row" has multiple valid definitions, and they disagree.** At least: every field is
nullish; *some* field is nullish; the required fields are incomplete; one designated key field is
missing. Different products want different ones, and the same product may want different ones per
table.

**S5 — The definition must be consumer-supplied, with a library default.** Follows from S4. Open
what the default is, and what shape the override takes.

**S6 — "Place first" is itself ambiguous.** First relative to what: the whole table, the current
page, the row's group, or the sorted region only? And where does it sit relative to rows held in
place by other mechanisms (pinning, O14)?

**S7 — Ownership is unresolved.** Three candidate homes, none evaluated:
- `withSorting()` — extend the existing feature, as the section above provisionally assumes.
- A separate `withOrdering()` (or similar) feature — if "which rows float" is a distinct concern
  from "how values compare".
- The **column schema** — e.g. a column declaring that its emptiness forces its row to the top,
  making this a schema-derived property rather than a sort option.

**S8 — Multi-column sort.** With several active sort rules, which column's emptiness decides the
row's position, or does the row-level predicate (S3) make the question moot?

**S9 — Grouping.** An empty row may have no value in the grouping column, so it has no group to
belong to. Where it renders under `withGrouping()` is undefined. Related to the deferred
grouped-insertion scenario in `../work/with-mutations/2-decisions.md`.

**Status:** parked. The editable-rows effort continues on its own questions; this is picked up as
its own piece of work. The four items under Open Questions below predate S1–S9 and are narrower
than them — S3 and S7 in particular may make some of them moot.

### Relationship to pinning

Null ordering does **not** solve the editable blank-row problem on its own — it only makes the
empty row's landing spot *stable and configurable*. Holding the row still while the user types is
resolved separately (D24 — Signal Forms `debounce()` on the commit boundary, not a sort-stage
exemption) in `docs/1-state/work/with-row-editing/2-decisions.md`. The two are independent
controls and should not be conflated: `nulls` decides where empties land, `debounce()` decides
whether the row moves at all.

## Compile-Time Dependencies

None as a separate feature. Reads `sortFn` / `enableSorting` from the core `columns` config directly (see `columns.md`; retroactively corrected from an earlier "depends on `withColumns()`" framing).

## Events Owned

- `sortChanged` — fires on every sort state change (used for both client feedback and the `manual` server-fetch trigger).

## Open Questions

- [ ] Auto-detection fallback logic (string/number/date) needs precise algorithm definition before implementation — not yet specced in detail.
- [ ] **`nulls` default** — `'last'` matches the common grid convention (empties out of the way); `'first'` suits the blank-row-then-fill flow, where the row you just added should be where you can see it. Picking `'last'` as the default makes the editing feature pass `nulls: 'first'` per column, which may be the honest split.
- [ ] **Does `""` count as null?** Legitimate value in some columns, "not filled in" in others. Options: always treat as null, never, or a separate `treatEmptyStringAsNull` flag. The blank-row flow's behavior depends on this.
- [ ] **Per-column or table-wide default?** `nulls` on `ColumnDef` is per-column; a `withSorting({ nulls })` table-wide default that columns override may be worth it if most tables want one answer.
- [ ] **Does `nulls` apply to consumer `sortFn`?** Proposed yes (wrap the comparator in `sortRows`), so custom comparators inherit null-safety without re-implementing it — but that overrides a `sortFn` author who deliberately handles nulls themselves. An escape hatch may be needed.
- [ ] Visual indicator for multi-sort priority (e.g. numbered badges on headers) is a UI-layer concern, deferred to the directive spec.
