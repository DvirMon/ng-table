# Correctness pass — `libs/table/src/engine/**`

**Date:** 2026-09-24 · Criteria: `libs/table/CLAUDE.md` engine
invariants, ADR-0006, ADR-0011, ADR-0014 (incl. the 2026-09-24
amendment), ADR-0023. Source only. Ranked most severe first.

---

## 1. `engine/filters/evaluator.ts:107` — a throwing `when` blanks the table

`narrowingRecords()` runs the consumer's `options.when` unguarded
inside the `filter` pipeline stage:

```ts
const isGatedOff = when && !when(buildValueOfContext<TRow>(internal));
```

**Scenario.** `withFiltering({ schema: (p) => ({ country: equals(p.country),
city: equals(p.city, { when: (ctx) => (ctx.valueOf(p.country) as string).length > 0 }) }) })`.
`valueOf` returns `node.value()`, which is `equals`'s `emptyValue`
(`undefined`) before anything is typed → `undefined.length` throws on
first render. It propagates `when` → `narrowingRecords()` →
`matchesRow` → `rows.filter(matcher)`
(`api/features/with-filtering/feature.ts:64`) → `runPipeline` → the
`rows` computed → the template. Entire table blank — exactly ADR-0014's
stated blast radius.

Two more sites, same callback family:

- `engine/filters/state.ts:98` — `gateByCondition`'s
  `computed(() => condition(ctx) ? base.criterion() : undefined)` runs
  `when` unguarded, and additionally feeds `criteria()`, `isActive()`
  and template bindings on them.
- `engine/filters/state.ts:59` — `computed(source)` runs
  `options.source` unguarded; a throw kills `sourceValue()`, `dirty()`,
  the `linkedSignal` behind `value()`, then `criterion()` and the filter
  stage.

`evaluateRecord` (`evaluator.ts:40-67`) _is_ correctly wrapped — the
guard was written for the predicate and never extended to the two
callbacks in front of it.

---

## 2. `engine/grouping/clusters.ts:133` — a throwing `extractValue` blanks the table

```ts
const extractValue = extractValueByColumn?.get(columnId);
return extractValue ? extractValue(raw) : raw;
```

**Scenario.** `applyGroupKey(path.createdAt, (d) => (d as Date).toISOString().slice(0, 7))`
— a month bucket, the canonical use. One row with `createdAt: null`
throws `TypeError`. Callers are `buildClusterNodes` → `clusterRows`
(the `group` pipeline stage) and `buildGroupRenderRows` (the `group`
render stage), both inside the `rows`/`renderRows` computeds.

Sharp because **every other grouping callback on the same path is
wrapped**: `when` via `evaluateGroupWhen` (`clusters.ts:174-182`),
`groupOrder` via `orderWithComparator` (`clusters.ts:305-311`),
`aggregateFn` via `computeAggregates` (`grouping/render.ts:68-75`),
`accessor` via `readAccessor`. `extractValue` is the lone omission, and
has an obvious ADR-consistent fallback (return `raw`, report once per
column).

---

## 3. `engine/columns-schema/wiring.ts:44-48, 62, 70, 72` — four unwrapped schema callbacks

| Line  | Callback                                            |
| ----- | --------------------------------------------------- |
| 44-48 | `rule.logic(ctx)` — `metadata()` / `applyVisible()` |
| 62    | `rule.params(ctx)`                                  |
| 70    | `rule.onSuccess(value)`                             |
| 72    | `rule.onError(resourceRef.error())`                 |

**Scenario.** `applyVisible(p.total, (ctx) => ctx.columns().find((c) => c.id === 'currency')!.visible)`,
then `table.columns.update(setColumns(without('currency')))` → `find`
returns `undefined` → throw propagates out of the entry's `result`
computed → `foldColumnRules` (`columns.ts:150`) → the `columns` computed
(`core.ts:43`) → `renderRows` (`core.ts:92`) → template. Column state
and every render row die together.

`onError` is the worst: it runs only on a failed request, so a bug in it
is invisible until the server is already down, then converts a handled
fetch failure into a dead table.

---

## 4. `engine/rows.ts:46` — `resolveIndex` crashes on the exact case its fallback claims to cover

```ts
const at = indexById.get(id);
const isFreshCacheHit = at !== undefined && trackBy(rows[at]) === id;
```

`rows[at]` is not bounds-checked. When `indexById` is stale _and_ `rows`
is shorter, `at >= rows.length` → `trackBy(undefined)` → `TypeError`
(both the key form via `normalizeTrackBy`'s `row[key]`, and a consumer
`(r) => r.id`).

**Scenario** — composing two row updaters in one write, the shape the
library itself uses at `mutations/row-edit-mutations.ts:67`:

```ts
// rows: [{id:'a'},{id:'b'},{id:'c'}], indexById: {a:0,b:1,c:2}
table.value.update((rows, ctx) => patchRow('c', { name: 'x' })(removeRow('a')(rows, ctx), ctx));
```

`removeRow` returns a 2-element array; `patchRow` calls
`resolveIndex(shorter, 'c', { indexById })`; `indexById.get('c') === 2`;
`shorter[2]` is `undefined`; the write throws inside `signal.update`.

The doc comment at `rows.ts:36-39` asserts this is impossible ("always
correct since the fallback never trusts a stale hit") and names chained
writes as the reason the guard exists. The guard handles a hit pointing
at a _different_ row, not one pointing past the end. Fix is one clause:
`at !== undefined && at < rows.length && …`. Latent today (every
internal caller passes a post-`insertRow` array, which only grows), but
`RowUpdater`/`EditingUpdater` composition is public.

---

## 5. `engine/core.ts:43` — `columnRules` registered after the first read of `columns()` are invisible

```ts
const columnRules: ColumnRuleEntry<TRow>[] = [];
const columns = computed(() => foldColumnRules(baseColumns(), columnRules));
```

`columnRules` is a plain mutable array that `composeTable()` keeps
pushing into during the fold (`compose-table.ts:121-123`). A rule pushed
_after_ the computed has evaluated changes no tracked dependency, so the
computed doesn't re-run.

`core.ts:14-17` claims this is safe because registries are read at
evaluation time and the fold completes before any consumer read. That
holds only if nothing reads `columns()` during the fold — and
`api/features/with-grouping/feature.ts:114` calls `input.columns()`
eagerly in the factory body to validate declared levels.

**Scenario.**

```ts
createTable(
  data,
  { trackBy: 'id', columns },
  withGrouping({ initial: ['dept'] }),
  myFeature, // { columnRules: [{ columnId: 'dept', key: MY_KEY, result: someSignal }] }
);
```

`withGrouping` caches the fold over only the internal column-schema
rules; feature 2's entry is then pushed and never applies.
`readColumnMeta(col, MY_KEY)` is `undefined` until something else
invalidates the computed (a `baseColumns` write, or a change in an
already-tracked rule signal), at which point it silently starts working.
`columnRules` is additive and not slot-claimed
(`engine/types.ts:88-92`), and `api/features/compose-features.ts:102`
plus its spec exercise exactly this shape. Swapping argument order fixes
it; nothing enforces the order.

---

## 6. `engine/core.ts:59-70` — the `expanded` computed can freeze with zero dependencies

```ts
const expanded = computed<ReadonlySet<RowId> | undefined>(() => {
  if (expandedSources.length === 0) return undefined;
  ...
});
```

Evaluated while `expandedSources` is still empty, that branch reads **no
signal at all**. A dependency-free Angular `computed` is evaluated once
and never re-evaluated, pinning `expanded()` to `undefined` for the
table's lifetime. `flattenVisible` reads `undefined` as "no feature
contributed — everything stays open" (`flatten.ts:29`), so collapse
stops working permanently and silently.

Trigger is any read of `renderRows()` before the feature declaring
`expandedRows` folds. No shipped feature does this today, so it is
latent — but `renderRows` is on the store handed to every factory
(`compose-table.ts:68`), CLAUDE.md permits factories to read core
members, and finding 5 proves factory-time core reads already happen.
The `length === 0` early return is what makes this a hard freeze rather
than 5's recoverable staleness.

---

## 7. `engine/grouping/rules.ts:121` — `maskGroupingLevels`' abstain path drops dependency tracking

```ts
for (const entry of entries) {
  const value = entry.result();
  if (value === undefined) return [...levels];
  results.set(entry.columnId, value);
}
```

The early `return` leaves later entries' `result` signals unread, so the
enclosing computed (`api/features/with-grouping/feature.ts:140`) does
not depend on them. Unlike `buildFiltersRoot`'s deliberate short-circuit
(`filters/state.ts:174-184`, sound because an untracked node cannot
change a `true`), an untracked entry here _can_ change the answer.

**Scenario.** Two `applyGroupingAsync` rules — `dept` (entry 0, resource
stuck `'loading'` behind a slow endpoint) and `region` (entry 1). First
evaluation: entry 0 is `undefined` → return `['dept','region']`
unmasked, only entry 0 tracked. `region` resolves `false`. No tracked
signal changed → `grouping()` never recomputes → the table keeps
grouping by `region`, a level whose own rule switched it off, until
`dept` settles.

---

## 8. `engine/compose-table.ts:212-224` — synthesized ids in `expandedRows` are unreachable by ADR-0006 pruning

The reconciliation effect diffs `indexById`, built from `config.data()`
(`core.ts:76-80`), so it can only announce ids `trackBy` produced from a
real row. Group header ids are minted as `group:<path>`
(`grouping/clusters.ts:76`) and never enter `data`. But `expandedRows` —
the slot `flattenVisible` reads — is exactly where those ids must go to
open a group: `api/features/with-tree.ts:260` contributes
`computed(() => store.expanded())`, and the documented route is
`table.tree.expand([...table.groupIds()])`.

**Scenario.** Group by `dept`; expand all, so `store.expanded()` holds
`group:>dept:string:Sales`. Delete every Sales row. `diffRemovedIds`
announces the row ids and the store prunes those; the group id is
announced by nobody and stays forever. Two consequences:

- Re-add a Sales row and the group renders **pre-expanded**,
  contradicting ADR-0006's stated consequence ("delete it, re-add the
  same id, and it no longer returns expanded").
- The set grows without bound across regroupings — toggle the level
  `dept` ↔ `region` repeatedly and every generation's ids are retained.

`pruneByIds` itself is correct; nothing ever calls it with a synthesized
id. The two recorded exemptions (`everExpanded`, `op: 'delete'`) don't
cover this, so it's unanswered rather than accepted.

---

## 9. `engine/columns.ts:176` — `foldColumnRules` discards an author-supplied `column.meta`

```ts
const withVisible = visible === column.visible ? column : { ...column, visible };
return meta ? { ...withVisible, meta } : withVisible;
```

`meta` is built fresh from rule entries only (lines 168-173) and
**replaces** the column's own `meta` wholesale instead of merging.
`meta` is settable on input —
`ColumnDefInput = Pick<ColumnDef,'id'> & Partial<Omit<…>>`
(`api/types.ts:106-110`) — and `resolveColumnDefs` spreads `...def`
(`columns.ts:54`), carrying it into `baseColumns` intact.

**Scenario.** `columns: [{ id: 'total', meta: new Map([[WIDTH_KEY, 120]]) }]`
plus `columnsSchema: (p) => { metadata(p.total, ALIGN_KEY, 'right'); }`.
`readColumnMeta(col, ALIGN_KEY)` → `'right'`;
`readColumnMeta(col, WIDTH_KEY)` → `undefined`. The authored entry
vanishes with no error, purely because some _other_ key on the same
column had a rule. A column with no rules keeps its `meta` (fast path at
line 161), so the behavior differs between columns in one table.

---

## 10. ADR-0014's 2026-09-24 amendment is applied at one of six construction-check sites

Construction checks are ruled dev-only and stripped from production. In
`engine/` that's honoured only at `columns.ts:51`
(`assertUniqueColumnIds`, with the local `declare const ngDevMode` at
`columns.ts:17`). Ungated:

| Site                           | Check                                            |
| ------------------------------ | ------------------------------------------------ |
| `slots.ts:73`                  | stage / render-stage / member collisions         |
| `rows.ts:19`                   | `trackBy` resolving to a non-`RowId`             |
| `columns-schema/resolve.ts:44` | duplicate `metadata()` per key per column        |
| `columns-schema/resolve.ts:23` | `assertDeclarationsAreKnown` (unknown column id) |
| `filters/validate.ts:16, 22`   | empty `anyOf`; two filters on one path           |
| `filters/build.ts:45`          | schema fn not returning an object literal        |

A conformance gap against a decision dated today, not a wrong result on
its own — hence ranked below 1-9. Worth one pass, since the gating idiom
already exists in `columns.ts`.

`rows.ts:19` needs a decision rather than a mechanical wrap: despite
ADR-0014 listing "bad `trackBy`" as construction-class,
`normalizeTrackBy` returns a closure that throws **per row at pipeline
time**. Gating it on `ngDevMode` would diverge per-row behavior between
dev and prod — the thing the ADR's rejected "throw in dev, degrade in
production" alternative rules out.

---

## Purity invariant — statement vs. code (not a defect)

CLAUDE.md: "Everything in `engine/` except `compose-table.ts` is pure —
no signals, no Angular." Value-level `@angular/core` imports outside
`compose-table.ts`: `engine/core.ts` (`signal`, `computed`),
`engine/writable-view.ts` (`computed`), `engine/filters/state.ts`
(`computed`, `signal`, `linkedSignal`, `untracked`),
`engine/grouping/rules.ts` (`computed`, `linkedSignal`),
`engine/columns-schema/wiring.ts` (`computed`, `linkedSignal`).
`engine/columns.ts` and `engine/types.ts` import `Signal` type-only and
are unaffected.

Not reported as a defect: CLAUDE.md's own file table describes `core.ts`
as owning "the pipeline computeds" and `writable-view.ts` as built on
`computed()`, so the code is the intended design and the one-line
invariant is the stale half. Worth narrowing that sentence so it stops
reading as a rule the engine breaks in five places.

---

## Files read and found clean

`engine/pipeline.ts`; `engine/render-stages.ts` (`mapNodes`' "return
value used as-is, never re-descended" is documented and
ADR-0023-consistent; `runRenderStages`' `?? current` cannot mask an
`undefined` return under the declared types); `engine/flatten.ts` (the
`undefined` vs. defined-but-empty distinction is handled exactly as its
remarks describe; `hasChildren ?? children.length > 0` matches
ADR-0023's lazy override); `engine/slots.ts` (aside from item 10);
`engine/writable-view.ts`; `engine/types.ts`; `engine/grouping/pipeline.ts`;
`engine/grouping/queries.ts` (the frontier walk and
`findClusterByPath`'s path reconstruction agree with `buildGroupNodes`'
emission for every renderable id); `engine/grouping/render.ts` (aside
from item 2, reached from it); `engine/filters/validate.ts`;
`engine/filters/types.ts`; `engine/filters/build.ts`;
`engine/columns-schema/wire-columns-schema.ts`;
`engine/columns-schema/index.ts`; `engine/cells.ts` (`readAccessor`'s
wrap and per-evaluation dedup match ADR-0014 exactly;
`buildGroupCells({...undefined})` is `{}`, correct for an
aggregate-less group); and `engine/rows.ts`'s `diffRemovedIds` /
`pruneByIds` (both union arms preserve reference identity when nothing
changed; `isMapContainer`'s `'get' in container` narrowing is sound for
the declared union).
