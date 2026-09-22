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
| **V3** | Widen `withFiltering`'s input to carry `columns`; filtering reads `readAccessor` | behaviour change | pending (#115) |
| **V4** | Delete `resolveGroupLabel`'s raw-key fallback; `groupingLevels`' filter becomes total | behaviour change | ✅ done (#114) |
| **K0** | The column **value** map — `createColumns()` captures declared ids and accessor return types, `ColumnValues<TRow, TCols>` derives the map, a phantom carrier puts it on `TableStore`, regenerate `create-table.overloads.ts`. Mechanism only: no consumer reads it in this node. Numbered below K1 because it is the same keying channel carried one step further — it *depends on* K1's shipped plumbing | API change | ✅ done (#125) |
| **K1** | `TId` reaches feature configs — un-erase on `Shape`/`TableStore`/`TableCore`, regenerate `create-table.overloads.ts`, decide `compose-features.overloads.ts` | API change | done (#113) |
| **K2** | Grouping declarations key by column id | API change | ✅ done (#114) |
| **K3** | Filtering declarations key by column id | API change | pending (#115) |
| **K4** | `applyAggregate` by column id (G58), validated at construction (G59) — replaces #100's row-field version | API change | ✅ done (#114) |
| **S1** | `withSorting()` gains a schema fn (recording form); `sortFn` / `enableSorting` move off `ColumnDef` into `applySortFn` / `applySortable`, and `applySortNulls` moves out of `columnsSchema` (#100 Rule A + G69) | API change | pending (#100) |
| **S2** | Supersede D2's wording (#100 Q4); close #100 | docs | pending (#100) |
| **D1** | Stories + fixtures | migration | grouping's slice done (#114); filtering/sorting slices pending #115/#100 |
| **D2** | Docs — `1-state/features/{grouping,filtering,sorting}.md`, ADR-0019 amendment line, `llms.txt` regen | docs | grouping's slice done (#114); filtering/sorting slices pending #115/#100 |

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
