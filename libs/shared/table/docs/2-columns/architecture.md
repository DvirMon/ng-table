---
title: Architecture — Column Schema DX (`columnsSchema`) — Hub
type: architecture
version: 0.3
date: 2026-07-24
status: partially implemented — schema wiring, `metadata()`/`applyVisible`/`applyVisibleAsync` (Tier 1) shipped; Tier 2/3 and the generic per-key reducer core are still spec only (see [column-metadata.md](reference/column-metadata.md))
audience: developers
parent: ../1-state/architecture.md
---

# Architecture — Column Schema DX (`columnsSchema`)

Hub/index for the `columnsSchema` design. Cross-cutting decisions, grounding, core types, and
store wiring live here; per-concern detail is split into [`2-columns/reference/`](reference/) (the
same per-file split `1-state/architecture.md` uses for state features).

## Companion documents

| Doc | Covers |
|---|---|
| [2-columns/reference/ownership-model.md](reference/ownership-model.md) | The seed-vs-rule contract, three input shapes (static / reactive / async), store-owns-reactivity law, snapshot-diff patcher. **Read first.** |
| [2-columns/reference/tier-1-intrinsic.md](reference/tier-1-intrinsic.md) | `applyVisible` (+Async), `applyOrder` — column-owned, no store feature. First-impl scope. |
| [2-columns/reference/tier-2-layout.md](reference/tier-2-layout.md) | `applyWidth`, `applyFlex` — column-owned sizing. `applyPinned` — seeds a new `withColumnPinning()` store feature, not a column field. The real gaps. |
| [2-columns/reference/tier-3-feature-config.md](reference/tier-3-feature-config.md) | `applyEnableSorting`, `applySortFn`, `applyDefaultSort`, `applyEnableFiltering`, `applyFilterFn`, `applyGroup`, `applyAggregateFn` — seed opt-in store features. |
| [2-columns/reference/data-derived.md](reference/data-derived.md) | **REJECTED** — data-derived column set (from row keys). Kept for historical record only; `columnsSchema` alone covers the DX need. |
| [2-columns/reference/signal-forms-techniques.md](reference/signal-forms-techniques.md) | Seven techniques mined from Signal Forms source — metadata+reducer, reducer-vs-reject, `{ when }`, `applyEach`, `apply`/`schema`, `assertPathIsCurrent`, `NoInfer`. Two are open decisions. |
| [2-columns/reference/column-metadata.md](reference/column-metadata.md) | **Implemented.** `createColumnMetaKey`/`metadata`/`readColumnMeta` — consumer-facing, non-participating column side channel. Not the same as this table's internal metadata+reducer core sketched in signal-forms-techniques.md §1. |

## Executive Summary

Specs a new, opt-in `columnsSchema` on `createTable()`, modeled deliberately on Angular's **Signal
Forms** API (`form(model, schemaFn)`, `disabled(path, {when})`, `validateAsync(path, {params,
factory, onSuccess})`). The schema is provided **at the `createTable()` level** — an inline
`schemaFn` receiving a typed `path` proxy, alongside the existing plain-array `columns` config. It
replaces hand-rolled `effect()` + `resource()` + `updateColumns()` wiring in the consumer with a
declarative schema: the `path` proxy targets a column by field name, and composable `apply*`
functions layer sync or async behavior onto it.

The same `schemaFn` can be extracted into a standalone `columnSchema<TRow>(fn)` value for reuse
across tables — exactly the pair Signal Forms ships (inline `form(model, schemaFn)` **and** standalone
`schema(fn)`). Inline is the headline path; the standalone helper is the reuse escape hatch.

**This is an architecture/spec document, not an implementation** — it defines the contract to build
against, the same way `1-state/architecture.md` specs a feature before it's coded. A future
session implements directly from these docs.

**Trigger:** `updateColumns()` (shipped — see `1-state/columns.md`'s Methods table) gave the
store a `.update()`-style companion to `setColumns()`. Using it in `apps/demo/src/app/table-demo/`
to drive a permission-gated column surfaced a UX gap (flash-then-hide) and a bigger question: should
every consumer hand-roll this, or should the store offer a first-class declarative DX for it? This
doc is the result of that design conversation.

---

## Decisions (settled, not open for relitigation)

- **Full slice, sync + async.** `applyVisible`, `applyOrder`, and `applyVisibleAsync` are all
  in scope for the first implementation. Other `ColumnDef` fields get the same `apply*` treatment
  later — see the tier files.
- **Additive, not a replacement — a new sibling field, not a widened one.** `columns` is
  `ColumnDefInput<TRow>[]` (only `id` required — shipped 2026-07-25, `table-demo.store.ts` and
  every existing `table.store.spec.ts` case stay untouched). The schema is a **separate, optional**
  `columnsSchema` config field. No union on `columns`, no `Array.isArray()` discriminant — a
  cleaner split than an overloaded `columns` field.
- **Schema at the `createTable()` level, mirroring `form(model, schemaFn)`.** The `columns` array is
  the "model"; `columnsSchema` is the `schemaFn` — both live on the config object returned by the
  `optsFn` (second arg of `createTable(data, optsFn)`):

  ```ts
  createTable<Product>(data, () => ({
    trackBy: 'id',
    columns: [{ id: 'name' }, { id: 'status' }, { id: 'price' }],   // base — plain array, unchanged
    columnsSchema: (path) => {                                       // inline schema fn
      applyVisible(path.status, { when: () => role() === 'admin' });
      applyOrder(path.price, 0);
    },
    features: [withSorting()],
  }));
  ```

  `columnsSchema` receives a typed `path` proxy (one property per `keyof TRow`) used only to layer
  `apply*` rules on top; it does not redefine shape.
- **Standalone `columnSchema<TRow>(fn)` for reuse.** `columnsSchema` accepts **either** an inline fn
  **or** a standalone `columnSchema<TRow>(fn)` value — the same duality as `form()` accepting an
  inline fn or a `schema()` value. The standalone form lets a consumer define a column schema once and
  share it across tables. It is the secondary path — not hidden/internal, just not the headline.

  ```ts
  const adminCols = columnSchema<Product>((path) => { applyVisible(path.price, { when: () => isAdmin() }); });
  createTable<Product>(data, () => ({ trackBy: 'id', columns, columnsSchema: adminCols, features: [...] }));
  ```
- **Store owns the async resource lifecycle for `apply*Async`-configured columns.** A deliberate,
  scoped reversal of "reactivity lives in the consumer" (recorded in `1-state/columns.md`) — but
  only for this opt-in path. Plain-array `columns` config keeps today's consumer-owned pattern as the
  default. Extended to the sync-*reactive* shape too — see
  [ownership-model.md](reference/ownership-model.md).
- **Conflicting rules on one column property: currently throws, not combined via a reducer.**
  Superseded 2026-07-25 — see
  [signal-forms-techniques §2](reference/signal-forms-techniques.md#2--reducers-replace-conflict-rejection--decided-2026-07-25--reducer-combine-reverses-the-earlier-settled-decision).
  The generic per-key reducer this decision describes is **not implemented** — shipped code
  (`assertMetadataKeysAreUnique` in `engine/columns-schema/resolve.ts`) throws
  synchronously on a duplicate `metadata()` registration for the same `(columnId, key)`. The one
  exception is the internal `VISIBLE` key: multiple `applyVisible`/`applyVisibleAsync` calls on
  the same column id are hardcoded AND-combined in `foldColumnRules` (`engine/columns.ts`), not
  driven by a general per-key reducer table. See
  [column-metadata.md](reference/column-metadata.md) for the full implemented-vs-spec
  breakdown.
- **`apply*Async` has an optional `onError`**, mirroring `validateAsync`'s `onError` — lets a
  consumer choose the fallback on request failure instead of freezing at the last-resolved value.
- **Which variant to use — `applyVisible` vs. `applyVisibleAsync` — is about who owns the value at
  runtime, not whether it happened to be fetched.** Backported from
  [`work/with-grouping/2-decisions.md`](../1-state/work/with-grouping/2-decisions.md) D13, which
  names the same criterion for `applyGrouping`/`applyGroupingAsync`; this file described the two
  as counterparts without ever stating when to choose which.

  | | `applyVisible` (sync/reactive) | `applyVisibleAsync` (resource-backed) |
  |---|---|---|
  | Use when | the value is settled by the time it matters, however it was obtained | the server owns it at runtime and it can change; the rule must re-query |
  | Owns fetching | consumer | the rule (`params`/`factory`) |
  | Owns success/error | consumer, upstream | the rule (`onSuccess`/`onError`) |

  A value fetched once at init and closed over (e.g. `linkedSignal(() => prefs.value()?.canSeeCol
  ?? …)` read inside `{ when }`) is the sync case, not the async one — it is async only in *how*
  it was obtained, and `applyVisible`'s `{ when }` already runs reactively off that signal.
  `applyVisibleAsync` is strictly heavier and is for the case that must re-query: default to
  `applyVisible`, reach for `applyVisibleAsync` only when the rule itself must own re-fetching.
- **Data-derived column set — rejected 2026-07-31.** A `createColumns(data, schemaFn)` overload
  deriving columns from row-data keys at runtime was proposed and rejected — never a dependency of
  `columnsSchema`, and a later variant (`createColumns(baseColumns, schemaFn)` wrapping the existing
  `columns` array) was independently rejected too: it reintroduces the union/`Array.isArray()`
  discriminant the sibling-field design above avoids, and can't carry async/reactive rules since it
  wouldn't run inside `createTable()`'s store-construction DI context. See
  [data-derived.md](reference/data-derived.md) (kept for historical record only).
- **Every `apply*` accepts three input shapes — static / reactive / async — and the store always owns
  reactivity.** The reactive form uses `{ when }` (not a bare function). Full contract in
  [ownership-model.md](reference/ownership-model.md).

  > **Revision (2026-07-24):** reverses an earlier position that made `applyVisible`'s function form
  > snapshot-once/eager. The store owns the reactive `effect()` at construction, so the reactive
  > shape is now genuinely live, matching Signal Forms' `disabled(path, {when})`. Static behavior is
  > still reachable — pass a resolved value, not `{ when }`.

---

## Grounding (confirmed against actual source, not assumed)

- `api/features/with-sorting.ts` is the reference feature-factory shape: a single
  `(core: SortingInput<TRow>) => TableFeatureSpec<TRow, SortingMembers>` factory that owns its own
  signals and returns `{ members, stages }`, reading `core.columns()` — same posture the schema
  resolution internals take. (Superseded 2026-08-11: the old
  `signalStoreFeature({state, props}, withState(...), ...)` chain and the `store._pipeline`
  mutation it relied on are gone — see ADR-0003.)
- `TableFeatureSpec` carries `setup` / `onDestroy` — the right primitive for the async wiring.
  `composeTable()` runs every `setup` after the full feature fold, inside the owner's injection
  context, so `inject()`, `effect()`, and `resource()` all work there with cleanup against that
  scope's `DestroyRef`.
- Signal Forms API shapes confirmed against `node_modules/@angular/forms/types/signals.d.ts` (Angular
  21.2.9): `form(model, schemaFn)`, `schema<T>(fn)`, `apply(path, schema)`, `applyWhen(...)`,
  `validateAsync(path, {params, factory, onSuccess, onError})`. `columnsSchema` borrows the
  `model + schemaFn` shape and the async rule shape; it does **not** borrow `apply`/`applyWhen`/
  `schema` composability in the first pass (revisit per
  [techniques §5](reference/signal-forms-techniques.md#5--applypath-schema--schema-reuse--defer--revisits-no-composability)).
- Signal Forms **internals** confirmed against fetched `angular/angular` source: the schema-path
  proxy is purely structural — `FIELD_PATH_PROXY_HANDLER`
  (`packages/forms/signals/src/schema/path_node.ts:102-110`) fabricates a child for *any* property
  accessed and reads zero model data; typing is 100% compile-time. The data-bound field tree is a
  *separate* reactive computed deriving fields via `Object.keys(value)` (`field/structure.ts:346`),
  tracking array items by a synthetic identity symbol (`structure.ts:365`). This two-tree decoupling
  grounds [data-derived.md](reference/data-derived.md). Rule accumulation + reducers
  (`schema/logic_node.ts`, `api/rules/metadata.ts`) ground
  [techniques §1–2](reference/signal-forms-techniques.md).

---

## Types and runtime shape

### `ColumnDefInput<TRow>` — shipped 2026-07-25

Implemented ahead of `columnsSchema` itself, in `api/types.ts`/`api/create-table.ts` — this is the
real type, not a spec placeholder:

```ts
export type ColumnDefInput<TRow = unknown> = Pick<ColumnDef<TRow>, 'id'> &
  Partial<Omit<ColumnDef<TRow>, 'id'>>;
```

Only `id` is required; every other `ColumnDef` field is optional. `resolveColumnDefs()`
(`api/create-table.ts`) defaults the three that used to be required: `accessor ?? (row) =>
row[id]`, `visible ?? true`, `order ?? index` (array position). `TableStoreConfig.columns` and
`TableStore.setColumns()` both take `ColumnDefInput<TRow>[]`; the resolved store state
(`store.columns()`) is always a full `ColumnDef<TRow>[]`. No requirement that every `keyof TRow`
have an entry; no support for columns outside `keyof TRow` (derived columns) in this first
pass — see Open Questions.

### `ColumnsPath<TRow>` — must be a real `Proxy`

`keyof TRow` is compile-time only; the path proxy mirrors the *type*, not just what's present in
`baseColumns`. The `get` trap fabricates a `ColumnHandle<TRow, K>` for any string property accessed
(same structural design as Signal Forms' `FieldPathNode`):

```ts
export type ColumnsPath<TRow> = {
  readonly [K in Extract<keyof TRow, string>]: ColumnHandle<TRow, K>;
};

/** @internal */
export declare const COLUMN_RECORDER: unique symbol;

export interface ColumnHandle<TRow, K extends Extract<keyof TRow, string> = Extract<keyof TRow, string>> {
  readonly id: K;
  readonly [COLUMN_RECORDER]: ColumnSchemaRecorder<TRow>;
}
```

Full `apply*` signatures live in the tier files. `ColumnRuleContext<TRow>` and the sync/async rule
types live in `schema/column-rules.ts` (see [File layout](#file-layout-for-the-implementation-session)).

### Config surface

```ts
export type ColumnsSchemaFn<TRow> = (path: ColumnsPath<TRow>) => void;

/** Opaque, compiled form of a schema fn — the standalone-reuse value. */
export interface ColumnSchema<TRow> {
  readonly kind: 'column-schema';
  readonly rules: readonly ColumnRule<TRow>[];
}

export interface TableStoreConfig<TRow, Features extends readonly AnyTableFeature[] = []> {
  trackBy: TrackByConfig<TRow>;
  columns: ColumnDefInput<TRow>[];                              // shipped 2026-07-25 — was ColumnDef<TRow>[]
  columnsSchema?: ColumnsSchemaFn<TRow> | ColumnSchema<TRow>;   // new, optional sibling
  features?: Features;
}
```

`columns` keeps its own type — no union with `columnsSchema`, no `Array.isArray()` discriminant.
`columnsSchema` is purely additive on top of it.

### `columnSchema()` — the standalone helper

```ts
export function columnSchema<TRow>(fn: ColumnsSchemaFn<TRow>): ColumnSchema<TRow>;
```

Runs `fn` once, eagerly, at call time (module scope — no injection context; DI-requiring work is
deferred to store construction), recording its `apply*` calls into a `ColumnSchema<TRow>` value.
Validates and throws synchronously so a bad schema fails at module load:

- every recorded rule's `columnId` exists in `columns` (unknown-id check, done at store
  construction where both are available);
- the conflict checks in Decisions (subject to the reducer reconsideration).

Inline `columnsSchema: (path) => {...}` and `columnsSchema: columnSchema(fn)` compile to the same
internal `ColumnSchema<TRow>` — the store normalizes an inline fn by running it through the same
recorder. Adopt `assertPathIsCurrent` (reject a `path.x` used outside the running fn) and `NoInfer`
on rule args — see [techniques §6–7](reference/signal-forms-techniques.md#6--assertpathiscurrent--guard-stale-path-handles--adopt).

---

## Feature Catalog

Full `apply*` set, grouped **by ownership** — *not* by end-user value. The tier axis answers "does
the column schema own this concern, or is it seeding config for a store feature that owns it?" This
traces the store-owned vs column-owned line the whole architecture is built on
(`overview.md`).

| Tier | Property class | Owner | Detail |
|---|---|---|---|
| **1 — Intrinsic** | identity / presence | column def only (no store feature) | [tier-1-intrinsic.md](reference/tier-1-intrinsic.md) |
| **2 — Layout** | geometry / framing | mixed: sizing = column def only; pinning = seeds `withColumnPinning()` store feature | [tier-2-layout.md](reference/tier-2-layout.md) |
| **3 — Feature config** | pipeline behavior | store feature; column seeds it | [tier-3-feature-config.md](reference/tier-3-feature-config.md) |

**Ship order = tier order.** Tier 1 first (first-impl scope), then Tier 2 (the real gaps), then
Tier 3 (future work). Rationale: more users hit sizing/pinning than custom sort/filter predicates,
and Tier 3 degrades to store defaults while Tier 2 has nothing today.

The [ownership model](reference/ownership-model.md) (seed vs rule, three input shapes,
snapshot-diff patcher) applies uniformly across all three tiers.

---

## Wiring into `createTable()`

`createTable(data, optsFn)` evaluates `optsFn()` once at construction; `columns` / `columnsSchema`
are read off that resolved config (see ADR-0002). `buildStoreClass()` gains one resolution step ahead
of `withState`, and one new composed feature (`wireColumnsSchemaAsync`) always spliced into
`coreFeature` right after the existing `withMethods` block:

- No `columnsSchema` → `resolveColumnsConfig()` passes `columns` through unchanged, `asyncRules: []`.
- `columnsSchema` present (inline fn or `columnSchema()` value) → normalize to `ColumnSchema<TRow>`,
  validate `columnId`s against `columns`, then: sync rules (static seeds) resolve into the initial
  `columns` array seeded into `withState` (last-rule-wins per field, unless the reducer decision
  changes this); reactive + async rules are handed to `wireColumnsSchemaAsync`.
- `wireColumnsSchemaAsync(rules)` is a `withHooks({ onInit })` feature: for each reactive rule it
  builds an `effect()`, and for each async rule a `computed()` params source + the rule's `factory()`
  `ResourceRef` + an `effect()` that calls the store's own `updateColumns()` on resolve/error. With
  no reactive/async rules (the legacy path), the loop body never runs — zero new signals/effects for
  existing consumers.

`wireColumnsSchemaAsync` returns `EmptyFeatureResult` (contributes no state/props/methods), so it's
invisible to `ComposedFeatureMembers<Features>` and the public `TableStore<TRow>` contract — same
invisibility as `_pipeline` / `_sortChangedSource` today.

---

## File layout (for the implementation session)

| File | Concern |
|---|---|
| `api/types.ts` (edit) | Add optional `columnsSchema?: ColumnsSchemaFn<TRow> \| ColumnSchema<TRow>` to `TableStoreConfig`. `ColumnDefInput<TRow>` and `resolveColumnDefs()` already shipped 2026-07-25. |
| `schema/column-schema.types.ts` (new) | `ColumnsPath`, `ColumnHandle`, `COLUMN_RECORDER` (internal), `ColumnSchemaRecorder` (internal), `ColumnsSchemaFn`, `ColumnSchema`. (`ColumnDefInput` stays in `api/types.ts`.) |
| `schema/column-rules.ts` (new) | `SyncColumnRule`, `AsyncColumnRule`, `ColumnRule`, `ColumnRuleContext`, `AsyncColumnRuleContext`, and all `apply*` functions (Tier 1 first). Landing spot for every future tier. |
| `schema/column-schema.ts` (new) | `columnSchema()` (standalone helper), `buildColumnsPath()` (the `Proxy`), `assertPathIsCurrent`, the shared recorder that both inline fns and `columnSchema()` run through, unknown-id + conflict validation. |
| `engine/columns-schema/` (new) | `resolveColumnsConfig()` (normalize inline fn / `columnSchema()` value → `ColumnSchema`, sync/static resolution) and `wireColumnsSchemaAsync()` (the `withHooks` feature). All DI/reactivity code lives here only. |
| `api/create-table.ts` (edit) | Call `resolveColumnsConfig(config.columns, config.columnsSchema)`; splice `wireColumnsSchemaAsync(rules)` into `coreFeature`. |
| `index.ts` (edit) | Barrel-export the public `apply*` + `columnSchema` + public types. **Not** `COLUMN_RECORDER` / `ColumnSchemaRecorder` — internal only. |
| `column-schema.spec.ts`, `wire-columns-schema.spec.ts` (new) | Resolution + validation + conflict handling; reactive + async wiring via `TestBed` + a controllable `resource()` loader (mirrors `table.store.spec.ts`'s `TestBed.inject(Store)` pattern). |

---

## `1-state/columns.md` changes — applied 2026-07-25

Applied ahead of implementation (docs can lead code for a spec-only feature): Executive Summary
pointer, `columnsSchema` registration variant, new "Declarative Column Schemas" section, and the
Pattern A / Pattern B split of the async section. Also resolved that file's stale width open
question there, consistent with [tier-2-layout.md](reference/tier-2-layout.md)'s
sizing-vs-pinning ownership split above.

---

## Open Questions

Feature-local open questions live in each tier / companion file. Cross-cutting ones:

- [x] **~~`applyVisible`'s function form is snapshot-once, not reactive.~~** RESOLVED 2026-07-24 —
  superseded by the [ownership model](reference/ownership-model.md); reactive `{ when }` is live.
- [x] **~~Metadata+reducer core vs bespoke `apply*`.~~** RESOLVED 2026-07-25 — hybrid: bespoke
  typed `apply*` public surface, one generic `applyMeta`+reducer core internally. See
  [techniques §1](reference/signal-forms-techniques.md#1--generic-metadata--reducer-instead-of-n-bespoke-apply--decided-2026-07-25--hybrid).
- [x] **~~Reducer-combine vs build-time rejection.~~** RESOLVED 2026-07-25 — reducer-combine, see
  [techniques §2](reference/signal-forms-techniques.md#2--reducers-replace-conflict-rejection--decided-2026-07-25--reducer-combine-reverses-the-earlier-settled-decision).
- [x] **~~Derived/computed columns~~** (not 1:1 with a `TRow` field — `fullName`, an actions column).
  RESOLVED 2026-07-31: already supported by the array config as-is — `ColumnDef.id: string` /
  `accessor: (row: TRow) => unknown` in [api/types.ts](../../src/api/types.ts:24-26) are not
  `keyof TRow`-constrained, so `{ id: 'actions', accessor: (row) => row }` works with zero code
  change. The actual gap was narrower: the schema `path` proxy is typed 100% off `keyof TRow`
  (ownership-model.md), so `applyVisible(path.actions, ...)` etc. couldn't target a derived column.
  Fix: `columnsSchema<TRow, ExtraCols>((path) => ...)` — consumer declares an `ExtraCols` interface
  (e.g. `{ actions: unknown }`), path proxy types over `TRow & ExtraCols`. Column *creation* stays
  array-only (schema is reactive/async-only, never a membership source per ownership-model.md); the
  generic only widens what the existing `apply*` functions can type-check against — no new
  `applyAction`/`applyCustom*` functions.
- [x] **~~Column order under the data overload.~~** MOOT — overload rejected 2026-07-31, see
  [data-derived.md](reference/data-derived.md).
- [x] **~~Tier 2 sizing state ownership.~~** RESOLVED 2026-07-25 — column-owned seed by default,
  `withColumnSizing()` if resizable, same precedent as pinning. See
  [tier-2-layout.md](reference/tier-2-layout.md#open-questions-tier-2).
- [x] **~~Tier 2 reactive `applyWidth`/`applyPinned` demand.~~** RESOLVED 2026-07-31 — static-only,
  consumer template/CSS owns width. See [tier-2-layout.md](reference/tier-2-layout.md#open-questions-tier-2).
- [x] **~~Tier 3 feature-absent handling.~~** RESOLVED 2026-07-31 — compile error (threads feature
  presence into `columnsSchema`/`columnSchema()` generic). See
  [tier-3-feature-config.md](reference/tier-3-feature-config.md#open-questions-tier-3).
- [x] **~~Tier 3 reusable archetypes (`apply(path, schema)` composability).~~** RESOLVED 2026-07-31 —
  deferred, no confirmed use case yet.
- [x] **~~`applyGroup` reactivity.~~** RESOLVED 2026-07-31 — accepts static seed **and** reactive
  `{ when }` form (unlike `applyPinned`/`applyDefaultSort`), store `effect()` calls `withGrouping()`'s
  own patcher method on change. See [tier-3-feature-config.md](reference/tier-3-feature-config.md).

---

## Next Steps

- [ ] Implement per the File Layout table, in order: pure types/rules → `schema/column-schema.ts` (testable
  without DI) → `engine/columns-schema/` (DI/reactivity, tested via `TestBed`) → `api/types.ts` /
  `api/create-table.ts` wiring (run the **existing** `table.store.spec.ts` first to confirm zero
  regressions on the legacy plain-array path) → barrel export → `1-state/columns.md` update.
- [x] ~~Resolve the two ⚠️ open decisions (§1 metadata core, §2 reducer vs reject).~~ Already
  resolved 2026-07-25 (see Open Questions above) — stale item, removed as blocker.
- [ ] Optional follow-up once shipped: replace the manual `effect()` + `resource()` pattern in
  `apps/demo/src/app/table-demo/table-demo.ts` with `applyVisibleAsync`, as a live Pattern B
  illustration.

---

**Generated by:** Claude (design session, grounded on fetched `angular/angular` + `ag-grid/ag-grid` source)
**Last Updated:** 2026-07-24

---

## Competitive position

**Verdict: ahead** — a declarative, async-resolved, multi-writer column-visibility rule system
(`applyVisible` / `applyVisibleAsync`, AND-combined) exists in none of TanStack, AG Grid, Material
React Table or PrimeNG.

Assessed 2026-09-05 against TanStack Table v8, AG Grid, Material React Table,
and PrimeNG. Full reasoning: [gap-analysis.md](../1-state/work/state-feature-competitive-audit/gap-analysis.md).
