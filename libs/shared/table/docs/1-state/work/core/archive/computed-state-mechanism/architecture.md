---
title: Architecture — positional feature composition and derived state
type: architecture
status: settled, ready for /to-tasks
date: 2026-09-12
audience: developers
---

# Architecture

Consumed by `/to-tasks`, not left to age. Paths are real and current as of `feat/table`.
Contract in [`spec.md`](spec.md); evidence in [`2-research.md`](2-research.md); decision log in
[`3-decisions.md`](3-decisions.md) (D19-D24 are binding, D1-D18 are the search).

## Settled — not open for relitigation

1. **Features carry no row type.** `TableFeature<TRow, Members>` is replaced by
   `Feature<In extends Shape, Out extends object>`, and the row type is recovered as `RowOf<In>`.
   (D20; reverses the rejection recorded in `docs/adr/0003-*` and
   `docs/1-state/architecture.md` §"Rejected: inferring TRow into with-*() calls".)
2. **Composition is positional**, `createTable(data, config, ...features)`, with per-arity
   overloads. Argument order governs member visibility only. (D21, D24.)
3. **`with*` is reserved for optional features.** Rows and columns are required and stay a plain
   config object. No `withRows()`, no `withColumns()`. (D24, superseding D23.)
4. **A derive block is a feature.** `withComputed()` returns `Feature<In, D>`; there is no
   `DeriveSpec` type. This is what makes it composable in both placements. (D22 — retires D6's
   object-literal rule, D7/D8's `DeriveSpec`, D10's one-block-per-table rule.)
5. **Arity ceiling 15, worked around by `composeFeatures(...)`**, which collapses N features into
   one slot. Not raisable at runtime, by config, or by DI. (D21.)
6. **The array form does not survive.** No compatibility layer. (D24.)
7. **Core member keys are pre-claimed**; `totalRowCount` stays unclaimed per ADR-0005. (D4.)
8. **Errors**: block throws at construction ⇒ throw wrapped; derived signal throws at evaluation ⇒
   report with member key, rethrow. Both the wrapper and the `isSignal()` check live **inside**
   `withComputed()`; the fold never special-cases a derive feature. (D9, D28, ADR-0014.)
9. **`indexById` is public, read-only; `baseColumns` stays engine-only.** Both editing features
   read `indexById`; the column-schema wiring that reads `baseColumns` is spliced internally and
   keeps the core handle. (D25.)
10. **Grouping's read of `expandedRows` survives as a lazy guarded read** of the store handed in —
    typed only when expansion precedes grouping, works at runtime in either order. Types are
    stricter than runtime. (D25.)
11. **The derive block's input is a read-only projection**: write views lose `.update` via a
    mapped type; mutating methods stay visible by necessity. (D28.)
12. **Arity 15, overloads generated** for both `createTable()` and `composeFeatures()` from one
    `tools/` script with a committed-output drift check. (D27.)
13. **No spike.** #77 integrate-and-verify is the runtime verification. (D26.)
14. **`createTableSchema()` is deleted.** `trackBy` explicit at every call site. (D25.)

## Current source — what each change lands against

| File | Today | Change |
|---|---|---|
| `src/engine/types.ts` | `TableFeature<TRow, Members> = (core: TableCore<TRow>, composed: Record<string, unknown>) => TableFeatureSpec<TRow, Members>` | replaced by `Feature<In, Out>`; `composed` parameter removed entirely |
| `src/api/types.ts` | `ComposedFeatureMembers<Features>` via `UnionToIntersection<FeatureMembers<…>>`; `TableStoreConfig<TRow, Features>`; `AnyTableFeature` with the doc comment asserting consumers must repeat `<TRow>` | intersection is now built by the overloads, so `ComposedFeatureMembers` goes; `TableStoreConfig` becomes the plain `TableConfig<TRow>` (adds `injector`); `AnyTableFeature`'s comment is false and must be rewritten |
| `src/api/create-table.ts` | `createTable(data, optsFn, options?)`; calls `resolveColumnsConfig`, then `composeTable` inside `runInInjectionContext`, splicing `wireColumnsSchemaAsync(rules)` as feature 0; ends in a cast justified by ADR-0003 | signature becomes `createTable(data, config, ...features)` with N overloads; thunk and third parameter go; the splice stays (internal, ADR-0010 intact); the cast stays — it is still the static/dynamic boundary |
| `src/api/table-schema.ts` | `createTableSchema()` builds the thunk, defaults `trackBy` to `'id'` | **deleted** (D25); call sites state `trackBy` explicitly |
| `src/api/types.ts` `TableStore` | no `indexById` | gains `readonly indexById: Signal<ReadonlyMap<RowId, number>>` (D25) |
| `src/api/features/with-grouping.ts` | reads `composed['expandedRows']` in the `group` render stage, guarded by `isExpandedRowsSignal` | same read against the store handed in — lazy and guarded, any argument order (D25) |
| `src/engine/compose-table.ts` | `foldFeatures()` calls `feature(core, composed)` in array order, merging members into a shared `composed`; store assembled as `Object.assign({columns, rows, trackBy, value, renderRows, totalRowCount}, composed)` — **`composed` spread last, which is the shadowing hole** | fold passes the accumulating store instead of `(core, composed)`; core keys claimed before the fold; derive features run in slot order like any other |
| `src/engine/slots.ts` | `SlotRegistry.claimMember`; `describeFeature(index)` → `features[${index}]`, **off by one** for consumers because the column-schema wiring is spliced as feature 0 | pre-claim core keys with a `core` claimant label; labels become argument positions (consumer's first feature is position 1) and name a derive block distinctly |
| `src/engine/core.ts` | `createTableCore()` → `TableCoreHandle`; `rows` is the pipeline output, `renderRows` on the handle | unchanged |
| `src/api/create-table-feature.ts` | identity helper typed `TableFeature<TRow, Members>` | re-typed to `Feature<In, Out>`; gains the one-time derive-block plumbing (call the block with `input & ownMembers`, merge its `Out`) so every feature — first- or third-party — accepts a trailing `withComputed()` with no per-feature code |
| `src/api/features/with-*.ts` (7 features) | `withX<TRow = unknown>(config): createTableFeature<TRow, XMembers>(...)` | each becomes `withX<In extends Shape, D extends DerivedDict = {}>(config?, derive?)`; row-typed config becomes `RowOf<In>`-typed; each gains the optional derive parameter |
| `src/index.ts` | exports features, `createTableFeature`, `ComposedFeatureMembers` | add `withComputed`, `composeFeatures`; drop the removed types |

## Types to add

```ts
// engine/types.ts
// `unknown`, not `any`: Signal<TRow[]> is assignable to Signal<readonly unknown[]> and RowOf
// still infers through it. Trap #1 in 2-research.md is exactly a wildcard in a constraint slot —
// re-verify against the probe before shipping.
export type Shape = { rows: Signal<readonly unknown[]> };
export type RowOf<S> = S extends { rows: Signal<readonly (infer R)[]> } ? R : never;

export interface Feature<In extends Shape, Out extends object> {
  (input: In): TableFeatureSpec<RowOf<In>, Out>;
}

// api/types.ts
export type DerivedDict = Record<string, Signal<unknown>>;

// The derive block's parameter (D28): every WritableView loses `.update`; everything else passes
// through. Mutating methods are statically indistinguishable from queries and stay visible.
export type ReadonlyStore<S> = {
  readonly [K in keyof S]: S[K] extends WritableView<infer T, any> ? Signal<T> : S[K];
};
export declare function withComputed<In extends Shape, D extends DerivedDict>(
  factory: (store: ReadonlyStore<In>) => D
): Feature<In, D>;
export interface TableConfig<TRow> {
  trackBy: TrackByConfig<TRow>;
  columns: ColumnDefInput<TRow>[];
  columnsSchema?: ColumnsSchemaFn<TRow> | ColumnSchema<TRow>;
  injector?: Injector;
}
```

Feature signature, both placements in one declaration (verified, `probe-r4-directdata.ts.txt`):

```ts
export declare function withSelection<In extends Shape, D extends DerivedDict = {}>(
  a?: WithSelectionConfig<RowOf<In>> | Feature<In & SelectionMembers, D>,
  b?: Feature<In & SelectionMembers, D>
): Feature<In, SelectionMembers & D>;
```

`createTable` overload N (15 of these, **generated** — D27; `composeFeatures()` gets the same set
from the same script):

```ts
export declare function createTable<TRow, O1 extends object, O2 extends object>(
  data: TableDataInput<TRow>,
  config: TableConfig<TRow>,
  f1: Feature<TableStore<TRow>, O1>,
  f2: Feature<TableStore<TRow> & O1, O2>
): TableStore<TRow> & O1 & O2;
```

**Three guards that must ship in the types** — each degrades to `any` silently otherwise
(`2-research.md` §"Three silent-failure traps"):

- never put a wildcard in a constraint's derived slot; read it as
  `F extends Feature<any, infer D> ? (IsAny<D> extends true ? {} : D) : never`;
- an omitted optional callback infers its type parameter as its **constraint**, not its default —
  normalize with the same guard, or the store gains an index signature;
- never declare `withComputed`'s return as an intersection of two shapes.

A member-less feature returns `Feature<In, {}>`, never `Feature<In, object>` (cosmetic `& object`
in the composed type otherwise).

## Runtime — the fold

`composeTable()` changes from "call each feature with `(core, composed)`" to "call each feature with
the store built so far":

1. build core (`createTableCore`), claim the core member keys (`rows`, `value`, `columns`,
   `trackBy`, `renderRows` — **not** `totalRowCount`);
2. build the base store object once, so `renderRows` and `totalRowCount` exist before any feature
   runs — today `totalRowCount` is built *after* `foldFeatures`, which must move;
3. for each feature argument in order: call it with the accumulating store, claim its members,
   assign them onto that same object. A derive feature is not special-cased — it returns members
   like anything else. The fold performs **no** signal check: an ordinary feature's members include
   methods;
4. `withComputed()` itself, before returning its spec: validate each value the block returned with
   `isSignal()` and throw at construction naming the key if it is not one; wrap each derived signal
   so a throw during evaluation reports the member key (ADR-0014 channel) then rethrows (D28);
5. run `setup` hooks, register `onDestroy`, wire the ADR-0006 removal effect — all unchanged.

Runtime truth the types do not express: the accumulating store is one shared object, so a read
deferred past construction (a method, a `computed()`, a stage function) sees every feature in any
order — grouping's `expandedRows` read relies on this and stays guarded (D25).

Step 2 is the ordering fix that D8 identified: a derive block's parameter type includes
`renderRows`/`totalRowCount`, so they must be concrete before any feature can honour that type.

## File layout for implementation

| File | Action |
|---|---|
| `src/engine/types.ts` | edit — `Feature`, `Shape`, `RowOf`; delete `TableFeature` |
| `src/engine/compose-table.ts` | edit — fold rewrite, base store built first, core-key claims |
| `src/engine/slots.ts` | edit — core-key pre-claim, claimant labels |
| `src/api/types.ts` | edit — `TableConfig`, `DerivedDict`; delete `ComposedFeatureMembers`, `TableStoreConfig`; rewrite `AnyTableFeature` doc |
| `src/api/create-table.ts` | edit — new signature + overloads |
| `src/api/create-table-feature.ts` | edit — re-typed |
| `src/api/table-schema.ts` | delete (D25) |
| `tools/generate-overloads.ts` (name indicative) | **new** — emits the 15 `createTable` + 15 `composeFeatures` overloads; a check target diffs committed output (D27) |
| `src/api/features/with-computed.ts` | **new** — `withComputed()` |
| `src/api/features/compose-features.ts` | **new** — `composeFeatures()` |
| `src/api/features/with-{sorting,filtering,grouping,selection,expansion,row-edit,optimistic}.ts` | edit — one per feature, each with its own spec updated in the same change |
| `src/api/create-table.spec.ts` | edit — runtime cases + `expectTypeOf` type cases (the two agreed seams) |
| `src/engine/compose-table.spec.ts`, `src/engine/slots.spec.ts` | edit — fold and claim coverage |
| `src/index.ts` | edit — export the two new features, drop removed types |
| `docs/adr/0003-*`, `docs/adr/0005-*`, `docs/adr/0007-*`, `docs/adr/0014-*`, `docs/1-state/architecture.md`, `docs/1-state/state-persistence.md`, `CLAUDE.md` (composition example, the false "no feature uses `composed`" line, migration before/after table) | edit — see the owed-docs list in `3-decisions.md` |

Ordering constraint for tasks: `slots.ts` core-key pre-claim is a **prerequisite** and lands first;
`engine/types.ts` + `compose-table.ts` next; then `create-table.ts`; then the seven features in
parallel; docs last.

## Open questions — closed 2026-09-12

Resolved at `/to-issues`; see [`review-spec-architecture.md`](review-spec-architecture.md) and
D25–D28. Kept for the record:

1. `createTableSchema()` — **deleted** (D25, #69).
2. Overload count — **15** (D27, #69).
3. Hand-write or generate — **generate**, one script for both `createTable` and `composeFeatures`
   (D27, #69).
4. Spike — **no**; #77 integrate-and-verify is the runtime verification (D26).
5. `totalRowCount` override path — one sentence owed on ADR-0005 (#78). Still a pre-existing gap;
   not blocking.
6. Editing features' shared store — finding recorded on #74, rationale rewritten in #78.
