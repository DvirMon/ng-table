---
title: State Layer Reference — withSelection()
type: architecture
version: 1.2
date: 2026-09-11
capability: selection
spec: drilled
code: partial
audience: developers
parent: ../architecture.md
---

# withSelection()

## Executive Summary

Owns a set of selected row ids, the verbs that change it, and a delta stream announcing what
changed. Refuses the "select all" scope ambiguity rather than resolving it: every write names
the ids it applies to, so there is no runtime or compile-time dependency on `withPagination()` /
`withFiltering()`. Single-select is a rule on the write verbs (`enableMultiRowSelection`,
per-row or table-wide), never stored mode state. Standalone — no dependency on any other
feature.

Full decision record: [`work/with-selection/2-decisions.md`](../work/with-selection/2-decisions.md)
(D1–D19, D58–D59). Spec: [`work/with-selection/3-spec.md`](../work/with-selection/3-spec.md).

## State Shape

```ts
interface WithSelectionConfig<TRow> {
  enableRowSelection?: boolean | ((row: TRow) => boolean);        // default true
  enableMultiRowSelection?: boolean | ((row: TRow) => boolean);   // default true
  initialSelection?: RowId[];
}

interface SelectionChange {
  readonly added: readonly RowId[];
  readonly removed: readonly RowId[];
}

interface SelectionWriteOptions {
  emitEvent?: boolean;                                            // default true
}
```

Selection is a flat `Set<RowId>`, closure-local to the feature — no `mode: 'single' | 'multi'`
union, no children accessor, no cascade (D13). Not stamped onto `RenderRow` and no render stage
claimed (D5): a consumer reads `selectedRows().has(row.id)` directly.

## Methods

```ts
interface SelectionMembers {
  readonly selectedRows: Signal<ReadonlySet<RowId>>;
  readonly selectionChanged: Observable<SelectionChange>;
  toggle(id: RowId, opts?: SelectionWriteOptions): void;
  select(ids: RowId[], opts?: SelectionWriteOptions): void;
  deselect(ids: RowId[], opts?: SelectionWriteOptions): void;
  clearSelection(opts?: SelectionWriteOptions): void;
  selectionStateOf(ids: readonly RowId[]): 'none' | 'some' | 'all';
  isSelectable(id: RowId): boolean;
}
```

| Method | Description |
|---|---|
| `toggle(id, opts?)` | Adds `id` if absent, removes it if present. Subject to the multi-select rule (see below) when adding. |
| `select(ids, opts?)` | Bulk add in one write; duplicate ids collapse (D15). |
| `deselect(ids, opts?)` | Bulk remove in one write; never subject to the multi-select rule — removal can't violate single-select. |
| `clearSelection(opts?)` | Empties the set. |
| `selectionStateOf(ids)` | `'none' \| 'some' \| 'all'` for exactly the given id set (D7) — the caller supplies the denominator; unaffected by selection state on ids outside it. |
| `isSelectable(id)` | The `enableRowSelection` predicate, read-side, for one id (D61). Permissive for an id that resolves to no row (D8). Lets a caller pre-filter its own denominator against the same rule `select()` enforces, instead of duplicating `enableRowSelection`'s logic. |

Every write verb never checks whether an id is data-backed — an unknown id still
toggles/selects, and both the row-selection and multi-select predicates default permissive when
no row resolves (D8).

## `enableRowSelection` Contract

```ts
withSelection({ enableRowSelection: false })                          // no row selectable
withSelection({ enableRowSelection: (row) => row.status !== 'locked' }) // per-row exception
```

D58 (#29). A rule on the write verbs, never stored state — resolved per row, inside each write,
against the row(s) involved.

- **Gates id-adding writes only** — `toggle`, `select`, and the `initialSelection` seed. Never
  `deselect`/`clearSelection`, so a row that becomes non-selectable while selected stays
  escapable.
- **Write path, not read path** — `selectedRows()` and `selectionStateOf()` do not consult the
  predicate; selection stays a plain id set. The predicate is readable on its own via
  `isSelectable(id)` (D61) — a caller composes it with `selectionStateOf()`'s id set instead of
  the tri-state helper doing the filtering itself; D58 governs the two write-adjacent reads
  unchanged.
- **No reconcile** — a row turning non-selectable while selected is not auto-deselected.
- **Permissive when the id resolves to no row** (D8 untouched) — this rule answers a different
  question than D8: D8 governs ids with no row behind them, `enableRowSelection` governs rows
  that resolve and answer `false`.
- Answers a different write path than `enableMultiRowSelection` below — a blocked id is simply
  dropped from the candidate set before the multi-select rule runs, never truncated/thrown.

## `enableMultiRowSelection` Contract

```ts
withSelection({ enableMultiRowSelection: false })                       // table-wide single-select
withSelection({ enableMultiRowSelection: (row) => row.status !== 'draft' }) // per-row exception
```

Not stored mode state (D2) — resolved per row, inside each write verb, against the row(s)
involved. The rule is checked against the **whole resulting candidate set** for a write
(previously-selected ids plus newly requested ids), not just the id named in that call (D14):
if any id in that set forbids co-selection, the write keeps only the last requested id,
discarding the rest.

- Under `ngDevMode`, this discard **throws**, naming the discarded ids.
- In production builds, it truncates silently — `select(ids)` is frequently fed by runtime data
  (a restored selection, a server response) rather than authored literals, so a hard throw would
  turn a data mismatch into a crash on a startup or response path.

`initialSelection` is written directly into `selectedRows` at construction — never routed
through `select()`, which emits (D16) — but is still subject to this same truncation rule.

## `selectAllIds()` helper

```ts
export function selectAllIds<TRow>(
  table: Pick<TableStore<TRow>, 'rows' | 'value' | 'trackBy'>,
  opts?: { includeHidden?: boolean }
): RowId[]
```

Not a `SelectionMembers` method — a standalone function reading only the **core** `TableStore`
(`rows`/`value`/`trackBy`), so it adds nothing to `withSelection()` and creates no dependency on
`withFiltering()` (D59). Produces the id array `select()`/`deselect()` already take; it never
becomes a third write verb.

```ts
table.select(selectAllIds(table));                          // visible/matching — default
table.select(selectAllIds(table, { includeHidden: true }));  // every row, filtered or not
table.deselect(selectAllIds(table));                         // "deselect all visible" toggle half
```

`includeHidden` is a boolean, not a `scope` enum — exactly two datasets exist at the core level
(`rows`, `value`), permanently. A future page- or group-scoped select-all builds its own id array
(`table.renderRows()` filtered by `kind === 'row'`, or a group's rows) and passes it to
`select()`/`deselect()` directly, rather than becoming a third case here (D59).

Shipped at `api/features/selection.utils.ts` (D59) — a plain function, no DI/injection context,
against the already-shipped `TableStore` surface; not blocked on `createFilters()`. What it
deliberately does not solve: page-scoped select-all; the read-side "are all visible rows
selected" signal, routed to
[`work/computed-state-mechanism/1-intake.md`](../work/computed-state-mechanism/1-intake.md).

## `isSelectable()` — denominator recipe (D61, #32)

```ts
const ids = selectAllIds(table).filter(table.isSelectable);
table.select(ids);
table.selectionStateOf(ids);   // 'all' — same id set select() actually stored
```

Resolves the Q4/#57 residual question: `select(ids)` drops non-selectable ids (D58), so an
unfiltered `selectAllIds(table)` fed straight to `selectionStateOf()` under-reports (`'some'`
forever, never `'all'`). `isSelectable(id)` gives the caller the exact predicate `select()`
enforces, so the two sides agree without either side duplicating `enableRowSelection`'s logic —
the same "helper, caller composes it" shape as `selectAllIds()` (D59), not a change to
`selectionStateOf()` itself or to D58's write/read split.

## Compile-Time Dependencies

None. Standalone — reads only `rows` (for the multi-select predicate's row lookup) and
`trackBy` off the core store (D13, D42).

## Events Owned

- `selectionChanged: Observable<SelectionChange>` — a delta (`added`/`removed`), current state
  read from `selectedRows()`, never carried in the payload (D9). Exactly one emission per write
  verb; a no-op write (nothing actually changed) emits nothing; duplicate ids within a call
  collapse (D15). Backed by a plain, non-replaying `Subject` — never `ReplaySubject`/
  `BehaviorSubject` (D16), so a late subscriber never receives construction/seed state.
- `emitEvent: false` on any write verb suppresses that write's emission without skipping the
  state change (D18) — used for async/programmatic restores.
- Reconciliation (`onRowsRemoved`, ADR-0006) prunes `selectedRows` with no exemption when a
  selected row leaves `data()`, but the pruning itself emits nothing on `selectionChanged` (D11)
  — it carries no user intent, so it isn't a write verb.
- The stream completes in the feature's `onDestroy` hook (D17).

## Not Shipped

| Deferred | Reason | Shape already settled |
|---|---|---|
| Bulk `removeRow(id[])` / `patchRow(id[], partial)` | This effort ships `withSelection()` alone; bulk *edit* needs D31.2 resolved first | yes — D12 |
| Selection checkbox directive + header directive (UI layer) | Tracked separately, now unblocked | no |
| Auto-wiring component checkbox hosts (Angular Material, a consumer's own DS wrapper) | An attribute directive's host bindings can't reach a sibling component's inputs — Angular's own bridging mechanism is private API (D6) | deferred, documented recipe instead |
| Persistence of selection | `withSelection()` will declare a snapshot slice once cross-feature persistence ships; its `write()` will use the `emitEvent: false` silent path (D18/D19) | yes — D19 |
| Group-header select-all, parent/child cascade | `withGrouping()` doesn't exist yet; data is flat by invariant (D13) | no |
| A cause discriminator (`'checkboxSelected' | 'apiSelectAll' | …`) on `SelectionChange` | Recorded from AG Grid's `source` idea, not adopted (D10) | no |

## Open Questions

- [x] **Group-header select-all.** Resolved 2026-09-12 by D16 — no library cascade semantics;
      `table.rowsOf(group)` (issue #31) plus a consumer-owned cascade
      (`select(rowsOf(group).map(r => r.id))`), matching D1's flat, caller-supplies-the-id-set
      design. See [`2-decisions.md`](../work/with-selection/2-decisions.md) and
      [`0-product/selection.md`](../../0-product/selection.md) §6.
- [ ] **`withPagination()` / `withInfiniteScroll()` mutual exclusivity** — unrelated to
      selection directly, but selection's scope-free design assumes rows are addressable by id
      regardless of which is composed; revisit if that assumption changes.
- [x] **`selectionStateOf(ids)` denominator vs. `enableRowSelection`.** Resolved 2026-09-12 by
      D61 (#32): `isSelectable(id)` exposes the D58 predicate read-side; the caller pre-filters
      (`selectAllIds(table).filter(table.isSelectable)`) rather than `selectionStateOf()`
      consulting the predicate itself. D58's write/read split is unchanged.
- [ ] **Residual questions after D58** (see [2-decisions.md](../work/with-selection/2-decisions.md)):
      is "non-expandable row" in `withExpansion()` the same question as `enableRowSelection`, and
      should the two shapes converge.

---

## Competitive position

**Verdict: ahead on the emission contract, on par on the state model.** `selectionChanged`'s
`{ added, removed }` delta matches Angular CDK's `SelectionModel` — the only one of five
researched libraries whose sole responsibility is selection state (no rendering) and the only
one shipping a delta at all. PrimeNG approximates it with two events (`onRowSelect`/
`onRowUnselect`, which can't describe a single-select replace in one emission); AG Grid and
TanStack Table ship no delta. On "select all" scope, `withSelection()` refuses the scope
concept entirely (D1) where AG Grid and Material React Table leak the ambiguity into a `source`
enum / `forceAll` flag after the fact — this was the audit's #2-ranked gap and is now resolved,
not just narrowed.

Full reasoning:
[research-selection-change-events.md](../work/with-selection/research-selection-change-events.md),
[gap-analysis.md](../work/state-feature-competitive-audit/gap-analysis.md).
