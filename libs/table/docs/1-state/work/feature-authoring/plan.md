# Third-party feature authoring — open stage registration

Tracking issue: [#102](https://github.com/DvirMon/ng-table/issues/102). Contract:
[ADR-0020](../../../adr/0020-open-stage-registration-for-third-party-features.md) (`proposed`).
Rewritten 2026-09-25 against current code — #106 (`'paginate'` dropped), ADR-0023 / #107
(`'prune'` deleted, render IR is a node tree), #119/#121 (`withTree()` / `withExpansion()` split),
ADR-0014's 2026-09-24 amendment, ADR-0025, ADR-0027.

**Readiness (2026-09-25):** all design questions (Q1–Q4) are decided in this file — the grill is
done here. Next step: amend ADR-0020 (work item 3), then the compile probe (4) and engine work (5).

## Context

Goal: a consumer must be able to author their own `with-*()` feature against the published
`@ngp/table` surface, without patching the library.

**"Third-party feature" means a feature the consumer's own teams write while using the
library** — e.g. a design-system team and an app team in one company, each shipping features
into the same tables. It does **not** mean an external publisher shipping features into the
library itself. Both parties to any conflict are in-house and can edit their own code.

Two questions:

1. Does `index.ts` export everything a feature author needs?
2. Which engine-fixed points (the `RENDER_ORDER` array and its kin) block or constrain a
   third-party feature, and how hard is it to add a feature today?

Audit scope: `ng-table/libs/table/src/` (nx project `shared-table`, alias `@ngp/table`).

## Finding 1 — export gaps for a feature author

`createTableFeature`, `withComputed`, `composeFeatures`, `RenderRow`, `RowId`, `TableStore`,
`DerivedDict`, `ReadonlyStore`, `ColumnDef`, `metadata`/`readColumnMeta`/`createColumnMetaKey`
are exported. Inference through `createTableFeature(factory)` works without naming the spec type.

Still not exported (verified 2026-09-25 — `index.ts` exports only `createTableFeature` of this
surface):

| Symbol | File | Why an author needs it |
|---|---|---|
| `TableFeatureSpec<TRow, Members>` | `engine/types.ts` | Return type of a `buildXSpec()` helper — every in-repo feature has one |
| `Feature<In, Out>`, `Shape`, `RowOf<In>` | `engine/types.ts` | Overload signatures (`withSorting` shape: config / derive / config+derive), F-bounded `In extends XInput<In>` |
| `WritableView<T, U>`, `createWritableView` | `engine/writable-view.ts` | A feature exposing a writable slice (`withGrouping` does) |
| `pruneByIds` | `engine/rows.ts` | ADR-0006: "if you store RowIds, declare `onRowsRemoved` and prune with `pruneByIds`" — mandatory rule, internal helper |
| `resolveIndex` | `engine/rows.ts` | Any id-keyed feature writing through `value.update` |
| `RenderNode`, `mapNodes`, `RenderStage`, `RenderStages`, `PipelineStage`, `RowTransform` | `engine/{render-stages,pipeline}.ts` | Typing a stage-builder helper; a render stage receives and returns `RenderNode<TRow>[]` and nests children via `mapNodes` |
| `ColumnRuleEntry` / `ColumnRuleRegistry` | `engine/columns.ts` | `TableFeatureSpec.columnRules` is typed with it |
| `displayName` convention | `engine/types.ts` `Feature.displayName` | Set via `Object.assign(feature, { displayName })` in every feature; undocumented |

## Finding 2 — engine-fixed points a feature cannot change

### 2a. Closed stage unions — blocking
- `engine/render-stages.ts:22` `RENDER_ORDER = ['group', 'tree']`
- `engine/pipeline.ts:6` `PIPELINE_ORDER = ['filter', 'group', 'sort', 'expand']`
- `RenderStages`/`PipelineStages` derive from them. A feature declaring `renderStages: { pin: … }`
  is a **compile error**, and the fold iterates only the fixed list, so an untyped JS consumer's
  extra key is **silently ignored**.
- No reserved-but-unclaimed render slot is left: `'paginate'` went with #106, `'prune'` with
  ADR-0023. Pipeline `'expand'` is still in the array but unclaimed (see Decision).
- Render stages exchange a nested `RenderNode<TRow>[]` tree; `engine/flatten.ts`
  `flattenVisible()` runs after the chain and alone derives `depth`/`parentId`/`hasChildren`/
  `isExpanded`. A child cannot be emitted above its parent, so no emission-order rule is needed.
- ADR-0011 rejected making the order *consumer-configurable* (reordering); *adding* a stage is a
  different question it did not cover.

### 2b. Core member claim list — minor
- `engine/slots.ts` `OverridableCoreKey = 'totalRowCount'` — the only core member a feature may
  override. Documented in CLAUDE.md, not in consumer docs.

### 2c. `RenderRow` is a closed interface — moderate
- `api/types.ts` — feature-contributed fields (`isExpanded`, `hasChildren`, `aggregates`,
  `groupKey`) are hard-coded. A third-party stage cannot type a new field (`isPinned`).
  `aggregates` is the only open bag and is group-row-scoped by name.

### 2d. `ColumnDef` feature fields — already solved
- `ColumnDef.meta` + `createColumnMetaKey()` is a general side channel. No change needed.

### 2e. `index`/`sourceIndex` stamped centrally after the chain — informational
- Whether `aria-rowindex` is page- or dataset-relative is a pagination design question.

### 2f. Derive-block guard `PIPELINE_BEHAVIOR_KEYS` (`create-table-feature.ts`)
- Hand-maintained list of spec keys; update whenever `TableFeatureSpec` grows. Internal-only.

## Finding 3 — cost to add a feature after this effort

| Feature | Fits? | What blocks |
|---|---|---|
| `withRowPinning` (render, after `'tree'`) | Yes | Finding 1 exports + this mechanism |
| A second filter pass (server + client) | Yes | Declared stage anchored on `'filter'` |
| `withAggregation` as separate feature | Yes | Declared stage after `'group'` |
| `withPagination` | **No** | Needs a post-flatten anchor; deferred to pagination's own issue (Q1) |
| `withVirtualScroll` / `withVirtualWindow` | **No** | Same — flat rows only exist after `flattenVisible` |
| `withColumnPinning` | Partly | Column side is `ColumnDef.meta`; a new `RenderRow` field is still closed (2c) |

## Direction (answered 2026-09-17)

User: open registration for features the consumer's own teams author (see Context).
Mechanism to be discovered and discussed, ≥3 options, one of them Angular DI.

## Discovery — summary

Full report with sources:
[`discovery-open-stage-registration.md`](discovery-open-stage-registration.md). Mechanisms
M1–M7 with worked author/consumer code: [`mechanisms.md`](mechanisms.md) (pre-ADR-0023 wording).

- No table library is extensible here (TanStack, AG Grid fix their stage sequence). Plugin
  systems (Rollup/Vite/tapable/Babel) tie-break on registration order — what ADR-0011 rejects.
- Key insight: only the feature author knows placement; every DI failure traces to putting that
  knowledge with the consumer.
- MUI X: stage-name registry as an `interface` open to declaration merging keeps names a
  consumer's team declares as checked literals. Adopted for typing only.
- Signal Forms makes multi-contributor slots commutative via reducers; a row-transform chain is
  non-commutative, so explicit ordering is required. Record in ADR so nobody "fixes" it later.

| | M1 DI | M2 Anchors | M3 Priority | M4 Config | M5 Slots | M6 Hybrid | M7 MUI |
|---|---|---|---|---|---|---|---|
| Who knows placement | consumer | author | author | consumer | author | author (+consumer override) | nobody |
| Order = arg order? | no | no | ties yes | no | within slot yes | no | yes |
| Per-app override | ✓ | ✗ | ✗ | per-table | ✗ | ✓ | ✗ |
| Verdict | override layer only | **core** | reject | reject (⊂ M1) | reject | **recommended** | steal typing only |

## Decision

**M6: anchors + mergeable interface registry, DI edit-fn deferred.**

### Authoring shape (decided 2026-09-18; naming updated 2026-09-25)

Declarative rule DSL, unified: stage claims and declarations both go through a stage schema,
**recording form** per ADR-0027 Rule 2 (a stage has a name but no UI-bound state). The object
form `renderStages: { tree: fn }` is removed; all four shipped stage-claiming features refactor
(`withSorting`, `withFiltering`, `withGrouping`, `withTree`).

**Rule name (Q3, decided 2026-09-25): `stage`.** Bare per ADR-0025, pairs with `stageSchema`,
one rule for both claim and declare.

```ts
// claim a built-in slot (no name)
renderStages: stageSchema((s) => {
  stage(s.tree, { run: buildTreeStage(...) });
}),

// declare a new stage relative to an anchor
renderStages: stageSchema((s) => {
  stage(s.tree, {
    name: 'pin',
    placement: 'after',          // 'before' | 'after'
    run: hoistPinned(pinnedIds),
  });
}),

// pipeline layer, same rule
stages: stageSchema((s) => {
  stage(s.sort, { run: (rows) => sortRows(rows, ...) });
}),
```

- `s` is a typed handle proxy over `RenderStageRegistry` / `PipelineStageRegistry`; `s.tre` is a
  compile error; a team-declared anchor `s.pin` compiles once the declaring team's code merges
  `interface RenderStageRegistry { pin: true }`.
- A declared stage may anchor on another declared stage (`stage(s.pin, …)`) — this is how an
  ambiguous tie is resolved (Q2). A missing upstream feature is an unknown-anchor error.
- No `name` = claim; `name` + `placement` = declare.
- `placement: 'before' | 'after'` is a string union: a position, not a deviation-from-default
  flag.
- `stageSchema` reuses `schema/run.ts` `runRecordedSchema()` and `schema/path-proxy.ts` — not
  `engine/filters/build.ts`'s declaring body.
- Resolve step mirrors the column schema: record → resolve (toposort) → wire.
- ADR-0020 Decision 1 still shows the older `{ name, after, before, run }` object — stale vs this
  shape; amend it (work item 3).

### Anchor set

- **Pipeline:** `'filter'`, `'sort'`. `'group'` stays documented as contract-shaping (it decides
  `table.rows()` shape; render re-clusters, so rendered output is identical either way).
- **Render:** `'group'`, `'tree'`.
- **`'expand'` removed.** Confirmed after #101 shipped (#119 `withTree()`, #121
  `withExpansion()`): no feature claims pipeline `'expand'`, and injecting child rows is the
  render `'tree'` stage's job. Closes ADR-0020's first open item.
- **No post-flatten anchor in v1 (Q1, decided 2026-09-25).** Pagination and virtual-window stay
  out of third-party reach until pagination's own issue decides the flat layer.

### Edge rationale (from discovery Addendum 2, updated)

| Edge | Class | Reason |
|---|---|---|
| pipeline filter → group | **hard** on summaries | `when`/aggregates see a cluster's own rows; group-first counts filtered-out rows |
| pipeline group → sort | soft / contract | decides `table.rows()` shape; render re-clusters |
| pipeline → render seed | hard, a **type boundary** | `TRow[]` vs `RenderNode<TRow>[]`; synthesizing rows needs the render layer |
| render group → tree | **hard, self-checking** | `buildGroupRenderRows` throws on synthesized input |
| render chain → `flattenVisible` | engine-owned, not an anchor | visibility and `depth`/`parentId` are derived from tree position (ADR-0023) |

### Checks

**Construction (wiring) — throw, dev-only.** Per ADR-0014's 2026-09-24 amendment, each check
gates `ngDevMode` inside its own body. Paths: unknown anchor, cycle, duplicate name or duplicate
claim, ambiguous tie, and `synthesizesRows: true` anchored before `'group'`. Each names both
parties.

**Ambiguous tie (Q2, decided 2026-09-25): throws.** Two declared stages on the same anchor and
placement with no edge between them throw at construction (dev-only), naming both stages and
telling the author the fix: declare an edge on one of them by anchoring it on the other
(`stage(s.pin, { name: 'audit', placement: 'after', … })`). Rationale: both features are
in-house, so whoever hits the error can edit either side. **Production fallback only** — when
the dev check is stripped, ties resolve by stage-name sort, deterministic. Not a supported
ordering mechanism; never document it as one.

**Declarable:** `synthesizesRows: boolean` only. `rowCount` (`preserves`/`may-shrink`/
`may-grow`) is **dropped** with Q1 — its only check was "may-grow cannot sit after
`'paginate'`", and no post-flatten anchor exists. `preservesEmissionOrder` is **dropped**
(ADR-0020 D3, ADR-0023).

**Runtime (data-dependent) — degrade + report, never throw.** Once per stage per evaluation, in
production too (ADR-0014, confirmed against its Decision section directly — closes ADR-0020's
third open item):
1. Row-id uniqueness per `renderRows` evaluation.
2. Real-row id containment (output's non-synthesized ids ⊆ input's).

Document the inert-stage contract (return input unchanged); don't assert it.

## Resolved questions (all decided 2026-09-25)

- **Q1** — no post-flatten anchor in v1 (see Anchor set).
- **Q2** — ambiguous tie throws (dev-only) with an edge-fix hint; name-sort is the production
  fallback only; a declared stage may anchor on another declared stage (see Checks).
- **Q3** — the rule is named `stage` (see Authoring shape).

**Q4 decided 2026-09-25: no consumer-side override in v1.** The tie error tells the feature
author to declare the order on their own stage by anchoring on the other stage's handle —
`stage(s.pin, { name: 'badge', placement: 'after', run })`. ADR-0020 D6's
`provideTableStages((order) => order)` stays deferred. **Revisit trigger:** a feature ships as
a versioned package that another team consumes and cannot edit.

**No capability decisions log (2026-09-26).** `state.json`'s `capabilityLogPath` is `null`:
stage registration is an engine-wide feature contract (pipeline + render stages, any
feature), owned by no single capability's `docs/decisions/<capability>.md`. This file and
ADR-0020 are the decision record.

## Work items

Ordered by dependency. 1 and 2 are parallel-safe; 3 gates 4–6.

### 1. Persist discovery (docs only) — done except registration
- `discovery-open-stage-registration.md` and `mechanisms.md` exist. `1-intake.md` dropped: this
  file and #102 already carry the intake.
- Register the effort in `docs/1-state/architecture.md` "Not yet drilled" and `llms.txt` if the
  generator needs it (`npm run llms` — user runs).

### 2. Export the feature-author surface (code, no behaviour change) — not started
`libs/table/src/index.ts` adds, type-only where possible:
- `Feature`, `Shape`, `RowOf`, `TableFeatureSpec` from `engine/types.ts`
- `WritableView`, `createWritableView` from `engine/writable-view.ts`
- `pruneByIds`, `resolveIndex` from `engine/rows.ts`
- `RenderNode`, `mapNodes`, `RenderStage`, `RenderStages` / `RowTransform`, `PipelineStage`,
  `PipelineStages` from `engine/{render-stages,pipeline}.ts`
- `ColumnRuleEntry`, `ColumnRuleRegistry` from `engine/columns.ts`

Update the `index.ts` header comment and CLAUDE.md file table ("`engine/` — nothing here is
exported" becomes "engine exports only what `index.ts` lists for feature authors").
Acceptance: `nx run shared-table:typecheck` clean.

### 3. Amend ADR-0020 + related ADRs (docs) — next step
- Amend ADR-0020:
  - Decision 1 → the `stageSchema` + `stage` rule form (recording, ADR-0027 Rule 2).
  - Decision 2 → close the `'expand'` open item (#119/#121); state no post-flatten anchor (Q1).
  - Decision 4 → close the ADR-0014 citation open item.
  - Decision 5 → drop `rowCount`; keep `synthesizesRows`.
  - Construction checks dev-only per ADR-0014 amendment; record Q2 (tie throws with fix hint;
    name-sort production fallback; stages may anchor on declared stages).
  - Reframe "third-party" as the consumer's own teams, not an external publisher.
  - Decision 6 → still deferred (Q4); record the revisit trigger: a feature ships as a
    versioned package another team consumes and cannot edit.
- Resolve the contradiction in CLAUDE.md's `schema/run.ts` row: it says the declaring form keeps
  its own body "until ADR-0020's `stageSchema` is a second caller", but `stageSchema` is the
  recording form. Decide which is wrong; don't assume.
- Amend ADR-0011 (adding ≠ reordering), ADR-0004 + CLAUDE.md "Rules" bullets (the "edit
  `RENDER_ORDER` — nothing else" invariant is restated; `renderStages: { tree: fn }` object form
  is gone).

### 4. Compile probe (spike, throwaway) — depends on 3 — ✅ done (#153: merging works, no fallback)
A scratch `.ts` in a consumer app doing
`declare module '@ngp/table' { interface RenderStageRegistry { pin: true } }`; verify `ngc` +
barrel + `tools/generate-overloads.ts` accept it. Record the result in ADR-0020 (its second open
item). If merging fails through the barrel, fall back to `name: string`.

### 5. Engine implementation (code) — depends on 3, 4; via `/to-spec` → `/to-issues` → `/to-tasks`
- `schema/stage-schema.ts` (new, declare phase): `stageSchema(fn)` over `runRecordedSchema()`,
  typed handle proxy over `PipelineStageRegistry` / `RenderStageRegistry`.
- `schema/stage-rules.ts` (new): `stage(handle, opts)` — claim form (no `name`)
  and declare form (`name` + `placement` + `synthesizesRows`).
- `engine/pipeline.ts`, `engine/render-stages.ts`: `*_ORDER` → `*_ANCHORS` + interface
  registries; `'expand'` removed from the pipeline.
- `engine/stage-order.ts` (new, pure): `resolveStageOrder(anchors, rules)` → ordered list; dev
  throws (unknown anchor, cycle, duplicate, tie, `synthesizesRows` before `'group'`), each gated
  in its own body; tie message names both stages + the edge fix; production tie fallback =
  name-sort.
- `engine/render-stages.ts`: runtime checks 1–2 — report once per stage per evaluation +
  pass-through, never throw.
- `engine/types.ts`: `TableFeatureSpec.stages/renderStages` become the recorded stage schema,
  replacing the `Partial<Record<...>>` object form.
- `engine/slots.ts`: claims accept registry keys (already generic).
- `engine/compose-table.ts` `foldFeatures` + `api/features/compose-features.ts`
  `foldInnerFeatures`: collect rules; resolve once at end of fold; `core.ts` reads the resolved
  order instead of the const.
- `api/create-table-feature.ts` `PIPELINE_BEHAVIOR_KEYS`: unchanged.
- **Refactor shipped features** to the rule form: `withSorting` (`s.sort`), `withFiltering`
  (`s.filter`), `withGrouping` (`s.group`, both layers), `withTree` (`s.tree`). Behaviour
  unchanged; each declares `synthesizesRows` where true (grouping render stage).

### 6. Tests — depends on 5
- `engine/stage-order.spec.ts` (vitest, pure): every dev throw path + happy DAG + built-in order
  preserved with zero declared stages (regression guard) + `synthesizesRows` positional violation
  + tie resolved by anchoring one declared stage on another + name-sort fallback with the dev
  check stripped.
- `engine/render-stages.spec.ts`: runtime checks 1–2 report and pass through; never throw.
- `schema/stage-schema.spec.ts`: claim vs declare forms, duplicate claim throws naming both.
- `compose-table.spec.ts` / `compose-features.spec.ts`: a declared stage runs after `'tree'`;
  same inside `composeFeatures()`.
- `*.types.spec.ts`: `s.tre` is `@ts-expect-error`; `s.pin` compiles after registry merge.
- Existing `with-*.spec.ts` unchanged and green after the refactor (behaviour guard).

### 7. Feature-authoring guide (docs) — depends on 2, 5
`libs/table/docs/1-state/feature-authoring.md`: the `with-*()` shape, the exported surface from
step 2, declaring a stage with an anchor, `RenderNode` + `mapNodes`, `onRowsRemoved` +
`pruneByIds`, `displayName`, testing a feature standalone. Worked example: `withRowPinning`.

### 8. Deferred — separate issues
- `provideTableStages(order => order)` DI override — not in v1 (Q4). Open the issue when a
  feature ships as a versioned package that another team consumes and cannot edit. ADR-0020
  records it as the escape hatch.
- Post-flatten anchor — owned by pagination's issue (Q1).

## Verification
- Steps 2, 5: `nx run shared-table:typecheck` and `typecheck-spec` clean (user runs).
- Step 6: `nx test shared-table` (user runs).
- Step 4: probe compiles in a consumer app; result pasted into ADR-0020.
- No Storybook change; nothing previewable.
