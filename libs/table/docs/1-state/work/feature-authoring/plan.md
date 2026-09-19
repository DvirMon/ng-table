# Third-party feature authoring — extensibility audit

## Context

Goal: a consumer must be able to author their own `with-*()` feature (e.g. `withPagination`)
against the published `@ngp/table` surface, without patching the library. Two questions:

1. Does `index.ts` export everything a feature author needs?
2. Which engine-fixed points (the `RENDER_ORDER` array and its kin) block or constrain a
   third-party feature, and how hard is it to add a feature today?

Audit scope: `ng-table/libs/table/src/` (nx project `shared-table`, alias `@ngp/table`; acme copy is legacy and identical as of 2026-09-18). Read-only findings below; the work items follow the
direction question.

## Finding 1 — export gaps for a feature author

`createTableFeature`, `withComputed`, `composeFeatures`, `RenderRow`, `RowId`, `TableStore`,
`DerivedDict`, `ReadonlyStore`, `ColumnDef`, `metadata`/`readColumnMeta`/`createColumnMetaKey`
are exported. Inference through `createTableFeature(factory)` works without naming the spec type.

Not exported, but needed once an author writes anything beyond one inline arrow:

| Symbol | File | Why an author needs it |
|---|---|---|
| `TableFeatureSpec<TRow, Members>` | `engine/types.ts` | Return type of a `buildXSpec()` helper — every in-repo feature has one |
| `Feature<In, Out>`, `Shape`, `RowOf<In>` | `engine/types.ts` | Overload signatures (`withSorting` shape: config / derive / config+derive), F-bounded `In extends XInput<In>` |
| `WritableView<T, U>`, `createWritableView` | `engine/writable-view.ts` | A feature exposing a writable slice (`withGrouping` does) |
| `pruneByIds` | `engine/rows.ts` | ADR-0006 says "if you store RowIds, declare `onRowsRemoved` and prune with `pruneByIds`" — mandatory rule, internal helper |
| `resolveIndex` | `engine/rows.ts` | Used by `editing-state.ts`; any id-keyed feature writing through `value.update` |
| `RenderRowTransform`, `RenderStage`, `PipelineStage`, `RowTransform` | `engine/{render-stages,pipeline}.ts` | Typing a stage-builder helper (`buildTreeStage` returns a hand-written signature today) |
| `ColumnRuleEntry` / `ColumnRuleRegistry` | `engine/columns.ts` | `TableFeatureSpec.columnRules` is typed with it; author cannot build one without the type |
| `displayName` convention | `engine/types.ts` `Feature.displayName` | Set via `Object.assign(feature, { displayName })` in every feature; undocumented |
| `table.mock.ts` fixtures | `src/table.mock.ts` | Not needed publicly; author tests own fixtures. Skip |

Also: `GroupSummary`, `GroupKey`, `SortRule`, `SortDirection`, `TrackByFn` are exported via
`export * from './api/types'` — fine.

## Finding 2 — engine-fixed points a feature cannot change

Ranked by how hard they block a third-party feature.

### 2a. Closed stage unions (the `RENDER_ORDER` case) — blocking
- `engine/render-stages.ts:8` `RENDER_ORDER = ['group','tree','prune','paginate']`
- `engine/pipeline.ts:6` `PIPELINE_ORDER = ['filter','group','sort','expand']`
- `RenderStages`/`PipelineStages` derive from them as `Partial<Record<Stage, …>>`. A feature
  declaring `renderStages: { pin: … }` is a **compile error**, and `foldFeatures` only iterates
  the fixed list so an untyped JS consumer's extra key is **silently ignored**.
- `'paginate'` and `'expand'` are reserved-but-unclaimed slots, so `withPagination` specifically
  fits today. Anything else (`'pin'`, `'virtualize'`, `'footer'`, a second sort pass) does not.
- ADR-0011 explicitly rejected "make `RENDER_ORDER` consumer-configurable" — but the rejection
  was about *reordering* existing stages for the pagination/expansion interaction, not about
  *adding* a stage. Extending is a different question and not covered by that ADR.
- `'prune'` is engine-owned with a parent-before-child emission invariant
  (`render-stages.ts:38-41`); any stage inserted between `'tree'` and `'prune'` must honour it,
  and nothing enforces that.

### 2b. Core member claim list — minor
- `engine/slots.ts:6` `OverridableCoreKey = 'totalRowCount'` — the only core member a feature
  may override. Fine for pagination; documented in CLAUDE.md, not in consumer docs.

### 2c. `RenderRow` is a closed interface — moderate
- `api/types.ts:33` — feature-contributed fields (`isExpanded`, `hasChildren`, `aggregates`,
  `groupKey`) are hard-coded. A third-party stage cannot type a new field (`isPinned`,
  `pageIndex`). `aggregates: Record<string, unknown>` is the only open bag, and it is
  group-row-scoped by name. No `meta` side-channel on rows like `ColumnDef.meta`.

### 2d. `ColumnDef` feature fields — already solved
- `sortFn`/`enableSorting`/`aggregateFn` are hard-coded, but `ColumnDef.meta` +
  `createColumnMetaKey()` is a general side channel a third party can use. No change needed.

### 2e. `index`/`sourceIndex` stamped centrally after the chain (`engine/core.ts:87-98`) —
informational. A paginate stage that slices rows gets `index` relative to the page; whether
`aria-rowindex` should be page-relative or dataset-relative is a pagination design question,
not an extensibility blocker.

### 2f. Derive-block guard `PIPELINE_BEHAVIOR_KEYS` (`create-table-feature.ts:62`) — a
hand-maintained list of spec keys that must be updated whenever `TableFeatureSpec` grows.
Internal-only; note for the implementer.

## Finding 3 — cost to add a feature today

| Feature | Fits today? | What blocks |
|---|---|---|
| `withPagination` (in-repo or third-party) | Yes, once Finding 1 types are exported | `'paginate'` slot reserved; `totalRowCount` overridable |
| `withVirtualScroll` | Partly | Needs `'paginate'`-like slot (can reuse it but then collides with pagination) |
| `withColumnPinning` / `withRowPinning` | No | Needs a new render stage (row pinning) or a new `RenderRow` field |
| `withAggregation` as separate feature | No | `aggregates` stamped inside `'group'` stage; no post-group hook |
| A second filter pass (server + client) | No | `'filter'` single-claim, no `'filter2'` |

## Direction (answered 2026-09-17)

User: open registration. Mechanism to be discovered and discussed, ≥3 options, one of them
Angular DI (app- or component-level provider that hands the consumer the pipeline order).

## Discovery — open stage registration (agent report, 2026-09-17)

Full report (with source tags) to be saved at
`libs/table/docs/1-state/work/feature-authoring/discovery-open-stage-registration.md`
as the first execution step. Summary:

**Prior art.** No table library is extensible here: TanStack fixes
core→filtered→grouped→sorted→expanded→paginated and says "copy the source and fork"; its
custom-feature hooks add state/options only, never a row-model stage. AG Grid's six stages are
refresh entry points, not registration points. Plugin ecosystems (Rollup/Vite `enforce`,
tapable `stage`/`before`, Babel) all break ties by **registration order** — the exact
property ADR-0011 rejects. Angular's own docs say DI-registered `HTTP_INTERCEPTORS` ordering is
"very hard to predict" and steer to functional `withInterceptors()`.

**Options scored** (R1 deterministic regardless of arg order · R2 feature self-contained ·
R3 collision/typo throws · R4 typed · R5 engine Angular-free · R6 works in `composeFeatures` ·
R7 per-app/per-component override · R8 prune invariant statable · R9 built-ins unchanged ·
R10 general mechanism):

| | 1. DI `provideTableStages()` | 2. Anchors in spec | 3. Priority/`enforce` | 4. `stageOrder` config | 5. Fixed pre/post slots | 6. Hybrid 2 + DI edit-fn |
|---|---|---|---|---|---|---|
| R1 | yes (hidden in injector) | yes, ties throw | **no** | yes | **no** | yes |
| R2 | **no** — consumer must also insert `'pin'` | yes | yes | **no** | yes | yes |
| R3 | partial, needs new cross-check | yes | **no** | partial | yes | yes |
| R4 | **no** — runtime array can't widen `typeof arr[number]` | partial (`string & {}` for new names only) | yes | **no** | yes | partial |
| R5 | yes if `inject()` stays in `create-table.ts` | yes, pure toposort | yes | yes | yes | yes |
| R6 | partial — composite has no injector | yes | yes | partial | yes | yes |
| R7 | **yes — its only unique win** | no | no | partial | no | yes |
| R8 | no | yes (`preservesEmissionOrder`) | no | no | partial | yes |
| R9 | yes | yes | yes | yes | yes | yes |
| R10 | config, not authoring point | yes | yes | no | **no** | yes |

**Key insight.** DI vs anchors differ on *who knows placement*. Only the feature author knows
pinning runs after `'tree'` and before `'prune'`; the consumer only knows they want pinning.
Every DI failure (R2/R3/R4) traces to putting that knowledge with the consumer.

**Recommendation: option 6 — anchors as the definition site, DI as a deferred override.**
- Spec gains `stages.extra` / `renderStages.extra`: `{ name, after|before: Anchor, run,
  preservesEmissionOrder? }`. Built-in keys keep their closed union.
- `PIPELINE_ORDER`/`RENDER_ORDER` become `*_ANCHORS`; `'prune'` becomes a boundary, not an
  anchor. `'paginate'`/`'expand'` stay as terminal anchors.
- Construction throws on: unknown anchor, cycle, duplicate name, ambiguous tie,
  `preservesEmissionOrder: false` before the prune boundary. Same bargain as ADR-0007/0014.
- `provideTableStages((order) => order)` — an edit function over the *resolved* order, never a
  replacement array — added later only if a real consumer needs to reposition a library stage.
- Trade: a typo in a *third-party* stage name is a runtime throw, not a compile error.
- ADRs: amend 0011 (adding ≠ reordering), amend 0017 (prune = boundary with enforced
  predicate), new ADR for the mechanism.

**Against:** if no third-party stage ever ships, this is cost without payoff
(architecture.md's own warning). If per-app reordering is the *real* need, option 1 alone is
smaller.

### Addendum — extended discovery (2026-09-17, versions pinned via `npm view`)

**MUI X DataGrid pipe processors** (`@mui/x-data-grid@9.13.0`, read from unpkg):
- Named groups → `(value, ctx) => value` chain. Order = `Map` insertion order = React
  hook-call order. No priority/anchor. Unregister keeps the slot (`set(id, null)`).
- No duplicate detection possible: ids are `mui-${random}`. Accumulate model, not single-owner.
  Fails R1 and R3 — the pre-ADR-0003 behaviour.
- Registration hook is exported only from `/internals`; a consumer cannot add a plugin. R2
  solved for first-party premium packages only.
- **The one thing worth stealing:** `GridPipeProcessingLookup` is an **interface**, so a
  package adds a group by declaration merging and stays fully typed. Upgrades option 2's R4
  from partial to yes if the stage-name registry is an interface instead of a `const` array.

**Angular Signal Forms** (`@angular/forms@22.1.7`, not 21.x): `schema`/`apply`/`applyEach`/
`applyWhen` are void side-effecting fns; zero ordering primitives in 100+ exports. Multi-
contributor slots are made **commutative** by a key-declared `MetadataReducer`
(`list`/`min`/`max`/`or`/`and`/`override`). That escape is unavailable to a row-transform chain
(filter∘sort ≠ sort∘filter), so Signal Forms argues *for* explicit ordering here by elimination.
Record this in the new ADR so nobody later "fixes" anchors into a reducer.

**tapable 2.3.3** `Hook._insert`: `before` overrides `stage` — named constraint beats numeric.
Precedence to copy if a numeric escape hatch is ever added.

**Recommendation after addendum: unchanged in choice, one mechanism amended.**
Anchors in spec (option 6 hybrid) + declare the stage-name registry as an interface open to
declaration merging (MUI shape) so third-party names stay checked literals. Consequence:
CLAUDE.md's "one declaration, typed stage = executed stage" invariant is restated as
"interface = name registry; resolved order = construction-time derived fact". Adds ADR-0004 /
CLAUDE.md to the amend list.

Still unverified: declaration merging surviving `ngc` + barrel + overload generator; no compile
probe run for R4.

## Mechanisms — explored one by one

Running example throughout: a third-party `withRowPinning()` that must run **after `'tree'`
and before `'prune'`** (pinned rows hoisted to the top, children must stay under parents), and
a `withVirtualWindow()` that must run **after `'paginate'`**. Today neither compiles.

Each option shows: (A) what the feature author writes, (B) what the consumer writes,
(C) how the engine resolves order, (D) what fails and when, (E) verdict against R1–R10.

---

### M1 — Angular DI: `provideTableStages()`

**(A) Author**
```ts
export function withRowPinning<In extends PinningInput<In>>() {
  return createTableFeature((store: In) => ({
    members: { pinnedIds, pinRow, unpinRow },
    renderStages: { pin: hoistPinned(pinnedIds) },   // 'pin' is not in RENDER_ORDER → author
  }));                                               // must document "add 'pin' to your order"
}
```
**(B) Consumer** — app level or component `providers: [...]`
```ts
provideTableStages({
  render:   ['group', 'tree', 'pin', 'prune', 'paginate', 'virtualWindow'],
  pipeline: ['filter', 'group', 'sort', 'expand'],
});
```
**(C) Engine** — `createTable()` reads the token via `config.injector ?? inject(Injector)`,
passes the arrays into `composeTable()` → `createTableCore()` as parameters (engine stays
Angular-free). `foldFeatures` iterates the injected list instead of the const.
**(D) Failures**
- Consumer forgets `'pin'` → stage silently dropped unless a new cross-check ("every declared
  key must appear in the order") is added. Add it; then it throws at construction.
- Two consumers' component-level providers with different orders → each table resolves its own;
  fine, but a feature package can never assume a position.
- Types: `RenderStage` is `typeof RENDER_ORDER[number]`; a runtime array cannot widen it. The
  key on `renderStages` degrades to `string`. `'prune'` must be re-validated at runtime as
  present-exactly-once.
**(E)** R1 ✓ (hidden) · R2 ✗ · R3 partial · R4 ✗ · R5 ✓ · R6 partial (composite has no injector;
must defer) · **R7 ✓ (only option that wins here)** · R8 ✗ · R9 ✓ · R10 config, not authoring.

---

### M2 — Anchors declared in the spec

**(A) Author**
```ts
renderStages: {
  extra: [{
    name: 'pin',
    after: 'tree',                 // or before: 'prune' — exactly one
    preservesEmissionOrder: true,  // required when placed before the prune boundary
    run: hoistPinned(pinnedIds),
  }],
}
```
**(B) Consumer**
```ts
createTable(data, cfg, withExpansion(), withRowPinning(), withVirtualWindow());
```
Nothing else. Argument order still irrelevant.
**(C) Engine** — built-ins stay at fixed anchors `['group','tree','paginate']` (`'prune'` is a
boundary, not an anchor). At end of fold: collect all `extra` declarations, build a DAG
(anchor edges + declared edges), topological sort; two extras that both say `after: 'tree'`
with no edge between them = **ambiguous tie → throw** (or: sort by name as a documented
deterministic tiebreak — decision for the ADR). Pure function, vitest-testable.
**(D) Failures** — all at construction, naming both parties: unknown anchor, cycle, duplicate
name (existing `SlotRegistry.claim<TKey>` already generic), ambiguous tie,
`preservesEmissionOrder: false` on the pre-prune side.
**(E)** R1 ✓ · R2 ✓ · R3 ✓ · R4 partial (`PipelineStage | (string & {})`) · R5 ✓ · R6 ✓ ·
R7 ✗ · R8 ✓ · R9 ✓ · R10 ✓.

---

### M3 — Numeric priority / `enforce: 'pre' | 'post'` (Vite/Rollup/tapable)

**(A) Author**
```ts
renderStages: { extra: [{ name: 'pin', priority: 250, run }] }   // built-ins at 100/200/300/400
```
**(C) Engine** — sort by priority; ties by... registration order (every surveyed system) or
throw.
**(D)** Author must know the built-ins' numbers; two third parties picking 250 tie. A number
carries no *meaning* ("after tree" does), so an engine refactor renumbering built-ins breaks
every third party silently.
**(E)** R1 ✗ (ties positional) · R2 ✓ · R3 ✗ · R4 ✓ · R5 ✓ · R6 ✓ · R7 ✗ · R8 ✗ · R9 ✓ ·
R10 ✓. tapable itself lets `before` override `stage` — evidence that named beats numeric.

---

### M4 — Whole-order override on `createTable` config

```ts
createTable(data, { trackBy, columns, stageOrder: { render: [...] } }, ...features)
```
Same as M1 without DI: per-table only, no app-level default, same R2/R3/R4 losses, and R7 only
partially. Strictly dominated by M1 (M1 can do this with a component-level provider). Drop.

---

### M5 — Fixed pre/post multi-claim hook slots

```ts
renderStages: { beforePrune: [run], afterPaginate: [run] }
```
**(C)** Each slot is an array; run in fold order.
**(D)** Order within a slot = composition order → R1 ✗, which is the exact behaviour
ADR-0011 rejected. Enumerated slots → R10 ✗. Two features in `beforePrune` needing an order
between *them* have no way to say so.
**(E)** R1 ✗ · R2 ✓ · R3 ✓ · R4 ✓ · R5 ✓ · R6 ✓ · R7 ✗ · R8 partial · R9 ✓ · R10 ✗. Drop.

---

### M6 — Hybrid: M2 as definition site + M1 as edit-function override

**(A) Author** — exactly M2.
**(B) Consumer default** — exactly M2 (nothing).
**(B') Consumer who must reposition a library stage**
```ts
provideTableStages({
  render: (resolved) => moveBefore(resolved, 'pin', 'tree'),   // edit fn over the RESOLVED order
});
```
**(C)** Engine resolves M2's DAG first; if a token is present, applies the edit function to the
resolved list; re-validates (prune once, all names present, emission-order rule) → throw on
violation.
**(D)** M2's failures + "edit function removed/duplicated a stage" → throw.
**(E)** All of M2 plus R7 ✓. Cost: two mechanisms to document; the override must be rare and
clearly the escape hatch, never the tutorial path.

---

### M7 — MUI-style processor groups

```ts
apiRef.registerPipeProcessor('hydrateRows', id, fn)   // accumulate; Map insertion order
```
**(C)** Accumulate model: every processor in a group runs, in registration order. No single
owner, no ordering primitive.
**(D)** Collision undetectable by design (random ids); order = hook-call order.
**(E)** R1 ✗ · R2 partial · R3 ✗ · R4 **✓ via interface registry** · R5 n/a · R6 n/a · R7 ✗ ·
R8 ✗ · R9 ✓ · R10 ✓.
**Take only the typing trick:**
```ts
// engine/render-stages.ts
export interface RenderStageRegistry { group: true; tree: true; paginate: true }
export type RenderStage = keyof RenderStageRegistry;

// third-party package
declare module '@ngp/table' {
  interface RenderStageRegistry { pin: true }
}
```
Now `name: 'pin'` is a checked literal; `name: 'pinn'` is a compile error. Applies to M2/M6.
Unverified: survives `ngc` + barrel + overload generator (needs a compile probe).

---

### Side-by-side

| | M1 DI | M2 Anchors | M3 Priority | M4 Config | M5 Slots | M6 Hybrid | M7 MUI |
|---|---|---|---|---|---|---|---|
| Who knows placement | consumer | author | author | consumer | author | author (+consumer override) | nobody |
| Order = arg order? | no | no | ties yes | no | within slot yes | no | yes |
| Typo in stage name | silent/runtime | runtime (compile w/ M7 trick) | n/a | silent/runtime | compile | runtime (compile w/ M7 trick) | silent |
| Per-app override | ✓ | ✗ | ✗ | per-table | ✗ | ✓ | ✗ |
| Prune invariant declared | ✗ | ✓ | ✗ | ✗ | partial | ✓ | ✗ |
| Engine Angular-free | ✓ if inject in api/ | ✓ | ✓ | ✓ | ✓ | ✓ | n/a |
| ADRs touched | 0011 | 0011, 0017, new | 0011, new | 0011 | 0011 | 0011, 0017, 0004, new | — |
| Verdict | override layer only | **core** | reject | reject (⊂ M1) | reject | **recommended** | steal typing only |

### Open sub-decisions inside M2/M6 (for the ADR, not blocking the choice)
1. Ambiguous tie between two extras with the same anchor: throw, or deterministic
   name-sort tiebreak? (Throw is stricter and matches ADR-0007's spirit.)
2. Is `'prune'` an anchor target (`before: 'prune'`) or only a boundary reached via
   `after: 'tree'`? Discovery says boundary; `preservesEmissionOrder` gates the pre-prune side.
3. Can a third party anchor on *another third party's* stage (`after: 'pin'`)? Yes under a
   DAG; document that a missing dependency feature = unknown-anchor throw.
4. Pipeline layer gets the same `extra` shape, or render layer only in v1? Both are
   non-commutative; same mechanism, do both.

## Decision

Plan builds on **M6 (anchors + mergeable interface registry, DI edit-fn deferred)**.
Sub-decisions 1–4 above go to the grill session, not decided here.

**Authoring shape (decided 2026-09-18): declarative rule DSL, unified.** Stage claims and
declarations both go through the repo's existing rule pattern (`columnSchema` +
`applyVisible`/`applyGrouping` shape, `schema/column-rules.ts`), not an `extra: [...]`
object. The object form `renderStages: { tree: fn }` is removed; all four shipped features
refactor.

```ts
// claim a built-in slot (no name)
renderStages: stageSchema((s) => {
  applyStage(s.tree, { run: buildTreeStage(...) });
}),

// declare a new stage relative to an anchor
renderStages: stageSchema((s) => {
  applyStage(s.tree, {
    name: 'pin',
    placement: 'after',          // 'before' | 'after'
    run: hoistPinned(pinnedIds),
    preservesEmissionOrder: true,
  });
}),

// pipeline layer, same verb
stages: stageSchema((s) => {
  applyStage(s.sort, { run: (rows) => sortRows(rows, ...) });
}),
```

- `s` is a typed handle proxy over the stage registry interface (`RenderStageRegistry` /
  `PipelineStageRegistry`); `s.tre` is a compile error; a third-party anchor `s.pin` compiles
  once its package merges `interface RenderStageRegistry { pin: true }`.
- `applyStage` without `name` = claim; with `name` + `placement` = declare. Same throw
  policy as today's rules: duplicate claim, unknown anchor, cycle, tie, emission-order
  violation all throw at construction naming both parties.
- Resolve step mirrors `resolveColumnsConfig()` (`engine/columns-schema/resolve.ts`):
  record → resolve (toposort) → wire.
- `placement: 'before' | 'after'` is a string union, not a boolean: it is a position, not a
  deviation-from-default flag.

### Addendum 2 — why the order is what it is (2026-09-18, `@angular/material@22.1.7` pinned)

Two source facts reframed the edges:
- **`'expand'` is unclaimed.** `withExpansion()` declares only `renderStages.tree`; grep for
  `expand:` finds no claim. Same status as `'paginate'`.
- **Render `'group'` re-clusters from scratch** (`buildGroupRenderRows` → `buildClusters`;
  `rowsBeneathGroup`/`collectGroupIds` likewise). Pipeline `'group'`'s only observable
  effect is the order of `table.rows()`, not rendered output. Reasoned from reading, not
  probed.

| Edge | Class | Reason |
|---|---|---|
| pipeline filter → group | **hard** on summaries | `when`/aggregates see a cluster's own rows; group-first counts filtered-out rows. AG Grid groups first (pivot semantics); TanStack/Material filter first |
| pipeline group → sort | soft / contract | decides `table.rows()` shape (globally sorted vs cluster-contiguous); render re-clusters so output identical either way |
| pipeline sort → expand | hard once claimed, vacuous today | children must not be sorted away from parents; nothing claims it |
| pipeline → render seed | hard, a **type boundary** not an edge | `TRow[]` vs `Omit<RenderRow,'index'>[]`; synthesizing rows needs `data: null` → render layer only |
| render group → tree | **hard, self-checking** | `buildGroupRenderRows` throws on `data === null` input |
| render tree → prune | **hard** | prune needs `parentId` stamped first; flipped = collapse silently no-ops |
| render prune → paginate | **hard** for page size | Material `_filterData` → `_updatePaginator(filteredData.length)` before `_pageData`; flipped = ragged pages |

**Anchor set the mechanism should expose:** pipeline `filter`, `sort` (+ `group` documented
as contract-shaping); render `group`, `tree`, `paginate`; `prune` = boundary.
**Remove `'expand'`** rather than expose it: unoccupied, and its job (inject child rows) is
structurally the render `'tree'` stage — exposing it teaches authors the wrong phase.
Reverses Addendum 1's "keep `'expand'`".

**Invariants the engine can check (data-dependent → report + pass-through, never throw,
per ADR-0014; confirm the production-reporting clause against the ADR itself, not CLAUDE.md):**
1. Parent-before-child emission, `O(n)`, immediately before `'prune'`. ADR-0017's
   "load-bearing and unchecked".
2. Row-id uniqueness per `renderRows` evaluation — pinning that duplicates without re-keying
   corrupts `trackBy`/`indexById`; today fails quietly as `sourceIndex: undefined`.
3. Real-row id containment (output ⊆ input) — catches an invented real row.

**Declarable only (construction-time throw on positional violation):**
4. `rowCount: 'preserves' | 'may-shrink' | 'may-grow'` — a `may-grow` stage cannot sit after
   `'paginate'`.
5. `synthesizesRows: boolean` — a `true` stage cannot anchor before `'group'`; generalizes the
   hand-written throw in `buildGroupRenderRows`.
6. Phase itself — never derivable; layer comes free from the type.

**Effect on `applyStage` opts:** `preservesEmissionOrder` stays; add `rowCount` and
`synthesizesRows`. The declaration is the load-bearing part of the design, not the anchor
name. Document the inert-stage reference-preservation contract (return input unchanged),
don't assert it.

Not probed: whether dropping pipeline `'group'` leaves rendered output unchanged; AG Grid's
stated reason for group-before-filter. Both copies of the lib (`acme`, `ng-table`) agree
today; confirm which is canonical before editing.

**ADR numbering:** ADR-0018 is taken (`when` vs `enable`); 0019 is taken too (columns path); the new mechanism ADR is 0020.

## Work items

Ordered by dependency. Steps 1–2 are independent and parallel-safe; 3 gates 4–6.

### 1. Persist discovery (docs only)
- Create `libs/table/docs/1-state/work/feature-authoring/` with:
  - `discovery-open-stage-registration.md` — the agent report + both addenda verbatim
    (mechanisms; order rationale edge table + invariants).
  - `mechanisms.md` — the "Mechanisms — explored one by one" section above.
  - `1-intake.md` — ticket stub: goal, Findings 1–3, decision M6, open sub-decisions.
- Register the effort in `docs/1-state/architecture.md` "Not yet drilled" and `llms.txt` if
  the generator needs it (`npm run llms` — user runs).

### 2. Export the feature-author surface (code, no behaviour change)
`libs/table/src/index.ts` adds, type-only where possible:
- `Feature`, `Shape`, `RowOf`, `TableFeatureSpec` from `engine/types.ts`
- `WritableView`, `createWritableView` from `engine/writable-view.ts`
- `pruneByIds`, `resolveIndex` from `engine/rows.ts`
- `RenderRowTransform`, `RenderStage`, `RenderStages` / `RowTransform`, `PipelineStage`,
  `PipelineStages` from `engine/{render-stages,pipeline}.ts`
- `ColumnRuleEntry`, `ColumnRuleRegistry` from `engine/columns.ts`
Update the `index.ts` header comment and CLAUDE.md file table ("`engine/` — nothing here is
exported" becomes "engine exports only what `index.ts` lists for feature authors").
Acceptance: `nx run shared-table:typecheck` clean.

### 3. Grill + ADR (docs)
- `/grill-with-docs` on the intake: settles sub-decisions 1–4, tiebreak policy, `applyStage`
  opts naming (`placement`, `rowCount`, `synthesizesRows`, `preservesEmissionOrder`), and
  whether pipeline `'group'` stays an anchor or is documented as contract-shaping only.
- `docs/adr/0020-open-stage-registration.md` (new): anchors + declarative `applyStage` DSL,
  the anchor set (drop `'expand'`), the three checkable invariants and three declarations,
  why Signal Forms' reducer model does not apply, the interface-registry typing, DI deferred
  as edit-fn only.
- Amend ADR-0011 (adding ≠ reordering), ADR-0017 (prune = enforced boundary; invariant #1
  now checked), ADR-0004 + CLAUDE.md "Rules" bullets (the "edit `RENDER_ORDER` — nothing
  else" invariant is restated; `renderStages: { tree: fn }` object form is gone).

### 4. Compile probe (spike, throwaway)
Before engine work: a scratch `.ts` in a consumer app doing
`declare module '@ngp/table' { interface RenderStageRegistry { pin: true } }` and
verify `ngc` + barrel + `tools/generate-overloads.ts` accept it. Result recorded in the ADR.
If merging fails through the barrel, fall back to `name: string` (M2's original R4 partial).

### 5. Engine implementation (code) — via `/to-spec` → `/to-issues` → `/to-tasks`
Files:
- `schema/stage-schema.ts` (new, declare phase — mirrors `schema/column-schema.ts`):
  `stageSchema(fn)`, the typed handle proxy over `PipelineStageRegistry` /
  `RenderStageRegistry`, `record()` + `assertPathIsCurrent()` reuse.
- `schema/stage-rules.ts` (new): `applyStage(handle, opts)` — claim form (no `name`) and
  declare form (`name` + `placement` + `rowCount` + `synthesizesRows` +
  `preservesEmissionOrder`).
- `engine/pipeline.ts`, `engine/render-stages.ts`: `*_ORDER` → `*_ANCHORS` (`'expand'`
  removed) + interface registries; `'prune'` as boundary constant.
- `engine/stage-order.ts` (new, pure): `resolveStageOrder(anchors, rules, boundary)` →
  ordered list or throw (unknown anchor, cycle, duplicate, ambiguous tie, positional
  violation of `rowCount`/`synthesizesRows`/`preservesEmissionOrder`).
- `engine/render-stages.ts`: runtime invariant checks #1–#3 (parent-before-child, id
  uniqueness, id containment) — report once per stage per evaluation + pass-through, never
  throw (ADR-0014).
- `engine/types.ts`: `TableFeatureSpec.stages/renderStages` become `StageSchema<TRow>`
  (the recorded rule list), replacing the `Partial<Record<...>>` object form.
- `engine/slots.ts`: `claimStage`/`claimRenderStage` accept registry keys (already generic).
- `engine/compose-table.ts` `foldFeatures` + `api/features/compose-features.ts`
  `foldInnerFeatures`: collect rules; resolve once at end of fold; `core.ts` reads the
  resolved order instead of the const.
- `api/create-table-feature.ts` `PIPELINE_BEHAVIOR_KEYS`: unchanged.
- **Refactor shipped features** to the rule form: `withSorting` (`applyStage(s.sort)`),
  `withFiltering` (`s.filter`), `withGrouping` (`s.group` ×2 layers), `withExpansion`
  (`s.tree`). Behaviour unchanged; each gets `rowCount`/`synthesizesRows` declared.

### 6. Tests
- `engine/stage-order.spec.ts` (vitest, pure): every throw path + happy DAG + built-in order
  preserved with zero declared stages (R9 regression guard) + each positional declaration
  violation.
- `engine/render-stages.spec.ts`: invariants #1–#3 report and pass through; never throw.
- `schema/stage-schema.spec.ts`: claim vs declare forms, duplicate claim throws naming both.
- `compose-table.spec.ts` / `compose-features.spec.ts`: a declared stage runs between
  `'tree'` and `'prune'`; same inside `composeFeatures()`.
- `*.types.spec.ts`: `s.tre` is `@ts-expect-error`; `s.pin` compiles after registry merge.
- Existing `with-*.spec.ts` unchanged and green after the refactor (behaviour guard).

### 7. Feature-authoring guide (docs)
`libs/table/docs/1-state/feature-authoring.md`: the `with-*()` shape, the exported
surface from step 2, declaring a stage with an anchor, `onRowsRemoved` + `pruneByIds`,
`displayName`, testing a feature standalone. Worked example: `withRowPinning`. This is the
doc an agent skill would point at.

### 8. Deferred — separate issue
`provideTableStages(order => order)` DI override. Not in this effort; ADR-0020 records it as
the designated escape hatch.

## Verification
- Steps 2, 5: `nx run shared-table:typecheck` and `typecheck-spec` clean (user runs).
- Step 6: `nx test shared-table` (user runs).
- Step 4: probe compiles in a consumer app; result pasted into ADR-0020.
- No Storybook change; nothing previewable.
