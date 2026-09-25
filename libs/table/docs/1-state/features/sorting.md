---
title: State Layer Reference — withSorting()
type: architecture
version: 1.2
date: 2026-08-12
capability: sorting
spec: drilled
code: shipped
audience: developers
parent: ../architecture.md
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
- Runtime failures degrade rather than crash the table
  ([ADR-0014](../adr/0014-runtime-error-policy.md)): a column whose
  `accessor` throws sorts that row as empty for this evaluation; a
  `sortFn` (or the built-in comparator) that throws leaves the
  affected comparison unordered, so the column's sort falls back to
  input order rather than the whole table breaking. Both report once
  per column per evaluation via `console.error`.

### Per-column override — not available for one release (R1)

Until #100/S1 ships, a column cannot be given its own compare function and
cannot be made un-sortable. `ColumnDef` keeps `sortFn` and `enableSorting` as
declared fields, but `col()` (`createColumns()`'s builder) does not expose
either one, so no column declared today can actually set them — both survive
as permanently-`undefined`.

Nothing fails to compile: every column silently falls to the auto-detected
comparator above, and `enableSorting !== false` is vacuously true, so the
no-op guard stays dormant — there is no consumer-supplied value for it to
act on yet. Full ruling:
[R1](../work/core/active/single-value-source/decisions.md) in the workspace
decisions log.

## Null / Empty Value Ordering — shipped

Full decision record: `docs/1-state/work/sorting-null-ordering/1-handoff.md`.

### Shipped behavior

`sortRows` (`api/features/with-sorting.ts`) resolves nullish/empty values **before** the
comparator runs and **outside** the direction multiplication, so placement is independent of
sort direction — the empty branch does not multiply by `sign`. This applies uniformly to
auto-detected comparators and to a consumer-supplied `sortFn`; a custom comparator does not need
to re-implement null guards (an accepted trade — a `sortFn` that deliberately orders nulls itself
is overridden, no escape hatch).

- `null` / `undefined` are always empty. `""` is a real value, not empty, by default.
- Default placement: `nulls: 'last'` (SQL / AG Grid convention).
- Per-column override: `sortNulls(path, { order?, emptyString? })` (`schema/column-rules.ts`),
  a declarative rule mirroring `visible()` — writes to the internal `SORT_NULLS` metadata
  key (`engine/columns.ts`). Single-writer: two `sortNulls()` calls on one column throw at
  resolve time. `emptyString: 'is-empty'` opts `""` into the empty branch for that column.
- Requires `createColumns()`'s schema argument to override; a table that omits it gets the
  default (`'last'`, `""` not empty) and cannot override per column — acceptable because the
  default alone already fixes the crash and the direction flip for every table.
- No table-wide `withSorting({ nulls })` default — not proposed; add later if a real table wants
  `'first'` everywhere.

This closes the Date `.getTime()` crash, the `NaN`/implementation-defined ordering for
`undefined` numbers, `String(null)` sorting as `"null"`, and the direction-dependent flip for
empty strings.

### Why this scope was sufficient — S1–S9 stay parked

The unresolved scenarios below (S1–S9) exist because a blank row's landing spot mattered — the
user was filling it in and needed to not lose it. Product **OQ-3**
(`docs/0-product/row-editing.md` §5, S-1) decided the edited row **holds its display position for
the whole gated edit session** — the row no longer moves while it's being worked on, so null
ordering only needs to make empties land somewhere stable and predictable, not solve "don't lose
the row I'm typing in." That dependency is real, not a convenience: if OQ-3's row-hold is ever
dropped, S1–S9 come back into scope.

### Unresolved scenarios — recorded 2026-08-12, still parked

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
grouped-insertion scenario in `../work/row-editing/archive/with-mutations/2-decisions.md`.

**Status:** parked. The editable-rows effort continues on its own questions; this is picked up as
its own piece of work. The four items under Open Questions below predate S1–S9 and are narrower
than them — S3 and S7 in particular may make some of them moot.

### Relationship to pinning

Null ordering does **not** solve the editable blank-row problem on its own — it only makes the
empty row's landing spot *stable and configurable*. Holding the row still while the user types is
resolved separately (OQ-3, `docs/0-product/row-editing.md` §5, S-1 — the edited row holds its
display position for the whole gated edit session) rather than by a sort-stage exemption. The two
are independent controls and should not be conflated: `sortNulls` decides where empties
land when nothing is being edited; the edit-session row-hold decides whether the row moves at
all while it is.

## Compile-Time Dependencies

None as a separate feature. Reads `sortFn` / `enableSorting` from the core `columns` config directly (see `columns.md`; retroactively corrected from an earlier "depends on `withColumns()`" framing).

## Events Owned

- `sortChanged` — fires on every sort state change (used for both client feedback and the `manual` server-fetch trigger).

## Open Questions

- [ ] Auto-detection fallback logic (string/number/date) needs precise algorithm definition before implementation — not yet specced in detail.
- [x] **`nulls` default** — settled `'last'`, via `sortNulls({ order })` per column. See "Shipped behavior" above.
- [x] **Does `""` count as null?** Settled: no, by default. Opt in per column with `sortNulls({ emptyString: 'is-empty' })`.
- [ ] **Table-wide default?** Not proposed — `withSorting({ nulls })` covering every column may be worth it if a real table wants `'first'` everywhere. Add later; one config field plus a `nullsOrderFor` fallback.
- [x] **Does the null-order fix apply to consumer `sortFn`?** Settled: yes, no escape hatch. Add one if a consumer asks.
- [ ] Visual indicator for multi-sort priority (e.g. numbered badges on headers) is a UI-layer concern, deferred to the directive spec.

---

## Competitive position

**Verdict: on par** — the sort model itself (ordered rule array, three-state toggle, per-column
comparator, `manual`) matches all four; null ordering is **ahead** of them, since the `nulls: 'last'`
default and per-column `sortNulls` are a deliberate contract where all four leave the behavior
silent or undefined.

Full reasoning: [gap-analysis.md](../work/meta/archive/state-feature-competitive-audit/gap-analysis.md).
