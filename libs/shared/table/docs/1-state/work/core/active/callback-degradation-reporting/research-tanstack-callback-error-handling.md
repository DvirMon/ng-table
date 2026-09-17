# How other table libraries handle a consumer callback that throws

Research for [#92](https://github.com/DvirMon/acme/issues/92) — whether ADR-0014's "degrade and
report" needs an observable report channel, or whether `console.error` is the right floor.

## Method

Read **published package source**, not branches or recalled API knowledge.

| Package | Version | How read | Ships |
|---|---|---|---|
| `@tanstack/table-core` | **8.21.3** | npm tarball, extracted | `src/` (TypeScript) |
| `@tanstack/table-core` | **9.2.4** (`latest`) | npm tarball, extracted | `dist/` only — no `src/` |
| `@tanstack/query-core` | **5.102.8** | npm tarball, extracted | `src/` |
| `@angular/material` | **22.1.6** | npm tarball, extracted | `fesm2022/table.mjs` |

v9 dist-tags at time of reading: `latest: 9.2.4`, `beta: 9.0.0-beta.80`, `alpha: 9.0.0-alpha.54`.

**Not covered:** AG Grid. Skipped rather than guessed — no verified source was read, so no claim is
made about it here.

**Correction against a false negative:** an initial grep for guarding in `@angular/material` hit a
*non-existent path* (Material is not installed in this repo) and returned empty. Empty output from a
missing file is not evidence. The package was then fetched from npm and re-grepped; the findings
below are from the real file.

## TanStack Table

### A1 — Is there any `try`/`catch` around a consumer callback?

**No. Zero, in both major versions.**

v8.21.3 `src/` contains exactly **two** matches for `try`/`catch`, and neither guards a callback:

- `src/features/ColumnSizing.ts:558` — `passiveEventSupported()`, DOM feature detection:
  ```ts
  try {
    const options = { get passive() { supported = true; return false } }
    const noop = () => {}
    window.addEventListener('test', noop, options)
    window.removeEventListener('test', noop)
  } catch (err) { supported = false }
  ```
- `src/core/table.ts:349` — a `Promise.prototype.catch` on the notify microtask queue, which
  **re-throws** rather than swallowing:
  ```ts
  .catch(error => setTimeout(() => { throw error }))
  ```

v9.2.4 `dist/` contains exactly **one** `try {` across all emitted JS —
`features/column-resizing/columnResizingFeature.utils.js:247`, the same passive-event probe.

So `accessorFn`, `sortingFn`, `filterFn`, `aggregationFn` are all invoked bare. A throw propagates
straight out of the row model into the React render.

### A2 — What happens when a consumer callback throws

It propagates. Row models are built inside memoized getters (`getSortedRowModel`,
`getFilteredRowModel`, `getGroupedRowModel`) called during render. A throw escapes to React, which
unmounts the subtree — recoverable only by a consumer-placed error boundary, which is React-level
infrastructure, not a table feature. The memo boundary does not contain the blast radius; it only
decides *when* the throwing code re-runs.

This is the same failure our ADR-0014 describes as "the entire table goes blank" — TanStack simply
accepts it.

### A3 — Construction-time throws

Every `throw new Error` in v8 is construction- or lookup-time, never data-dependent:

| Site | Trigger | Class |
|---|---|---|
| `core/column.ts:120` | column has an `accessorFn` (or non-string header) but no `id` | construction |
| `core/table.ts:403` | `getRow` called with an unknown id | lookup |
| `features/RowSorting.ts:348` | null-column guard in `getSortingFn` | lookup |
| `features/ColumnGrouping.ts:321` | null-column guard in `getAggregationFn` | lookup |

This **matches our split exactly** — construction throws, runtime does not. TanStack reached the
same classification ADR-0014 did; it just stops there and never adds the runtime half.

One notable idiom — the message is stripped in production to save bundle size:
```ts
if (process.env.NODE_ENV !== 'production') {
  throw new Error(`Columns require an id when using an accessorFn`)
}
throw new Error()
```

### A4 — Dev-only warning channel

Every `console.warn` / `console.error` in table-core is **dev-gated**, and v9 tightened the gate.

v8 uses `process.env.NODE_ENV !== 'production'` — so it also fires under `test`:
- `core/column.ts:104` — a deep `accessorKey` segment resolved to `undefined`
- `utils/getFilteredRowModel.ts:42` — no valid `column.filterFn` for a filtered column
- `core/table.ts:512` — `getColumn` called with an id that does not exist

v9 uses `process.env.NODE_ENV === "development"` — strictly dev, silent in test *and* prod:
```js
if (process.env.NODE_ENV === "development")
  console.warn(`sortFn '${sortFnName}' (auto) for column '${column.id}' is not registered`);
```
(`features/row-sorting/rowSortingFeature.utils.js:100`; same shape in
`column-filtering/…utils.js:54`, and `row-aggregation/…utils.js` wraps it in a local `warn()` helper.)

**This directly contradicts ADR-0014's "report in production too, not dev-only."** Note the warnings
are about *unresolvable configuration* (a filterFn name that isn't registered), not about a callback
that threw — because no callback throw is ever observed.

### A5 — Consumer-facing error or report surface

**Absent in both versions.** Grepping v8 `src/` and v9 `dist/**/*.d.ts` for `onError`, `onWarn`,
`onDegrade`, `errorState` returns nothing. `TableOptions` has no error-shaped member. There is a
`debugAll`/`debugTable`/`debugColumns` family, but it emits timing `console.info`, not failures.

## TanStack elsewhere

### B6 — TanStack Query (`query-core` 5.102.8)

The opposite posture, and deliberately so. `src/` has **14** `try {` blocks, and there are **two
distinct** consumer-facing surfaces:

1. **Per-operation state** — `error: TError | null` on the query result (`src/types.ts:683`, with the
   discriminated success/error unions around `:800–880`).
2. **Global config callback** — on both caches:
   ```ts
   export interface QueryCacheConfig {
     onError?: (error: DefaultError, query: Query<unknown, unknown, unknown>) => void
     onSuccess?: (data: unknown, query: Query<unknown, unknown, unknown>) => void
     onSettled?: (...) => void
   }
   ```
   (`src/queryCache.ts:20`; `src/mutationCache.ts:19` mirrors it for mutations.)

### B8 — The pattern

TanStack does not have one house style. It splits on **whether failure is an expected domain
outcome**:

- **Query** — a `queryFn` hitting the network *is expected to fail*. Failure is a first-class
  domain state with a retry policy, so it gets both per-operation state and a global hook.
- **Table** — a `sortingFn` is *pure local computation over data you already hold*. A throw there is
  a programming error, not a domain outcome. It gets nothing.

Our five callbacks (`accessor`, `sortFn`, `aggregateFn`, filter predicates, `groupOrder`) are all in
the second category.

## Cross-check

### C10 — Angular Material `MatTableDataSource` (22.1.6)

`fesm2022/table.mjs`: **0** `try {` in the entire file. Both consumer callbacks are invoked bare:

```js
// :1052–1053
let valueA = this.sortingDataAccessor(a, active);
let valueB = this.sortingDataAccessor(b, active);

// :1102
this.filteredData = this.filter == null || this.filter === ''
  ? data
  : data.filter(obj => this.filterPredicate(obj, this.filter));
```

One `console.` call in the whole file. No error channel.

## Verdict

### Does the battle-tested prior art catch? No.

Three independent libraries — TanStack Table v8, v9, and Angular Material — invoke consumer
comparators, accessors and predicates completely unguarded. Two of them are among the most-deployed
table implementations in existence. Nobody has forced a `try` into that hot loop.

**Read honestly, this cuts both ways:**

*Against ADR-0014 (over-engineering risk):*
- The failure mode is real but evidently rare enough that no major library has paid for it.
- A `try`/`catch` per filter-evaluation is a real cost in the hottest loop the library has.
- React consumers already have error boundaries; ours is Angular, but the equivalent argument holds —
  app-level error handling is the consumer's layer, not the table's.
- If this mattered at the frequency ADR-0014 implies, v9 — a ground-up rewrite shipped this year —
  was the moment to add it. It did not.

*For ADR-0014 (genuine differentiator):*
- Prior art's silence is not validation; three libraries sharing an omission is one data point about
  convention, not three about correctness. TanStack's own v8 warnings show they *knew* about
  misconfigured `filterFn`s and chose a dev-only warn.
- The blast radii differ. TanStack blanks a React subtree recoverable by an error boundary. Our
  callbacks run inside `computed()`, so the throw surfaces at whatever reads `rows()` and **stays
  failed until an input changes** — a stickier failure than React's.
- Our R21/R27 exposure is genuinely worse than TanStack's: `filter(path, predicate)` hands the
  consumer an unguarded cell *by design*, and criteria are revived from `localStorage` under a schema
  that may predate the predicate. TanStack's built-in `filterFns` guard their own nulls and its
  criteria are not persisted by the library. We built a sharper edge; guarding it is consistent.

**Net:** keeping the catch + fallback is defensible as a deliberate, documented divergence — but
ADR-0014 should stop citing it as obvious and state plainly that prior art does the opposite, with
the `computed()` stickiness and the R27 unguarded-cell design as the reasons we diverge.

### Does the prior art expose a report channel? No — and this is the stronger finding.

Zero consumer-visible error surface in table-core v8 or v9, or in Material. The only reporting is
dev-gated `console.warn`, and v9 *narrowed* the gate from "not production" to "development only" —
moving away from ADR-0014's "report in production too," not toward it.

**This supports the current leaning.** The evidence says: keep `console.error` as the floor, do not
build a cross-cutting `onDegrade` surface across five callbacks for one demo consumer.

The distinction that matters — and TanStack's own split proves it is a real one — is that
**catching and reporting are separate decisions**. Query catches *and* reports, because network
failure is a domain outcome. Table does neither, because a throwing comparator is a bug. We are
proposing to sit in between: catch (justified above by `computed()` stickiness) but not publish
(unjustified by any demand except a story host). That middle position is coherent, and it is the
one the evidence best supports.

### On the one consumer that did need it

The `console.error` monkey-patch in `client-filtering-story-host.component.ts:346` is a *story host* —
library code demonstrating library behavior, not an application. Building public API for it is
scope inversion. Give the demo a supported seam if it needs one; do not promote it to a table-wide
contract.

## Open questions this did not settle

1. **Is the `computed()` stickiness argument actually true for our engine?** The claim that a throw
   leaves the table failed until an input changes was reasoned from Angular signal semantics, not
   verified against our pipeline. Worth a probe before ADR-0014 leans on it.
2. **AG Grid was not checked.** It is the one major library with a formal event bus, so it is the
   most likely counter-example to "nobody exposes a channel."
3. **What seam does the story host get instead?** Not answered here.
4. **Does the per-row `try` cost anything measurable in our evaluator?**
   `docs/tooling/test-performance-audit.md` exists in the tree and may already be a place to measure it.
