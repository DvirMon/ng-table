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

---

## Dependency ranking

Edges are execution-grain: B has an edge from A when B cannot compile, run or be reviewed
without A's artifact. Presentation order below is not an edge.

### Nodes

| | Node | Class |
|---|---|---|
| **M1** | Decouple `schema/path-proxy.ts` from `columns-schema/types` — `PathRecorder<TRule>`, drop the baked `MetadataRule`/`MetadataAsyncRule` arms, rename `assertPathIsCurrent` → `recorderOf` | behaviour-preserving |
| **M2** | Shared recording runner — `runRecordedSchema` in `schema/run.ts`; rewire columns and grouping. The declaring form keeps `buildFiltersPath` / `keyRules` in `engine/filters/build.ts` until `stageSchema` (ADR-0020) is a second caller — #111 reading B, see "Questions settled" | behaviour-preserving |
| **M3** | Shared `assertDeclarationsAreKnown` in `schema/validate.ts`; `assertRuleColumnIdsAreKnown` becomes a call into it | behaviour-preserving |
| **V1** | ADR-0014 wrap in `sortRows` — `column.accessor` through `readAccessor`, consumer `sortFn` guarded (pre-existing bug, independent of everything else) | bug fix |
| **V2** | Thread `columns` into `clusterRows` / `buildClusterNodes`; grouping reads `readAccessor` | behaviour change |
| **V3** | Widen `withFiltering`'s input to carry `columns`; filtering reads `readAccessor` | behaviour change |
| **V4** | Delete `resolveGroupLabel`'s raw-key fallback; `groupingLevels`' filter becomes total | behaviour change |
| **K1** | `TId` reaches feature configs — un-erase on `Shape`/`TableStore`/`TableCore`, regenerate `create-table.overloads.ts`, decide `compose-features.overloads.ts` | API change |
| **K2** | Grouping declarations key by column id | API change |
| **K3** | Filtering declarations key by column id | API change |
| **K4** | `applyAggregate` by column id (G58), validated at construction (G59) — replaces #100's row-field version | API change |
| **S1** | `withSorting()` gains a schema fn (recording form); `sortFn` / `enableSorting` move off `ColumnDef` into `applySortFn` / `applySortable`, and `applySortNulls` moves out of `columnsSchema` (#100 Rule A + G69) | API change |
| **S2** | Supersede D2's wording (#100 Q4); close #100 | docs |
| **D1** | Stories + fixtures | migration |
| **D2** | Docs — `1-state/features/{grouping,filtering,sorting}.md`, ADR-0019 amendment line, `llms.txt` regen | docs |

### Graph

```
V1  (independent — ADR-0014 bug fix, ships alone)
S1  (was independent — now downstream of M3, since sorting declares
     through the shared mechanism; see "Nodes added after this ranking")

M1 ─► M2 ─► M3
              │
K1 ────────────┼──► K2 ─► V2 ─► V4
               │     │
               ├──► K3 ─► V3
               │
               └──► K4

{K2,K3,K4,V2,V3,V4,S1} ─► D1 ─► D2 ─► S2
```

**Parallel-safe:** `[V1, M1, K1]` at the start — V1 touches only `with-sorting.ts`, M1 and K1
touch disjoint files. S1 left this set on 2026-09-20. Then `[K2, K3, K4]` once M3 and K1 both land.

**Dependency chain (longest):** `M1 → M2 → M3 → K2 → V2 → V4 → D1 → D2 → S2`.

**Frontier discipline:** K2/K3/K4 share only the validator from M3 and the id union from K1 —
they do not depend on each other. V2 and V3 likewise touch disjoint engines.

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
