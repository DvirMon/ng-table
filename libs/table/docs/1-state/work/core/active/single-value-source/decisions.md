---
title: Single value source — decisions
type: decisions
date: 2026-09-20
status: planned
ticket: https://github.com/DvirMon/ng-table/issues/100
---

# Single value source — decisions

Migration log for [ADR-0024](../../../../adr/0024-single-value-source-accessor.md) plus
[#100](https://github.com/DvirMon/ng-table/issues/100)'s remaining `sortFn` / `enableSorting`
slice. The decisions themselves are registered in
[`docs/decisions/grouping.md`](../../../../decisions/grouping.md) as **G53–G59**; this file
sequences the work and records the questions settled while sequencing it.

**This file restates no rationale.** ADR-0024 holds it.

---

## What is being changed

Four consumers read three value paths today:

| Consumer | Reads via | Site |
|---|---|---|
| cells | `column.accessor` | `engine/cells.ts:28` |
| sorting | `column.accessor` (unwrapped) | `with-sorting.ts:112,117,118` |
| grouping | raw `row[key]` | `engine/grouping/clusters.ts:124` |
| filtering | raw `rowRecord[path]` | `engine/filters/evaluator.ts:63` |

After: one path, `readAccessor(column, row)`. Data concerns key by declared column id. A value
the table reads but never renders is a carrier column, `{ id, accessor, visible: false }`.

---

## Questions settled while sequencing

- **#100 Q2 — does `applySortNulls` stay in `columnsSchema`? No — reversed the same day.**
  The first answer was yes, argued from ADR-0021's capability test: it reads no row data, so it
  is a column concern. That test says what *may* live on the column surface, not what *should*.
  Under Rule A the question is whose config it is, and it is sorting's — `with-sorting.ts:105-113`
  reads `column.sortFn` and `readSortNulls(column)` three lines apart in one function. It moves
  into `withSorting()`, which gains a schema fn (G69, reversing D11a). See #100.

- **#100 Q4 — what replaces D2's wording?** D2 said `ColumnDef` "carries only static predicates
  supplied at column-definition time (`sortFn`, `aggregateFn`, `filterFn`)". After this
  migration `ColumnDef` carries no feature config at all — `id`, `accessor`, `visible`, `order`,
  `label`, `meta`. That is #100's Rule A, reached in full. D2 is superseded, not amended;
  `filterFn` never existed in `src/` and the replacement wording should not resurrect it.

- **Does `withFiltering` need `columns`? Yes, and it does not have them.**
  `withFiltering<In extends Shape>` (`with-filtering/feature.ts:27`) constrains only
  `{ rows }`; grouping already uses `Pick<TableStore, 'columns' | 'rows'>`
  (`with-grouping/feature.ts:34`). Filtering's input constraint must widen to match before V3
  can read an accessor. Its `_input` parameter is currently unused, so nothing else depends on
  the narrow shape.

- **Does the grouping pipeline have `columns`? Only on the render path.**
  `buildGroupRenderRows(rows, grouping, columns, opts)` has them;
  `clusterRows(rows, grouping, opts)` (`engine/grouping/pipeline.ts:8`) and `buildClusterNodes`
  do not. Both walks must resolve the same value or the pipeline and the render tree diverge —
  which is the exact class of bug this migration exists to close, so threading columns into the
  pipeline walk is not optional.

- **The arity escape hatch — does it carry the union or drop it? It carries it, and
  `composeFeatures()` needed no change.** `ComposeFeaturesOverloads` is generic in
  `In extends Shape`, and `In` is bound at the call site to the concrete
  `TableStore<TRow, TId> & O1 & …` the enclosing `createTable()` slot supplies. `ColumnIdOf<In>`
  recovers structurally off that intersection, so the union survives the composite without the
  generator ever naming `TId` there. Evidence: case 4 of
  [`api/create-table.types.spec.ts`](../../../../../../src/api/create-table.types.spec.ts)
  (#113 Step 3) — a column-naming probe inside a `composeFeatures()` bundle, asserting both the
  literal union and the typo rejection. **Reopens if:** a composite must name a column without
  an enclosing `createTable()` call to bind `In` — no such caller exists today. That would need
  `TRow`/`TId` added to `COMPOSE_FEATURES`'s `baseGenerics` in `tools/generate-overloads.ts`, a
  materially bigger change. See [#113](https://github.com/DvirMon/ng-table/issues/113).

- **Does `ColumnIdOf` join the public barrel? No — matches `RowOf`'s existing precedent.**
  Neither is exported from `index.ts`. Both are engine-internal recovery types: a call site
  never names them, TypeScript recovers `In`'s row/id union structurally at the point of use
  (as `create-table.types.spec.ts` itself does). A third-party author writing an F-bounded
  feature in `with-sorting.ts`'s own style would need one exported — but none of `Shape`,
  `Feature`, or `RowOf` are exported today either, so that gap predates #113 and is not this
  issue's to close.

- **#114 — does an unknown grouping column id throw on the writer too, or only at
  construction? Both paths, one rule.** `table.grouping` is writable, and the barrel ships four
  updaters (`mutations/update-grouping.ts`). `addGroupLevel('territory')` is a runtime write the
  constructor never sees, so a construction-only check leaves an id with no column reachable in
  `appliedGrouping()` — exactly the case `groupingLevels()`'s total read (V4) requires cannot
  arise. Rejected alternatives: **engine-drops-silently** (reopens the exact silent-drop bug
  ADR-0024 exists to close, one level removed); **degrade-and-report** (treats a plainly wrong
  updater call the same as a runtime data condition it is not — the id is wrong at the moment the
  call is made, not depending on what data later arrives); **keep the filter** (the option V4
  itself deletes, and keeping it would leave two ways to read the same list disagree). Index
  bounds on `reorderGroupLevels` are unaffected — that check is about *shape* (`string[]` array
  bounds), not about *identity* (declared column ids), so it keeps degrading. Registered as
  [G71](../../../../decisions/grouping.md).

- **#114 — found while writing the public-surface spec: does `groupingLevels()`'s totality
  survive a `columns` write? No, and that's a second, separate ruling.** G71's writer check only
  guards `table.grouping`'s own updater; `setColumns()` removing a column that's still an active
  grouping level reaches `groupingLevels()` through no check at all. Classified as runtime,
  data-dependent (per `.claude/rules/classify-errors-construction-vs-runtime.md`) rather than a
  construction/wiring violation, so it degrades and reports rather than throwing — matching every
  other consumer-callback failure this feature already wraps (ADR-0014). Registered as
  [G72](../../../../decisions/grouping.md).

- **#111 — extract one runner or two? One. Reading B.**
  The recording form's runner has real duplication to collapse: `runColumnsSchemaFn`
  (`columns-schema/schema.ts:36-44`) and `runGroupingSchemaFn` (`with-grouping/schema.ts:38-46`)
  are the same five statements, and sorting (#100, G69) is a third caller. The declaring form's
  would have exactly one caller — `buildFilterModel` — since `buildFiltersPath` already shares
  `createPathProxy` and `keyRules` is six lines. Its second caller is `stageSchema` (ADR-0020,
  #102), which is unbuilt and is its own epic. Reading A was rejected on
  `general-mechanism-over-enumerated-cases`' own caveat — a general mechanism nobody extends is
  cost without payoff. Reading C was rejected because it leaves the recording body duplicated,
  which is the one piece of real duplication in the file set. `engine/filters/build.ts` is
  untouched by #111; #102 reopens it.

- **#115 — what types a rule's cell once `path` keys by column id? A column value map, and it
  is a new node ahead of K3/V3.** Found while planning #115: every filter rule reads its
  criterion type off `TRow[K]`, which does not exist once `K` is a declared column id. The
  obvious patch — `K extends keyof TRow ? TRow[K] : unknown` — is a **guess**, and it lies for
  exactly the case ADR-0024 exists to close: `{ id: 'owner', accessor: (r) => r.owner.name }`
  over a row whose `owner` is an object infers the object, not `string`. A map derived from the
  declared columns is not a guess — with no declared `accessor` the engine's documented default
  *is* `(row) => row[id]`, so the field-type arm is exact rather than a fallback. Rejected:
  **uniform `unknown`** (honest, but regresses `StateOf<S>` and every consumer of it across the
  public surface — the one thing #115 promises not to touch); **object-keyed columns** (map is
  free and can never degrade, but reopens column order and breaks `setColumns`,
  `reorderColumns` and every story). The gap is mechanism-wide, not filtering's —
  `applyGroupKey`, `applyAggregate`, `ClusterSummary.key`, `RenderRow.cells` and all of #117's
  resolvers are `unknown` for the same reason. Registered below as **K0**, filed as #125. Prior
  art: [`discovery-column-value-typing.md`](discovery-column-value-typing.md).

- **K0 — two things the capture mechanism had open, both settled.** **`const` type parameters
  do not help a hoisted array.** TS 5.0 states the limit verbatim: the modifier "only affects
  inference of object, array and primitive expressions that were written within the call", so
  `const cols = [...]` widens before `createTable` ever sees it — which is why the capture point
  moves inside a `createColumns([...])` call, where the literal *is* written within the call.
  **A `readonly` constraint does not conflict with `ColumnsUpdater`'s mutable write path**,
  because the map rides in a phantom slot, never in `columns`' own type — `setColumns` and
  `reorderColumns` are untouched. Also a correction to the framing: a **tuple is not required**.
  `TCols[number]` resolves over an array-of-union, and declaration order is irrelevant to a value
  map; the only requirement is that element types stay un-widened. The helper is named
  `createColumns()` — `create*` is the barrel's established prefix (`createTable`,
  `createTableFeature`, `createColumnMetaKey`, `createRow`) and `define*` appears nowhere in it;
  the name also leaves room to resolve `ColumnDefInput` → `ColumnDef` defaults, assign `order`,
  or reject duplicate ids at declaration time with no rename. Sources:
  [`discovery-column-value-typing.md`](discovery-column-value-typing.md).

- **K0 — `createColumns` is curried: `createColumns<TRow>()([...])`.** TypeScript has no partial
  type-argument inference, so a single `createColumns<TRow, const TCols>(columns)` call cannot
  take `TRow` explicitly and still infer `TCols` — supplying one type argument makes the second
  fall back to its default rather than inferring. The extra `()` also buys contextual typing of
  every accessor param for free: `accessor: (row) => row.owner.name` needs no annotation, because
  `TRow` is already bound by the time the array is checked. Rejected alternatives: **inferring
  `TRow` from an annotated accessor param** (an all-defaulted column list — no column declares an
  accessor — then infers `TRow = unknown`); **dropping `TRow` entirely** (an unannotated accessor
  param silently becomes `any`). Registered while implementing #125.

- **K0 — `TCols` on the config, `TValues` on the store.** `TableConfig` takes the column
  declaration because that is what a call site can infer; `TableStore` carries the derived value
  map because that is what downstream code reads. Deriving at the config boundary is what keeps
  #113's id-union inference working for a plain array — a `TValues`-on-the-config shape has
  nothing to infer from, since TypeScript cannot infer `T` from a `keyof T` position, so every
  un-helped array would fall back to the constraint and silently lose the literal union #113
  shipped. Registered while implementing #125.

- **K0 — the plan's `Files` lists undercounted the fallout; found by typechecking the whole repo,
  not just the touched files.** Re-keying `TableStore`'s second parameter from an id union to a
  value map broke every non-generated, two-argument `TableStore<TRow, TId>` reference in the
  repo, and the step plan named only one (`create-table.spec.ts`'s `withReversibleSort` probe).
  Also broke: `engine/slots.ts`'s `CORE_MEMBER_KEYS` exhaustiveness check (a new `TableStore` key,
  `__columnValues`, needed adding to the claimed-keys list); `with-sorting.ts` and
  `with-grouping/feature.ts`'s internal `TableStore<TRow, TId>` usages; four spec-only sites
  (`wire-columns-schema.spec.ts`'s `makeStore` helper, `with-tree.spec.ts` and
  `with-grouping/feature.spec.ts`'s `setup()` helpers, and one `with-row-edit.spec.ts` call whose
  `TRow` inference depended on whether `signal(...)` was hoisted to a `const` first). First
  attempt at `with-sorting.ts`/`with-grouping/feature.ts` wrapped the recovered id union as
  `Record<TId, unknown>`; that satisfied the new `ColumnValueMap` constraint in isolation but
  **circularly self-referenced** under each feature's F-bounded `In extends SortingInput<In>` /
  `In extends GroupingInput<In>` — the extra `keyof Record<...>` indirection couldn't resolve
  against `In`'s own `columns` field. Fixed with `ColumnValuesOf<In>` (the same recovery type
  `ColumnValuesOf<S>` introduced for this node) instead: no wrapping, no circularity, and a more
  direct reading of "recover the value map off the accumulating store" than the `Record`
  workaround was. None of this changed any feature's public config surface or runtime behavior —
  every fix is type-only plumbing or a test-file re-spelling. Full detail:
  [issue-125's `progress.md`](4-tasks/issue-125-column-value-map/progress.md).

---

## Dependency ranking

Edges are execution-grain: B has an edge from A when B cannot compile, run or be reviewed
without A's artifact. Presentation order below is not an edge.

### Nodes

| | Node | Class | Status |
|---|---|---|---|
| **M1** | Decouple `schema/path-proxy.ts` from `columns-schema/types` — `PathRecorder<TRule>`, drop the baked `MetadataRule`/`MetadataAsyncRule` arms, rename `assertPathIsCurrent` → `recorderOf` | behaviour-preserving | done (#111) |
| **M2** | Shared recording runner — `runRecordedSchema` in `schema/run.ts`; rewire columns and grouping. The declaring form keeps `buildFiltersPath` / `keyRules` in `engine/filters/build.ts` until `stageSchema` (ADR-0020) is a second caller — #111 reading B, see "Questions settled" | behaviour-preserving | done (#111) |
| **M3** | Shared `assertDeclarationsAreKnown` in `schema/validate.ts`; `assertRuleColumnIdsAreKnown` becomes a call into it | behaviour-preserving | done (#111) |
| **V1** | ADR-0014 wrap in `sortRows` — `column.accessor` through `readAccessor`, consumer `sortFn` guarded (pre-existing bug, independent of everything else) | bug fix | done (#112) |
| **V2** | Thread `columns` into `clusterRows` / `buildClusterNodes`; grouping reads `readAccessor` | behaviour change | ✅ done (#114) |
| **V3** | Widen `withFiltering`'s input to carry `columns`; filtering reads `readAccessor` | behaviour change | ✅ done (#115) |
| **V4** | Delete `resolveGroupLabel`'s raw-key fallback; `groupingLevels`' filter becomes total | behaviour change | ✅ done (#114) |
| **K0** | The column **value** map — `createColumns()` captures declared ids and accessor return types, `ColumnValues<TRow, TCols>` derives the map, a phantom carrier puts it on `TableStore`, regenerate `create-table.overloads.ts`. Mechanism only: no consumer reads it in this node. Numbered below K1 because it is the same keying channel carried one step further — it *depends on* K1's shipped plumbing | API change | ✅ done (#125) |
| **K1** | `TId` reaches feature configs — un-erase on `Shape`/`TableStore`/`TableCore`, regenerate `create-table.overloads.ts`, decide `compose-features.overloads.ts` | API change | done (#113) |
| **K2** | Grouping declarations key by column id | API change | ✅ done (#114) |
| **K3** | Filtering declarations key by column id | API change | ✅ done (#115) |
| **K4** | `applyAggregate` by column id (G58), validated at construction (G59) — replaces #100's row-field version | API change | ✅ done (#114) |
| **S1** | `withSorting()` gains a schema fn (recording form); `sortFn` / `enableSorting` move off `ColumnDef` into `applySortFn` / `applySortable`, and `applySortNulls` moves out of `columnsSchema` (#100 Rule A + G69) | API change | pending (#100) |
| **S2** | Supersede D2's wording (#100 Q4); close #100 | docs | pending (#100) |
| **D1** | Stories + fixtures | migration | grouping's slice done (#114); filtering's slice ✅ done (#115); sorting's slice pending #100 |
| **D2** | Docs — `1-state/features/{grouping,filtering,sorting}.md`, ADR-0019 amendment line, `llms.txt` regen | docs | grouping's slice done (#114); filtering's slice ✅ done (#115); sorting's slice pending #100 |

### Graph

```
V1  (independent — ADR-0014 bug fix, ships alone)
S1  (was independent — now downstream of M3, since sorting declares
     through the shared mechanism; see "Nodes added after this ranking")

M1 ─► M2 ─► M3
              │
K1 ────────────┼──► K2 ─► V2 ─► V4      ✅ shipped on the erased union —
   │           │                           the retrofit onto K0 is a follow-up node
   │           ├──► K4                   ✅
   │           │
   └─► K0 ─────┴──┬──► K3 ─► V3
                  │
                  └──► S1

{K2,K3,K4,V2,V3,V4,S1} ─► D1 ─► D2 ─► S2
```

**Parallel-safe:** `[V1, M1, K1]` at the start — V1 touches only `with-sorting.ts`, M1 and K1
touch disjoint files. S1 left this set on 2026-09-20. Then `[K2, K4]` once M3 and K1 both land;
K3 left that set on 2026-09-21 — it additionally waits on K0.

**Dependency chain (longest):** `M1 → M2 → M3 → K2 → V2 → V4 → D1 → D2 → S2`. K0 adds a second
chain of its own, `K1 → K0 → K3 → V3 → D1 → D2 → S2`, which is shorter but is the one now
gating everything unshipped.

**Frontier discipline:** K2/K3/K4 share only the validator from M3 and the id union from K1 —
they do not depend on each other. V2 and V3 likewise touch disjoint engines. K0 is the one
exception: K3 and S1 both read its map, so neither can be written against `unknown` first
without being written twice.

**K0 does not gate what already shipped.** K2/V2/V4/K4 landed on the erased union, and the
retrofit that moves grouping onto the map is its **own follow-up node**, not part of K0 — K0
adds the map and nothing reads it.

### The one hard sequencing constraint

**K4 must land with K2, not after.** #100's aggregate slice (G43/G45, now superseded by
G58/G59) is already specced against a row-field-keyed `GroupingPath`. If K2 lands first,
`applyAggregate` is the only declarator still on the old key space and grouping ships in two
vocabularies for one release. If #100's original aggregate migration lands first, it is
immediately reopened. They are one change.

---

## Nodes added after this ranking was written

The M/V/K/S list above predates the schema-plumbing session of 2026-09-20 (recorded as **D10/D11**
in [`grouping-config-simplification/2-decisions.md`](../../../grouping/active/grouping-config-simplification/2-decisions.md),
registered as **G60–G68**). Three corrections to the list, all published on the issues:

- **M2 is two authoring forms, not one runner** (G62). The recording form and the declaring form
  each stay permanent; they share the path proxy, the handle and the recorder session. Converging
  filtering onto the void form was rejected — its criterion type is inferred from the return
  type. Which forms get an *extracted* runner in this slice is #111's own reading question — one
  runner, reading B, see "Questions settled while sequencing".
- **K2 absorbs `GroupingLevel.key` → `columnId` and retires `ColumnId<TRow>`** (G60), and changes
  `applyGroupKey`'s extractor input to the accessor's output (G68). The rename is not separable:
  while the field stays typed `ColumnId<TRow>` the new name would promise declared-id space while
  the type keeps autocompleting row fields.
- **S1 is no longer independent.** `withSorting()` now declares through a schema fn (G69), so it
  is a consumer of M1/M2/M3 rather than a self-contained edit to `with-sorting.ts`. The edge is
  published on #100 as a `blocked_by` on #111. This also closes the open `sortFn`-resolver
  spelling: with a schema fn there is a `path` in scope, so `ctx.valueOf(path.total, row)` works
  and #117 invents nothing.

- **A new node, R1 — rule-context resolvers** (G63–G67), published as
  [#117](https://github.com/DvirMon/ng-table/issues/117). Downstream of V2 and V3; additive.
  Filtering's existing `valueOf` is renamed `criterionOf` **there**, not in K3/V3.

  Its shape is set by a **two-tier rule that is mechanism-wide, not grouping's** (G65): a
  resolver reading another *declaration* is bound to the schema and takes a path
  (`criterionOf(path)`, `stateOf(path)`); one reading *data* takes a path and a subject
  (`valueOf(path, row)`), because a column-keyed path names a cross-section of every row, not an
  instance. The three are separate **registers**, not synonyms (G63/G64): `valueOf`
  answers what the data says, `criterionOf` what the user asked for, `stateOf` how the column is
  configured. `equals` is the one rule where a criterion and a cell share a type — `inRange`'s is
  `{ min, max }` against a `number` cell — which is why the names cannot collapse. The evidence is an inventory of every consumer callback across all four schemas —
  none has exactly one row as its subject (G66), so a bound one-argument value resolver has
  nowhere to attach anywhere in the mechanism.

  The resolver therefore lives on a context argument, never on `ClusterSummary` (G67), which stays
  `{ columnId, key, rows }`. Two independent reasons: the tier rule already passes the subject in,
  and `valueOf` is the language's coercion hook on an object the library sorts.

  Signal Forms' one-argument `valueOf` is not a scale difference — `computeChildrenMap` creates a
  `FieldNode` per array item with a memoized context, so a thousand rows is a thousand nodes. Its
  paths name **instances**, so the subject is the path. Ours name **columns**.

[#116](https://github.com/DvirMon/ng-table/issues/116) — the cross-cutting ADR that D11 says is
owed — is docs and blocks nothing mechanically.

---

## Risks carried

- **K1 is the expensive node and the one that can fail.** The cross-argument `TId` spike passed
  (ADR-0019 Open 1, "Resolved: it works"), but literal inference degrades **silently**: a
  `columns` array built in a helper without `as const` widens `id` to `string` and the path
  becomes an index signature with no error (`api/create-table.spec.ts:20-24`). This migration
  spreads that hazard from one config property to every feature schema. Mitigation is a
  `*.types.spec.ts` guard asserting the union is literal, not `string`, before K2 depends on it.
- **`compose-features.overloads.ts` has no `TRow` and no `TId`** (`:11-21`) — **settled, see
  "Questions settled while sequencing"**: it carries the union structurally, with no generator
  change, and #113 Step 3's case 4 is the evidence.
- **Two walks, one value.** V2 must make `clusterRows` and `buildGroupRenderRows` resolve
  identically. A test asserting the pipeline tree and the render tree agree on a derived-accessor
  column is the acceptance gate for V2, not a nice-to-have.
- **`visible` is not enforced by the library.** Nothing reads it to filter rendering
  (`engine/columns.ts` only ever writes it); the story hosts filter themselves. A carrier column
  therefore renders in any consumer that does not filter. Out of scope here, but G54 rests on it
  — worth its own issue.
- **K0 makes the correct spelling the shortest one; it does not make the wrong one illegal.** A
  plain widened `columns` array still compiles and still degrades the map to an index signature.
  The types-spec guard is what catches that, not the compiler — a deliberate trade against the
  object-keyed declaration, which could never degrade but costs column order. See "Questions
  settled while sequencing".

---

## Acceptance

- `nx run shared-table:typecheck` clean — and **run twice**: `ngc` aborts at the first `.ts`
  error before reaching the template phase, so only a source-clean second run says anything
  about the story templates (`.claude/rules/typecheck-angular-templates.md`).
- `npm run llms:check` clean.
- A spec proving pipeline and render walks agree on a derived-accessor column (V2).
- A spec proving a declaration naming an undeclared column id throws at construction (M3).
- A `*.types.spec.ts` proving the column-id union is literal, not widened to `string` (K1) —
  **satisfied**: [`api/create-table.types.spec.ts`](../../../../../../src/api/create-table.types.spec.ts)
  (#113 Step 3).
- A `*.types.spec.ts` proving the **value map** resolves a declared `accessor`'s return type, a
  defaulted column's own field type, and rejects a typo'd column id (K0) — **satisfied**, across
  two files: [`api/create-columns.types.spec.ts`](../../../../../../src/api/create-columns.types.spec.ts)
  (the derivation, against `ColumnValues<>` directly, no `createTable()` call) and
  [`api/create-table.types.spec.ts`](../../../../../../src/api/create-table.types.spec.ts) (the
  carriage — the map surviving `TableConfig`, the generated overloads and the composed store;
  extends the same file K1's guard above lives in, rather than a second file) (#125).

---

## createColumns() grill — dependency ranking (2026-09-22)

Planning `createColumns()` per [`design-create-columns.md`](design-create-columns.md) — one call
declaring a column's presentation, accessor and rules, replacing the curried
`createColumns<TRow>()([...])` shipped in #125 and removing `TableConfig.columnsSchema`.

### Nodes

| | Node | Class | Status |
|---|---|---|---|
| **N4** | `col()`'s option set — what `Presentation` carries (`label`/`visible`, and whether `order`, `meta` or feature fields stay) | core | open |
| **N1** | `ColumnSet` runtime shape — `{ columns, rules }`, and whether it carries the `data` reference | core | open |
| **N2** | Where the throws live — duplicate ids and unknown rule ids move from `resolveColumnDefs`/`resolveColumnsConfig` into `createColumns`; plus the dev-gating axis | dependent (N1) | resolved — shipped #132 |
| **N3** | `createTable` intake — `resolveColumnsConfig` consumes a `ColumnSet`; whether a plain `ColumnDefInput[]` stays accepted for one release | dependent (N1) | open |
| **N5** | `ColumnSet` reuse — one declaration shared by two live tables, and the async-rule / injection-context consequence | dependent (N1, N2) | open |
| **N6** | Runtime write path — `setColumns` / `ColumnsUpdater` against a statically-derived value map | dependent (N4, N1) | open |
| **N7** | Migration order — 5 inline `columns: [`, ~20 spec factories, 5 story fixtures, every story host, both `*.types.spec.ts` | dependent (N3) | open |
| **N8** | ADR-0019 amendment + retiring the curried-`createColumns` rows (K0 here, G73 in the log) | dependent (N1, N2, N3) | open |
| **N9** | `FiltersPath` / `SortingPath` key by `ColumnIdIn<ColumnValuesOf<In>>` when #115 and #100 land | independent leaf | half done — `FiltersPath` ✅ (#115); `SortingPath` pending #100 |

### Graph

```
N4 ──┐
     ├─► N1 ─┬─► N2 ─► N5
N6 ──┘       ├─► N3 ─► N7
             └─► N8

N9  (independent leaf)
```

**Parallel-safe:** `[N4, N9]` at the start; N6 joins once N4 settles. **Dependency chain
(longest):** `N4 → N1 → N3 → N7`.

N4, N1, N5 and N6 are not in the brief's own "Open for the implementing session" list. N4 and N6
were found by reading `api/types.ts` — `ColumnDefInput` today carries `order`, `meta`, `sortFn`
and `enableSorting`, none of which appear on the brief's `ColumnDecl` — and N5 by reading
`columnSchema()`'s eager, injection-context-free run in `columns-schema/schema.ts`.

This workspace's capability log is
[`docs/decisions/grouping.md`](../../../../decisions/grouping.md) (G-space, last row G73). There
is no `docs/decisions/core.md`, and `state.json` carries no `capabilityLogPath` field yet.

### Settled

- **N4 — what `col(id, opts)` accepts: `label`, `visible`, `accessor`. `meta` and `order` drop.**
  The three were not one question. `visible` and its schema form are **complementary, not
  paired** — `applyVisible()` takes only a `{ when: (ctx) => boolean }` callback and its own doc
  comment already rules that "static visibility never goes through the schema"
  (`columns-schema/rules.ts:8-9`), so a constant has exactly one spelling and ADR-0024's carrier
  column `{ id, accessor, visible: false }` is that constant. `meta` is **redundant, and live**:
  `metadata()` already accepts a plain value (`metadata.ts:33-36`), so the declared `ReadonlyMap`
  buys nothing, and while it exists `foldColumnRules` (`engine/columns.ts`) rebuilds `meta` from
  the rule registry and spreads it over the column — replacing a declared map wholesale, never
  merging — with `assertMetadataKeysAreUnique` (`engine/columns-schema/resolve.ts:36-54`)
  scanning rules only, so a declared entry colliding with a `metadata()` rule on the same key is
  never compared. Dropping the declaration form closes that by construction. `order` drops so the
  builder array's position is the only source: `resolveColumnDefs`'s `order: def.order ?? index`
  becomes `order: index`. **`order`'s drop is provisional** pending
  [`discovery-column-order.md`](discovery-column-order.md) — whether reordering by rewriting the
  whole column array is acceptable, or whether a dedicated ordered-id channel with referentially
  stable definitions is the shape. If that discovery says a separate channel is needed, the
  channel is a `string[]` in its own store slice, not a returning `order` option.

- **N1 — `ColumnSet` is a plain `{ columns, rules }`. No `data`, no `kind` discriminant.** `data`
  stays a type witness on the `createColumns` parameter only: `createTable(data, …)` names a
  signal too, so a carried one could disagree with it while typechecking clean — both are
  `WritableSignal<TRow[]>`, and nothing would catch the mismatch. Not carrying it makes that a
  non-question rather than a runtime identity check. No `kind` field, because the precedent it
  would match is not load-bearing: `ColumnSchema`'s `kind: 'column-schema'` has exactly one
  non-test reader, `isColumnSchema` (`engine/columns-schema/resolve.ts:16`), and the union it
  narrows is `ColumnsSchemaFn | ColumnSchema` — a function against an object — which
  `typeof value === 'object'` already separates without it. `Array.isArray` covers N3's compat
  narrowing between a `ColumnSet` and a legacy `ColumnDefInput[]`. A set-level brand was
  considered and rejected as buying little: a hand-built `{ columns, rules }` still needs real
  branded `ColumnDecl`s inside, which only `col()` mints, so the literals are captured either way
  and the only thing bypassed is validation that `createTable` re-runs. Also verified while
  settling this: sharing one `ColumnSet` across two live tables is safe — `rules` compiles
  eagerly, but `wireColumnsSchemaAsync` calls each `MetadataAsyncRule.factory(params)` per table
  inside that table's own injection context, and `MetadataRule.logic` closures capture nothing
  table-specific.

- **N4 addendum — the `order` discovery came back, and it confirms the drop while adding a node.**
  [`discovery-column-order.md`](discovery-column-order.md): eight table libraries surveyed,
  **none** stores column order as a writable per-column property, and Kendo ships `orderIndex`
  explicitly read-only ("Setting this field does not change the column order"). The deciding cost
  is not copying 10-150 definition objects — it is the invalidation edge at
  `engine/core.ts:88-106`: a reorder writes `baseColumns`, `columns()` recomputes to a fresh
  array unconditionally, and `renderRows` re-runs `buildDataCells` for every row × every column
  through `readAccessor`'s `try/catch` — for a `cells` record `api/types.ts:79` documents as
  order-independent. O(rows × columns) per drag event, scaling with row count, not column count.
  So: `ColumnDef.order` drops, and **runtime order becomes its own slice — an ordered `string[]`
  of ids, definitions referentially stable.** That is a new node, not part of N4, and it is what
  `reorderColumns` rewrites instead of the definitions. Two caveats the discovery flags itself:
  the 150k-accessor figure is arithmetic over a verified code path, not a benchmark (a `vitest`
  bench at 1k/5k/20k rows would settle it), and a smaller fix exists — a custom `equal` on the
  `columns` computed — that cuts the cost with no API change but leaves the per-column field the
  survey argues against. Declared order stays the builder array's position; the one stated
  rationale found for keeping both channels is AG Grid's `maintainColumnOrder`, so a user's drag
  order survives a re-declaration.

- **Runtime-dynamic column ids are out of scope; the superset + `applyVisible` is the answer.** A
  config fetched from an API selecting which columns a table shows is already served
  declaratively: declare the superset once and drive visibility with
  `applyVisible(path.x, { when: … })` or `applyVisibleAsync` (built for a resource-backed
  setting; both exported). `createColumns` inside a `computed()` is **not** possible today, and
  the blocker is `createTable`, not `createColumns` — `config` is evaluated once ("structural …
  like `form()`'s single `rootCompile`"), `resolveColumnsConfig` runs once and `baseColumns` is
  seeded once, so a recomputed declaration is never re-read. Deeper: a declaration tracking an
  API response has no compile-time literal to capture, so the union degrades to `string` and the
  map to `Record<string, unknown>` — the pre-#125 default. Carries the standing caveat that
  `visible` is not enforced by the library (`engine/columns.ts` only writes it; the story hosts
  filter themselves), so a hidden column still runs its accessor and still contributes to
  `RenderRow.cells`. Two alternatives recorded, neither chosen — a **dynamic overload** on
  `createColumns` returning `ColumnSet<TRow, Record<string, unknown>>`, and a **reactive
  `columns`** config taking a `Signal<ColumnSet>` with `baseColumns` as a `linkedSignal` off it.
  Both, with their for/against and what would settle the choice, are on
  [#127](https://github.com/DvirMon/ng-table/issues/127).

- **Schema rule functions lose the `apply` prefix, library-wide.** `applyVisible` → `visible`,
  `applyVisibleAsync` → `visibleAsync`, `applySortNulls` → `sortNulls`, `applyGrouping` →
  `grouping`, `applyGroupingAsync` → `groupingAsync`, `applyGroupKey` → `groupKey`,
  `applyGroupOrder` → `groupOrder`, `applyAggregate` → `aggregate`, plus #100's unshipped
  `applySortFn` → `sortFn` and `applySortable` → `sortable`. Not a new convention — **the library
  already has it**: filtering's eight rules ship bare (`anyOf`, `contains`, `equals`, `filter`,
  `hasAny`, `hasNone`, `inDateRange`, `inRange`), and `.claude/rules/declarative-naming.md`
  codifies the split those names rest on — `is*`/`has*` for a predicate that *returns* a boolean,
  a bare name for a function that *registers a declaration*, which is why the matchers are
  `isEqual`/`hasAnyOf` and the rules are `equals`/`hasAny`. The eight `apply*` functions were the
  deviation. Rejected on the way: naming the **property** rather than the **constraint**
  (`visibility`, `aggregation`). Filtering's rules assert a constraint — `equals`, `inRange`, not
  `equality`, `range` — and Signal Forms is the same (`required`, `min`, not `requirement`,
  `minimum`); a property-noun spelling also turns a mechanical prefix strip into a case-by-case
  re-wording with no answer for `applyVisibleAsync` or `applySortNulls`. Scope is all eight
  shipped plus the two unshipped, in one pass, so #100 lands named correctly instead of being
  renamed straight after. Flagged, not blocking: `grouping()` the rule would sit beside
  `table.grouping` the store member `withGrouping()` declares — no compile collision, but the one
  name in the set worth a second look. The `order` example that prompted this probably never
  becomes a rule at all: [`discovery-column-order.md`](discovery-column-order.md) puts runtime
  order in its own ordered-id slice, not on the column. Cross-capability, so it is ADR-0025, with
  log rows owed in `grouping.md` and `sorting.md`.

- **N3 — `createTable` drops the array intake outright. No compatibility window.** `TableConfig`
  becomes `{ trackBy, columns: ColumnSet<TRow, TCols>, injector? }`; `columns: ColumnDefInput[]`
  and `columnsSchema` both go, and `resolveColumnsConfig` consumes a `ColumnSet`. The evidence:
  `createTable()` is called in **56 files, every one inside `libs/table/src`** — specs, story
  hosts and fixtures. `apps/site` names it only in prose, never calls it. So a window has no
  in-repo beneficiary, and it is not free — keeping a plain array **typed** means building B1's
  literal-preserving `id` default, the design
  [`proposal-column-value-mechanics.md`](proposal-column-value-mechanics.md) recorded as "the
  fallback if the migration is refused", solely so it can be deprecated. **Reopens if** a repo
  outside this one already builds against the published package; nothing visible from here does.
  Keeping both surfaces permanently was rejected separately: the array form silently degrades the
  value map to `Record<string, unknown>`, and it would leave `columnsSchema` on the config, which
  is the sibling-ordering limit the whole design exists to remove.

- **`accessor` stays on `col()`; it does not move into the column schema.** Asked because the
  accessor is a value source rather than presentation, not every column needs one, and it felt
  schema-level. Settled by
  [`discovery-accessor-placement.md`](discovery-accessor-placement.md). **The type flow is
  decisive**: the columns schema is G62's *recording* form, typed `(path) => void`, and a side
  effect has no type representation — `path` is built before the body runs, so nothing about a
  rule escapes to the type system. Register `accessor` there and `ColumnValues` falls back to its
  `TRow[C['id']]` arm, which is exactly the case ADR-0024 exists to close
  (`{ id: 'owner', accessor: (r) => r.owner.name }` would infer the object, not the string). It
  survives only by converting the columns schema to the *declaring* form — and that is
  self-defeating: once the third argument returns declarations carrying a value type it is
  structurally the same thing as the second argument, so `owner` would be declared twice and the
  map would merge two tuples keyed by the same ids; collapsing the redundancy returns
  `col('owner', { label, accessor })`. Supporting evidence: TanStack, AG Grid, MUI X and Kendo
  all put value access on the column definition beside the id, and TanStack makes it the column
  *kind* rather than an optional field; Angular Material is the only surveyed separator and its
  separated accessor is untyped and string-keyed, which is the cost rather than the benefit.
  Internally, `foldColumnRules` re-reads every rule signal per fold, so a static accessor
  registered as a rule would get a fresh function identity each fold and invalidate
  `RenderRow.cells` — the same line `applyVisible`'s own doc comment already draws between static
  and reactive. The DX premise is already served: `col('amount')` declares no accessor, and the
  engine's documented `(row) => row[id]` default is what makes the map's fallback arm exact
  rather than a guess. Two gaps the discovery flags itself: no compiled probe was run for the
  declaring-form sketch, and Pothos's `t.field` resolve placement is unverified.

- **N2 — where the throws live, and all three construction checks become dev-only.**
  `assertRuleColumnIdsAreKnown` and `assertMetadataKeysAreUnique` move wholesale from
  `engine/columns-schema/resolve.ts` into `createColumns`, the earliest point where both the
  rules and the declared id list exist. `assertUniqueColumnIds` does **not** move — it is called
  inside `resolveColumnDefs`, which `setColumns` also calls, so it fires at `createColumns` *and*
  stays on the write path. That makes it an addition, not the relocation the brief describes. Its
  message takes a `label` parameter like `assertDeclarationsAreKnown` already has, since a fixed
  `[createTable]` prefix is wrong from both call sites. **Gating:** all three are wrapped in
  `ngDevMode` and tree-shake out of a production build — the duplicate-id check already is, and
  the two schema checks join it. Rejected: ungating all three (one `Set` per construction, and a
  duplicate id collides two columns in `RenderRow.cells`, a record keyed by id — wrong output
  rather than a crash); and leaving the split as-is, which would carry an unexplained
  inconsistency into the new surface. **Consequence to note in the docs:** ADR-0014's
  throw-at-construction policy is about throw-vs-degrade, not dev-vs-prod, so a gated
  construction throw is not a violation of it — but the next reader will need that said out loud,
  or a gated throw reads as a bug. An unknown rule id or a duplicate `metadata()` registration
  now passes silently in a production build.
  **Shipped (2026-09-24, #132).** All three checks now gate inside their own body
  (`assertUniqueColumnIds` in `engine/columns.ts`, `assertRuleColumnIdsAreKnown` and
  `assertMetadataKeysAreUnique` in `api/create-columns.ts`), never at a call site — R7 applied to
  the two checks that don't share `schema/validate.ts`'s body. No `docs/decisions/core.md` or
  `columns.md` exists to carry this row permanently; see "Where the rows go" in
  [`3-architecture.md`](3-architecture.md#where-the-rows-go) — unresolved, a call for the user.

- **Correction to G65/G66's supporting comparison — the decision stands, the contrast does not.**
  [`discovery-dynamic-field-schema.md`](discovery-dynamic-field-schema.md) verified against
  published `@angular/forms` source that Signal Forms' *schema path* names a **type-level slot**
  (`keyof TModel`, with arrays collapsed to a single `DYNAMIC` builder) — the same cross-section
  shape as our `ColumnsPath`. Only its *field tree* names instances. So the sentence in this file
  reading "Signal Forms' paths name **instances**, so the subject is the path. Ours name
  **columns**" is wrong as written. G65's two-tier rule survives on its own evidence, which is
  G66's inventory — no consumer callback in any of the four schemas has exactly one row as its
  subject — not on the Signal Forms contrast. Registered as G75. Also verified in passing:
  `createTable`'s "structural … like `form()`'s single `rootCompile`" phrasing is accurate.

- **N6 — `setColumns()` takes a narrowed plain `ColumnDefInput`:
  `{ id } & Partial<{ accessor, visible, label }>`.** The same four fields `col()` takes, so
  declaration and runtime write teach one shape and `order`/`meta` are unreachable from every
  path rather than only from the declaration. No builder is needed at the call site for what is
  now a small edit. `id` stays bound to the declared union via
  `ColumnsUpdater<TRow, ColumnIdIn<TValues>>`, so a new or typo'd id is a compile error and a
  shorter list still typechecks — which G72 depends on. **`setColumns` cannot add a column, and
  that is structural, not an oversight.** Confirmed against the closest comparable in
  [`discovery-dynamic-field-schema.md`](discovery-dynamic-field-schema.md): Angular Signal Forms
  has no add-field API and no remove-field API either — a node materializes because a key was
  written into the model (`computeChildrenMap` over `Object.keys(value)`) and is deleted when its
  value becomes `undefined`. Both directions are consequences of the data changing shape, never
  API calls, because its structure follows the **data** while ours follows the **declaration**. A
  key nobody declared gets an **empty logic node**, no rules inferred; the only way a runtime key
  carries a schema is a shared `applyEach` one written in advance, since `getAllChildBuilders`
  merges the `DYNAMIC` builder into every key lookup. And rules cannot be added later at all —
  `apply`/`applyWhen`/`applyEach` each open with `assertPathIsCurrent`, throwing RuntimeError
  1908 after `form()` returns; there is no `extend`/`addRule`/`recompile`. The type side seals
  it: literal keys come from `keyof TModel`, so a growable model has none — literal keys and a
  growable key set are mutually exclusive by construction. Rejected: **`col()`-built
  declarations** (a builder must be in hand, so either `createColumns` is re-called or `col`
  becomes a standalone export — heavy for editing one label) and **narrower verbs**
  `setColumnLabel`/`removeColumns` (reverses G72's premise that `setColumns()` is how a column
  disappears, and trades one verb for three). One idea worth its own look, not pursued here:
  `applyEach`'s `DYNAMIC` slot is one schema standing for every key — "a rule applied to every
  column" is a shape this library does not have.

- **The row witness is `() => readonly TRow[] | undefined`, not `TableDataInput<TRow>`.** The
  brief types `createColumns`'s first argument as `TableDataInput<TRow>` —
  `WritableSignal<TRow[]>`, the same type `createTable` takes — but the two arguments do not have
  the same job. `createTable` needs a writable signal because it *is* the write path behind
  `table.value.update()`. `createColumns` never reads its argument at all; the brief says so
  ("`data` is a type witness"). Typing it `WritableSignal` therefore claims a capability the
  function does not use, and excludes rows that come from a resource: an `httpResource`'s
  `.value` is a read-only `Signal<TRow[] | undefined>`, so those consumers would be pushed onto
  the builder-first overload with an annotated `col` for no reason. One inline union member
  covers everything callable — `Signal`, `WritableSignal`, a resource's pre-load value, a bare
  store method — with no conditional type and no named constraint alias
  (`.claude/rules/simplest-signature-first.md`). A `WritableSignal<TRow[]>` still passes, so
  nothing is lost, `createTable` keeps its own stricter type, and binding `TRow` still rejects a
  column set built for another row type (P5e). Rejected: `Signal<TRow[]>`, which widens to
  read-only signals but still rejects the resource case that prompted this, and still excludes a
  plain method.

- **The `ColumnDecl` brand is a type-only `unique symbol`, declared and never assigned, as a
  *required* member.** Settled by
  [`discovery-nominal-branding.md`](discovery-nominal-branding.md), nine libraries surveyed.
  **First, a correction to this repo's own framing**: `FilterRule.__criterion?`, `__row?`,
  `TableStore.__columnValues?` and `ColumnMetaKey._type?` are all **optional**, so they are type
  *carriers*, not brands — an optional member rejects nothing. Every one of the eight surveyed
  libraries that brands at all makes the member **required**; not one uses an optional member for
  nominality. **The real-symbol-vs-type-only split tracks exactly one variable**: whether the
  library must answer "is this mine?" about an `unknown` at runtime. Angular (`isSignal`), Effect
  (`isEffect`), Drizzle (`is()`), Kysely (`isExpression`) and Zod v4 (`instanceof` across library
  copies) all stamp something real and test it, ungated, in production. io-ts, Valibot's
  `brand()`, Effect's `Brand.nominal` and Zod's `.brand()` are type-only phantoms no runtime code
  writes or reads — they exist solely to stop a hand-written value type-checking. Effect ships
  both in one package for the two jobs, which is the sharpest evidence the choice is about the
  job. `createColumns` receives its declarations from its own `col()` builder inside its own
  call; there is no `unknown` to sort and nothing asks for an `isColumnDecl`. **The `ngDevMode`
  gating decision settles it independently**: zero of the five runtime-checking libraries gate
  their check, so a gated brand check here would be weaker than every precedent the real-symbol
  preference was drawn from. **The Angular belief that prompted the preference is correct but
  misplaced** — `SIGNAL` *is* a real `Symbol('SIGNAL')` stamped ungated on every getter, but what
  rejects a hand-written object is the type, `Signal<T> = (() => T) & { [SIGNAL]: unknown }`, a
  required member; the runtime stamp buys only `isSignal`. Three libraries' published `.d.ts`
  imply a runtime operation that does not exist (Zod's `.brand()` is `return this`, io-ts never
  assigns `_A`, Valibot's brand `~run` is identity).

- **`col()` does not bake the default accessor; `resolveColumnDefs` keeps doing it.** The brief
  has the builder fill it ("accessor: always present"). It does not need to: `resolveColumnDefs`
  already resolves `def.accessor ?? ((row) => row[def.id])` against whatever `id` survived, and
  `V` rides in the builder overload's type parameter rather than being inferred from the runtime
  function, so there is no type cost. Leaving it there means a declaration whose `id` was
  re-written still gets an accessor matching its new id, instead of silently reading the original
  field.

- **An empty column list needs no guard.** `createColumns(data, () => [])` gives `TCols = []`, so
  the value map is `{}` and `ColumnIdIn<{}>` is `never`; the path proxy types as `{}`, making
  `path.anything` a compile error already, and `resolveColumnDefs([])` returns `[]`. Checked
  while walking failure modes; nothing to decide.

- **A variant of a declaration is re-minted through the builder, never spread — a stated rule
  plus `col.from(decl, opts)`.** The gap: `{ ...col('amount'), id: 'total' }` copies the brand
  member, so it passes every check, while the overridden `id` is a plain literal in an object
  literal whose contextual type is `string` and therefore widens. The value map then types
  **confidently wrong** rather than merely degrading — worse than the widening P3c found, because
  the surviving brand makes the result look validated. **No branding mechanism anywhere closes
  this** — not a symbol, not a class, not a `WeakSet` registered by `col()`;
  [`discovery-nominal-branding.md`](discovery-nominal-branding.md) checked all nine libraries.
  Zod is the only one with a shipped answer and it is **reconstruction, not branding**: its whole
  variant family — `extend`, `safeExtend`, `merge`, `omit`, `pick`, `partial`, `required` — ends
  in `clone(schema, def)` = `new inst._zod.constr(def)`, never a spread, and
  `.omit()`/`.merge()` **throw** on a schema carrying refinements rather than silently produce a
  wrong result (a construction-time throw, ADR-0014's class). Here the equivalent is nearly free,
  since a variant already is a `col()` call — `col()` is the only thing that captures the
  literal. Rejected: **the rule with no API** (the survey's closing point is that a rule with no
  sanctioned alternative is the shape that drifts) and **out of scope** (the existing "correct
  spelling is the shortest, not the only legal one" trade covers plain widening, not a result
  that looks validated). Rejected earlier by Q1's outcome: making the brand **non-enumerable** so
  a spread drops it, Zod's `_zod` trick — it requires a real runtime symbol, and it catches the
  spread at runtime after the map has already typed wrong. **Caveat carried:** the widening is
  reasoned from TypeScript's rules, not probed. `col('amount')` captures `'amount'` because
  `K extends string` is a primitive-constrained type parameter at that call; a spread's `id:`
  override has no such capture. The planned `*.types.spec.ts` must carry this case, which settles
  the claim as a side effect.

- **The order slice is its own issue,
  [#128](https://github.com/DvirMon/ng-table/issues/128); this ticket drops only `col()`'s
  `order` option.** `ColumnDef.order` keeps deriving from the array index (`resolveColumnDefs`'s
  `def.order ?? index` simply loses its left operand) until #128 lands. Separable because this
  ticket changes the **declaration input** while #128 changes the **resolved shape and the
  runtime state**. Kept apart because #128 is a public-API change of comparable size in its own
  right: `ColumnDef` loses `order`, `TableStore` gains the ordered-id member,
  `applyColumnOrder`/`reorderColumns` retarget, and roughly ten grouping story hosts rewrite
  their visible-column loop — `.sort((a, b) => a.order - b.order)` is the shipped consumer
  pattern for rendering columns in order, so removing the field changes how a consumer *reads*
  order, not only how it is written. (The `order` in `with-sorting.ts:108` is
  `SortNullsOpts.order`, unrelated.) Rejected: folding it in, which roughly doubles the migration
  and mixes a declaration-surface change with a runtime-state change in one review; and taking
  the discovery's cheap mitigation now — a custom `equal` on the `columns` computed, which cuts
  the O(rows × columns) recompute with no API change but leaves the per-column field the survey
  argues against, and is unbenchmarked. That mitigation is recorded on #128 as the fallback if a
  bench comes back flat.

---

## Conflict-audit rulings (2026-09-24)

Six edges from [`conflicts-vs-unshipped.md`](conflicts-vs-unshipped.md)'s
`## Needs a human ruling` list, grilled one at a time. Execution-grain ranking
of the rulings themselves:

- **Core:** R1 (E1 — the #100/#129 ship order). R4 (E7) and R6 (the adjacent
  #117 edge) both hang off it.
- **Independent:** R2 (E4 — `stateOf` vs. the order slice), R3 (E6 — `*Of`
  naming under ADR-0025), R5 (E10 — ADR-0020's stale header).
- **Dependent:** R4, R6 — after R1.

### Settled

- **R1 — #129 ships before #100/S1; one release without per-column `sortFn` or
  `enableSorting` is accepted.** For that release a consumer cannot give a
  column its own compare function and cannot switch sorting off for a single
  column. There is no compile error to catch it: `ColumnDef` keeps both fields
  as permanently-`undefined`, so every column silently falls to
  `detectComparator` (SO7) and `enableSorting !== false` is vacuously true.
  Measured blast radius is **0 production authors**. Rejected: landing
  #100/S1 first (the audit's own reading — compile-enforced, but it serializes
  the two largest unshipped nodes); and gating #129 on writing SO7's
  comparator spec first. Source:
  [`conflicts-vs-unshipped.md`](conflicts-vs-unshipped.md) E1.

- **R4 — N6 ships with #129; the column-order window is accepted and
  documented.** Until #128 lands, an app that calls `setColumns()` to
  re-declare columns loses the user's dragged column order — every call resets
  columns to declaration order, because N6 narrows the input to
  `{ id } & Partial<{ accessor, visible, label }>` and `order` becomes
  unreachable. Recoverable, unlike R1: the app owns the id list and re-applies
  `reorderColumns(ids)` immediately after the write. Two obligations follow —
  #129 documents the re-apply as the interim spelling, and #128 records the
  window it closes, since its body names AG Grid's `maintainColumnOrder` (a
  drag order must survive a re-declaration) without acknowledging that N6
  breaks it first. Rejected: landing #128 ahead of #129/N6 (adds a ticket in
  front of the thing R1 just chose to unblock); and leaving `order` writable
  on `setColumns` for one release (re-opens N6's settled shape). Source:
  [`conflicts-vs-unshipped.md`](conflicts-vs-unshipped.md) E7.

- **R6 — #100 joins #117's `blocked-by`.** #117's acceptance already defers
  one reader's spelling to #100 ("settle with #100 rather than inventing a
  third spelling here") while its edge list names only #114 and #115, so the
  dependency exists in prose and nowhere a tool can see. R1 sharpens it: #100
  now lands after #129, so #117 starts later than its current edge list
  implies, and the edge list should say so. Rejected: narrowing #117 to drop
  the sort-function reader so it no longer needs #100; and leaving the edge
  list as-is with a note in the body, on the grounds that only one reader's
  spelling waits. **Owed, not done:** the edit to #117's `blocked-by` field is
  made at the end of the grill, with the user's confirmation. Source:
  [`conflicts-vs-unshipped.md`](conflicts-vs-unshipped.md), "Adjacent edge
  found in the issue text".

- **R5 — ADR-0020's opening citation is amended now, on its own.** One line,
  no code, nothing superseded — the ADR is still `proposed`. Why it could not
  wait: a third-party feature author following that header builds a
  `keyof TRow`-keyed schema, which is the blind spot ADR-0019 closed and the
  one ADR-0024's carrier columns need closed. Rejected: folding it into #116,
  whose acceptance already covers the ADR-0021 reconciliation — the same
  sweep, but the wrong text stays live until #116 is worked, and #116 has not
  started; and also adding it to #102's open-items list, which tracks three
  items and not this one. Source:
  [`conflicts-vs-unshipped.md`](conflicts-vs-unshipped.md) E10.

- **R2 — `stateOf` ships without order; the order reader is #128's to
  decide.** #117 does not pre-answer whether the ordered id slice gets a
  reader or what it is called — #128 owns the slice, so it owns that question.
  Two consequences: #117's published example,
  `ctx.stateOf(path.total) // → { visible, order, … }`, is wrong as written
  and is **owed a correction in both #117 and #116**, which carry it verbatim;
  and `stateOf`'s remaining surface — `visible`, `label`, `meta` — is not
  thin. It replaces the untyped `columns()` lookup on `ColumnRuleContext`
  (`columns-schema/types.ts:9-11`), and `visible` is rule-folded and
  AND-combined per column while `meta` is rebuilt from the rule registry on
  every fold. Rejected: ruling now that order leaves the register permanently
  (correct-looking on the configuration-vs-runtime-state split, but it decides
  #128's business ahead of #128); and exposing the order slice through
  `stateOf`, which re-joins what #128 separates. Source:
  [`conflicts-vs-unshipped.md`](conflicts-vs-unshipped.md) E4.

- **R3 — the reader-naming rule goes into ADR-0025; #116 makes the edit.**
  ADR-0025 already holds the naming rule for functions that **register** a
  declaration (bare-named). It gains one sentence for functions that **read**
  one: they end in `Of` — `valueOf`, `criterionOf`, `stateOf`. All naming
  rules then live in one file, and the convention stops being something
  followed in code and written nowhere. #116 owns resolver naming, so the ADR
  edit rides with it. Rejected: recording the rule in #116's text alone and
  declaring ADR-0025 out of scope for readers (two places to look, and the
  rule would live in an issue rather than an ADR); and a separate ADR for
  reader naming (a whole record for one sentence over three functions). No
  code changes either way — this settles wording only. **Owed to #116, not
  done here**, unlike R5's ADR-0020 fix, which was ruled as standalone.
  Source: [`conflicts-vs-unshipped.md`](conflicts-vs-unshipped.md) E6.

- **R7 — construction checks are dev-only, library-wide; ADR-0014 gains the
  position it never took.** *Not from the six-item list — it came out of
  grilling E2.* Construction errors are developer errors: they fire on first
  render, every run, before any data, so they have already done their job by
  the time an app ships. They are gated to dev builds and stripped from
  production, matching Angular's own `ngDevMode` practice. Consequences, all
  of them: the wrap goes in the **shared body** `schema/validate.ts`, one
  place, not per call site — which makes E2's conditional verdict moot and
  settles it as option B; #129's N2 is now consistent with policy rather than
  a deviation; and **G71 must be revisited**, since grouping's production
  throw becomes dev-only, which is a change to shipped behavior. Rejected:
  keeping construction throws ungated in production (ADR-0014 as first read);
  carving out checks whose ids can arrive at runtime; and settling it in a
  separate ADR. **Accepted risk, stated at the time and taken anyway:** once
  columns stop being static (#127 — a server-sent or user-saved layout), an
  unknown column id is no longer guaranteed to appear in dev, so a dev-only
  check can miss a real production failure. No carve-out was taken; #127's
  grill should read this row. Recorded as ADR-0014's **Amendment
  (2026-09-24)**. Source:
  [`conflicts-vs-unshipped.md`](conflicts-vs-unshipped.md) E2, plus ADR-0014
  read in full.
  **Shipped (2026-09-24, #132).** The wrap landed in `schema/validate.ts`'s shared body as
  planned; the two checks that don't share that body (`assertUniqueColumnIds`,
  `assertMetadataKeysAreUnique`) each gate inside their own body instead — same rule (one gate,
  in the body, never at a call site), applied per-check where there's no shared body to put it
  in once.

- **R8 — R7's dev-only rule reaches G71's construction half only; the writer
  path keeps throwing in production.** *The G71 revisit R7 obliged.* R7 rests
  on "a construction check has already done its job by the time you ship" —
  true of the construction half, false of `table.grouping`'s writer, where the
  id can arrive from a user action or a saved layout and may never appear in
  dev. Applying R7 to both would stretch it past its own argument and give up
  the one check that catches ids users produce. Rejected: gating both halves
  (one rule, but `addGroupLevel()` with a bad id stops being caught in
  production); and switching the writer to degrade-and-report in production,
  ADR-0014's runtime treatment matching G72's shape — more principled, but a
  behavior change to shipped grouping bigger than this revisit needs, and
  recorded as **the option to revisit if the writer's throw ever proves to
  blank a table**. Consequence: G71's row now describes two different
  behaviors per path, and says so. Registered as
  [G76](../../../../decisions/grouping.md). Source:
  [`conflicts-vs-unshipped.md`](conflicts-vs-unshipped.md) E2, via R7.

---

## `/to-tasks #130` rulings (2026-09-24)

Raised while planning [#130](https://github.com/DvirMon/ng-table/issues/130);
numbering continues the 2026-09-24 R-series.

### Settled

- **R9 — `createColumns` is data-first only; the builder-first form is
  dropped.** `createColumns(data, build, schema?)` is the one call form. At
  runtime both forms can arrive as `(fn, fn)` — `(data, build)` versus
  `(build, schemaFn)` — and `data` is never invoked, so the implementation
  cannot tell them apart without either a heuristic (counting
  `args[0].length`) or a runtime brand, which contradicts the type-only
  `ColumnDecl` brand (D7). Builder-first's inline-inside-`createTable` case
  (P5d) is covered by writing data-first inline. Its one real case — a
  module-level shared declaration with no data in scope, the five
  `src/stories/*/fixtures/schema.ts` files — must now pass a row-typed data
  witness; how the fixtures do that is
  [#138](https://github.com/DvirMon/ng-table/issues/138)'s to settle.
  Amends spec D1 and the design brief's builder-first rows (P5b, P5c, P5d).
  The old curried `createColumns<TRow>()` zero-argument form coexists until
  #138 rewrites its callers. Rejected: **one name with arity dispatch**
  (a heuristic that misreads an empty `() => []` builder beside a schema fn);
  **a separate name** (`defineColumns(build, schema?)`) — no ambiguity, but a
  second entry point kept only for the fixtures.

- **R10 — `col.from` captures an explicit `id` override, but not an omitted
  one (open question 1, settled by probe).** `col.from(decl, { id: 'total' })`
  types the result's `id` as the literal `'total'` — `K` is inferred from the
  object-literal `id` property supplied at the call, matching decision 15's
  assumption. `col.from(decl, { label: '…' })` with `id` omitted has no
  inference source for `K` — `decl`'s own id arrives as `ColumnDecl<TRow,
  string, unknown>` in `from`'s parameter type, so its literal is not visible
  to recover — and `K` falls back to its `string` constraint. So the runtime
  value still carries `decl`'s original id, but the *type* of an
  id-omitting `from` call widens to `string` rather than staying literal.
  Decision 15's severity claim needs no correction: the sanctioned variant
  path (`col.from` with an explicit `id`) captures exactly as assumed.
  Case: `create-columns.types.spec.ts` case 13 (#130).

- **R11 — spreading a `ColumnDecl` and overriding `id` widens to `string`,
  confirming decision 15's severity claim (open question 2, settled by
  probe).** `{ ...col('amount'), id: 'total' }` placed in the columns array
  types `id` as `string`: the array element's contextual type comes from
  `TCols`'s constraint (`ColumnDecl<TRow, string, unknown>`), which supplies
  no literal for the trailing `id: 'total'` property to narrow against. This
  is TypeScript's ordinary widening, not a bug — decision 15 stands as
  written, no correction owed. Case: `create-columns.types.spec.ts` case 14
  (#130).

- **R12 — `ColumnSet` needs no row-carrier phantom (open question 3, settled
  by probe).** `TRow` recovers cleanly off `typeof dealColumns` via
  `... extends ColumnSet<infer R, any> ? R : never`, resolving to `DealRow`.
  `ColumnSet<TRow, TCols>` already carries `TRow` as a real, non-erased
  generic parameter on the interface, so there is nothing to recover a
  phantom for. Step 1 shipped `ColumnSet` with no phantom on this
  assumption; this confirms it. Case: `create-columns.types.spec.ts` case 11
  (#130).

- **R13 — the `ColumnDecl` brand never leaks into `ColumnValues` (open
  question 6, settled by probe).** `keyof ColumnValues<DealRow, typeof
  dealColumns.columns>` is exactly the declared id union — no `[COLUMN_DECL]`
  symbol key appears. `ColumnValues` remaps keys via `as C['id']`, which only
  ever produces the declared string id, so the brand is structurally
  excluded rather than merely absent by convention. Case:
  `create-columns.types.spec.ts` case 12 (#130).

---

## `/implement #131` ruling (2026-09-24)

### Settled

- **R14 — `columnsSchema` is removed from `createTable` in #131, not #139.
  A column set is the only schema intake; the array intake stays, rule-free,
  until #139.** User ruling. There is no in-repo caller worth a compatibility
  window (only 3 specs read `columnsSchema`, all moved in #131's Step 3), and
  splitting the deletion this way leaves exactly one source of schema rules
  during the migration window instead of two. Amends D11's *sequencing*
  only — D11's end state (`{ trackBy, columns: ColumnSet, injector? }`, no
  array intake, no separate schema property) is unchanged — and narrows the
  #131/#139 boundary: #131 now also deletes `columnsSchema`; #139 is left
  with only the array-intake deletion. `TableConfig.columns` shipped as
  `TCols | ColumnSet<TRow, TCols & readonly ColumnDecl<TRow, string,
  unknown>[]>` (Step 1's shape 1 — it passed both probes on the first try, so
  shape 2's wider `TCols` constraint on `TableConfig` was never needed); the
  generated `create-table.overloads.ts` needed no change as a consequence
  (Step 2: "no diff — shape 1"). Probe result (Step 5, case 15): a
  `ColumnSet<OtherRow, ...>` passed as `columns` to a `createTable(data,
  {...})` typed over `Row` does fail to compile, but TypeScript anchors the
  error on the `data` argument (TS2345, missing property) rather than on
  `columns` — inference resolves `TRow` off `columns` first, then checks
  `data` against `TableDataInput<TRow>` and fails there. Recorded as observed
  behavior; Step 1's types were not adjusted to relocate the error.

---

## `/implement #139` ruling (2026-09-25)

### Settled

- **R17 — the compile step folds into the intake; `engine/columns-schema/resolve.ts`
  is deleted outright, not slimmed to a pass-through.** `createTable` now
  unpacks `config.columns` directly (`const { columns, rules } =
  config.columns;`); `TableConfig.columns` takes a `ColumnSet<TRow, TCols>`
  only, no array union arm. This settles the shaping question N3/#139 left
  open ("what the compile step becomes"). Reasoning: after #132 moved
  `assertRuleColumnIdsAreKnown` and `assertMetadataKeysAreUnique` into
  `createColumns`, `resolveColumnsConfig` had nothing left to do —
  it only ever turned a schema fn into rules, and a `ColumnSet` already
  carries resolved rules. Rejected: a slim `resolveColumnsConfig(set)`
  kept as a pass-through — it would have had no state or reasoning of its
  own, exactly the shape `general-mechanism-over-enumerated-cases`' own
  caveat warns against keeping. `isColumnSchema` and `resolveColumnsIntake`
  are deleted alongside it. `ColumnDefInput` is unaffected — it survives as
  the engine's resolved-input shape (`TableEngineConfig.columns`,
  `setColumns`, `ColumnValues`'s constraint), never part of this deletion.
  Shaping ruling made 2026-09-24, recorded here on landing.
