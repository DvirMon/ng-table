# Correctness pass — feature plugins

**Date:** 2026-09-24 · Scope: `api/features/**` excluding
`compose-features.ts`, `with-computed.ts`, `editing/state.ts`,
`*.spec.ts`. Criteria: `libs/table/CLAUDE.md`, ADR-0006, ADR-0014
(+ its 2026-09-24 amendment), ADR-0011/0023. Engine files are cited
where the callback is declared by a feature's own public API — the
missing wrap is the feature's contract, not engine business. Ranked
most severe first.

## F1 — `applyGroupKey`'s extractor is unwrapped; one bad row blanks the table

`engine/grouping/clusters.ts:133` (declared by
`api/features/with-grouping/schema.ts:74`)

```ts
return extractValue ? extractValue(raw) : raw;
```

`readGroupValue` threads a `reportedColumns` set and runs `readAccessor`
through its ADR-0014 wrap — then hands the output to a consumer
callback with no `try`. `extractValue` is not in ADR-0014's fallback
table at all.

**Scenario.** Rows `[{id:1, createdAt: new Date()}, {id:2, createdAt: null}]`
with

```ts
withGrouping({
  initial: ['createdAt'],
  schema: (p) => applyGroupKey(p.createdAt, (v) => (v as Date).toISOString().slice(0, 7)),
});
```

Row 2 throws inside `buildClusters` → out of `clusterRows` → the `group`
pipeline stage → `rows()` → `renderRows()` → template. The table blanks
and stays blank until `data` changes.

Fires on three independent paths: the `group` pipeline stage
(`grouping/pipeline.ts:18`), the `group` render stage
(`grouping/render.ts:181`), and every re-clustering member read —
`rowsOf`, `groupIds()`, `groupingLevels()`, `isGroupedBy()`
(`with-grouping/feature.ts:159,179,182`).

One function away, `when` (`clusters.ts:165`), `groupOrder`
(`clusters.ts:286`) and `aggregateFn` (`render.ts:57`) each have a guard

- dedupe. `extractValue` is the one grouping callback missed.

## F2 — `withSelection`'s selectability predicates are unwrapped, and one is read from the template

`api/features/with-selection/feature.ts:64-65, 80, 90`

```ts
const canSelect      = toRowPredicate(config.enableRowSelection);
const canMultiSelect = toRowPredicate(config.enableMultiRowSelection);
…
function isSelectable(id: RowId): boolean {
  const row = resolveRow(id);
  return row === undefined || canSelect(row);   // :80 — no try
}
```

Both are consumer callbacks; neither is wrapped, neither names a
fallback in the ADR. `isSelectable` is a **public member** documented as
the "read-side" gate, i.e. intended for a call per row.

**Scenario.** `enableRowSelection: (row) => row.permissions.canEdit`
with a row whose `permissions` is `undefined` (partial server record). A
template binding `[attr.aria-disabled]="!table.isSelectable(r.id)"`
throws during change detection and the host fails to render. The same
predicate also throws out of `select()`/`toggle()` via
`applyRowSelectionGate` (`:84`) and out of `anyRowForbidsMultiSelect`
(`:90`), killing the click handler.

Right fallback per "visible, not silent": permissive on throw (matching
the existing `row === undefined` arm at `:80`), reported once per
callback per evaluation.

## F3 — `applyVisible()` / `metadata()` logic callbacks unwrapped inside the `columns` computed

`engine/columns-schema/wiring.ts:44-48`

```ts
result: computed(() =>
  typeof rule.logic === 'function'
    ? (rule.logic as (ctx) => unknown)(ctx)
    : rule.logic),
```

`rule.logic` is consumer code, read by `foldColumnRules`
(`engine/columns.ts:150`), which backs `core.columns` — read by
`renderRows` on every recompute (`engine/core.ts:92,103`).

**Scenario.** `applyVisible(p.salary, () => user().roles.includes('hr'))`
where `user()` is `null` while auth loads → `TypeError` inside the
computed → `columns()` → `renderRows()` → blank table, and the computed
caches the error so it stays blank until `user()` changes. Not just the
`salary` column: the whole table.

ADR-0014's `accessor` row gives the shape: degrade that rule's
contribution to `undefined`, which `foldColumnRules:151` already treats
as "no opinion", leaving the declared `visible`.

## F4 — async rule callbacks (`onSuccess`/`onError`) unwrapped on both async paths

`engine/columns-schema/wiring.ts:70,72` and `engine/grouping/rules.ts:96,98`

```ts
return value === undefined ? previous?.value : rule.onSuccess(value);
if (status === 'error') return rule.onError(resource.error());
```

Required consumer callbacks (`applyVisibleAsync`, `applyGroupingAsync` —
`with-grouping/schema.ts:105`), running inside `linkedSignal`
computations the template transitively reads.

**Scenario.** `applyGroupingAsync(p.region, { …, onSuccess: (r) =>
r.grouping.byRegion })` and the endpoint 200s with `{}` → `TypeError`
inside the `linkedSignal` → `maskGroupingLevels` → `grouping()` →
`clusterRows` → `rows()` → blank. `onError` cannot save it: the
resource resolved successfully; the throw is in `onSuccess`.

## F5 — `withSorting()` never completes `sortChanged`

`api/features/with-sorting.ts:201, 225, 221-234` — creates
`new Subject<SortRule[]>()`, exposes `asObservable()`, returns a spec
with **no `onDestroy`**.

Every sibling completes its Subject: `with-selection/feature.ts:199`,
and both expansion features via `store.destroy()`
(`with-expansion.ts:101`, `with-tree.ts:261`, `expansion/state.ts:103`).

**Scenario.** A page-scoped singleton service does
`table.sortChanged.subscribe(rules => this.persist(rules))`.
`takeUntilDestroyed()` isn't in play (the subscriber isn't the table's
owner), and the usual escape — `takeUntil`/`first()` on completion —
never fires. The Subject retains the observer, whose closure retains the
destroyed component's `table`, for the app's lifetime. The identical
code self-terminates under `withSelection`; that asymmetry is what makes
it a defect rather than a style difference.

Fix shape: `onDestroy: () => sortChangedSource.complete()`.

## F6 — `withSelection` throws at runtime from a data-dependent predicate

`api/features/with-selection/feature.ts:96-97, 111-121`

The comment classifies the throw as "construction/misuse
(deterministic, reachable on first call)". Once
`enableMultiRowSelection` is a **function**, it is neither: whether it
fires depends on which rows were passed and on those rows' current data
— ADR-0014's right-hand column verbatim.

**Scenario.** `enableMultiRowSelection: (row) => !row.archived` plus a
"select all visible" button calling `table.select(selectAllIds(table))`.
Dev fixtures have nothing archived, so it ships. The first production
page with two archived rows throws out of the click handler — no
selection, unhandled error. The `previousIds` path four lines down
(`:116-120`) already defines a degraded reading for the identical
conflict (truncate to the most recent id), so "no correct degraded
behavior" does not hold. Also not `ngDevMode`-gated (F9), so it ships.

## F7 — `detectComparator`'s numeric branch mis-orders a column with one non-numeric value

`api/features/with-sorting.ts:79, 84-86` — the comparator is chosen from
the first non-null sample and then applied to every row unchecked.

**Scenario.** Column `amount`, input order
`[{amount:5},{amount:'n/a'},{amount:2}]`, ascending, no `sortFn`.
`sample` is `5` → numeric branch. None are empty, so `isEmpty`
(`:168-169`) doesn't divert them. Every comparison involving `'n/a'` is
`NaN`, which `Array.prototype.sort` coerces to `+0` (ES `SortCompare`:
"If v is NaN, return +0"). Result: `[5,'n/a',2]` — **5 before 2
ascending**, silently, with no console output. No throw, so
`guardCompare` (`:123`) never engages. Against ADR-0014's own "visibly
unsorted beats silently mis-sorted", a non-comparable value should route
to the nulls placement or fall back to the string comparator. The `Date`
branch (`:80-83`) is safer only by accident — a string there throws
`getTime is not a function`, which `guardCompare` does catch.

> Bears directly on decision R1: `detectComparator` becomes the only
> comparator for one release once #129 lands ahead of #100/S1, and SO7
> still has no written spec.

## F8 — synthetic `group:` ids accumulate in expansion state forever

`api/features/with-tree.ts:262` / `with-expansion.ts:102` →
`expansion/state.ts:89-95`

`onRowsRemoved` prunes against ids the engine diffs out of `indexById`
(`compose-table.ts:213-215`), built from `config.data()` only
(`core.ts:76-80`). Group ids are synthesized by `toGroupId()`
(`clusters.ts:76`) as `group:>region:string:west` and are never in
`indexById` — never announced, never pruned. `withGrouping`'s own doc
points at this path: _"Feeds `table.tree.expand(table.groupIds())`"_
(`with-grouping/feature.ts:69-70`).

**Scenario.** Grouping by `customerId` with a search-box-driven filter;
the consumer re-calls `table.tree.expand(table.groupIds())` on each
filter change. Every `customerId` ever seen leaves a permanent entry in
`tree()`. The set grows without bound and the union walk in
`core.ts:59-70` iterates all of it on every `renderRows()` recompute.

State surviving the rows it described, covered by neither stated
ADR-0006 exemption (`everExpanded`, `op:'delete'`) and with no exemption
stated. The `pruneByIds`-over-`indexById` mechanism structurally cannot
see these ids, so the fix belongs elsewhere than `onRowsRemoved` — but
the gap is real and undocumented.

## F9 — ADR-0014's 2026-09-24 amendment is honoured in exactly one place

`engine/columns.ts:51` is the only `ngDevMode` gate in `src/`
(grep-verified; the only other hits are in `columns.spec.ts`). Every
other construction check still runs and throws in a production build:
`engine/slots.ts` (stage/render-stage/member collisions),
`engine/rows.ts:19` (bad `trackBy`), `schema/validate.ts`
(`assertDeclarationsAreKnown`), `engine/columns-schema/resolve.ts:44`
(duplicate `metadata()`), `with-grouping/feature.ts:120`
(`applyGrouping` with neither `enable` nor `when`),
`with-filtering/rules.ts:232` (`anyOf([])`), `engine/filters/build.ts:45`.
No wrong result follows, so it ranks last — but it is a direct
conformance gap against the named amendment, worth one decision rather
than seven.

> Same gap the schema/mutations reviewer reports as its F4, found from
> the opposite direction. The amendment landed 2026-09-24 as decision R7
> and is not yet implemented — the gating rides with #129's N2. This is
> owed work, not a latent bug; it matters because the gate must land
> across the whole fold at once.

## Also noted (engine-owned, but `withFiltering`'s stage depends on them)

- `engine/filters/evaluator.ts:107` — `options.when` invoked unguarded
  in `narrowingRecords()`, which runs on the first `matchesRow` call
  inside the `filter` stage (`with-filtering/feature.ts:66-67`). A
  throwing `when` blanks the table, unlike `predicate` two lines down,
  correctly guarded at `evaluator.ts:62-66`.
- `engine/filters/state.ts:59, 85` — `options.source` and
  `options.isEmpty` likewise unguarded inside `computed()`s that
  `criteria()`/`matcher()` read.

All three are `FilterOptions` consumer callbacks, i.e. the class
ADR-0014 assigns the "filter does not apply" fallback to.

## Files read and found clean

- **`with-optimistic.ts`** — declares `onRowsRemoved` off the shared
  editing store; no callbacks, stages, or own state.
- **`with-row-edit.ts`** — `enforceSingleMode`/`closeAllButLast`/
  `closeAll` internally consistent; `setup: () => effect(onMultipleChanged)`
  runs in the injection context `composeTable()` guarantees
  (`compose-table.ts:196`) and tears down with it.
- **`editing/draft-rows.ts`** — the index-parallel invariant holds on
  all three arms; `indexById` and `source` read the same `data()`, so
  the O(k) patch cannot go stale against it.
- **`with-expansion.ts`** — `everExpanded` is the stated ADR-0006
  exemption, seeded explicitly at `:63` to match the store's silent
  construction seed; pruning, teardown and the `changed` diff correct.
- **`with-tree.ts`** — `resolveCallbacks` gives each callback its own
  per-evaluation dedupe flag (not module scope); the `'tree'` stage
  nests via `mapNodes` and never emits siblings; the stage is claimed
  only when `childrenAccessor` is supplied.
- **`with-grouping/feature.ts`** — composes with zero reads of expansion
  state in any argument order; `grouping` (declared, feeds clustering)
  and `appliedGrouping` (derived off the built tree) correctly kept
  acyclic; one pipeline stage, one render stage. Its sole defect (F1) is
  in the engine callback it wires.
- **`with-filtering/feature.ts`, `rules.ts`, `matchers.ts`** — every
  shipped matcher guards its own cell (`matchers.ts:9`);
  `resolveEmptiness`'s three-way precedence is consistent across all
  seven rule builders.
- **`with-selection/utils.ts`** — `selectAllIds` reads only core
  members; `includeHidden` branches correctly between `value()` and
  `rows()`.
- **`with-sorting.ts`'s ordering core** — stable (`[...rows].sort`,
  ES2019+); empty/nulls placement correctly _not_ multiplied by `sign`
  (`:173`); multi-rule tie-breaking walks comparators in rule order; an
  unknown column id drops out via `flatMap` rather than throwing.

`api/features/with-columns-schema/**` does not exist — that code lives
at `engine/columns-schema/**` (ADR-0010, an always-composed internal
step) and was reviewed there. `with-filtering/index.ts`,
`with-grouping/index.ts`, `with-selection/index.ts` are pure re-export
barrels with no logic.
