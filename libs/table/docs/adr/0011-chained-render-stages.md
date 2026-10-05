# ADR-0011 — Chained render stages replace the single-occupancy `renderRows` slot

**Status:** accepted
**Date:** 2026-09-03
**Related:** [ADR-0003](0003-in-house-table-store-engine.md) (introduced the single-claim slot),
[ADR-0005](0005-generic-table-host.md) (central `index` assignment),
[ADR-0007](0007-feature-member-claims.md) (member claims),
[ADR-0012](0012-split-expansion-into-panel-and-tree.md) (consumes this mechanism),
[ADR-0017](0017-engine-owned-descendant-prune.md) (partially supersedes — see note below),
[ADR-0023](0023-tree-shaped-render-ir.md) (amends decision 2 — see note below)

**Partially superseded by [ADR-0017](0017-engine-owned-descendant-prune.md) (2026-09-16),
itself since revised by [ADR-0023](0023-tree-shaped-render-ir.md).** This ADR's chained-stage
model stands unchanged — stages still compose through `RENDER_ORDER`, still resolve as an
ordered fold. What's amended is decision 4's allocation of stage responsibilities: it assumed
every render stage is feature-claimable through `SlotRegistry`. ADR-0017 added `'prune'`, an
engine-owned terminal stage no feature could claim; ADR-0023 deleted `'prune'` outright rather
than keep it as an unclaimable member, so this decision's allocation question is moot again —
every entry in `RENDER_ORDER` is claimable. The chaining mechanism this ADR introduced is what
made both additions possible.

**Decision 2 amended by [ADR-0023](0023-tree-shaped-render-ir.md) (2026-09-20).** The stage
signature changes from `RenderRowTransform` (flat rows in, flat rows out) to
`RenderNodeTransform` (nested `RenderNode`s in, nested `RenderNode`s out) — "chained render
stages" now chains node transforms. `RENDER_ORDER` drops to `['group', 'tree']`. See ADR-0023
for the full rationale.

**Adding a stage is not reordering — amended by [ADR-0020](0020-open-stage-registration-for-third-party-features.md) (2026-09-30).**
`RENDER_ORDER` is now the fixed anchor list `RENDER_ANCHORS`. A feature adds a stage by declaring it
next to an anchor (ADR-0020), not by editing the order. That is not reordering: the built-in order
stays fixed, and the rejection below of a consumer-configurable `RENDER_ORDER` still stands.

`renderRows` (`TRow[] → RenderRow<TRow>[]`) was single-claim: only one feature could ever reshape
render rows, so `withGrouping()` (inserts group headers), `withPagination()` (slices a window),
and `withExpansion()`'s tree walk (inserts children) could never compose with each other. Already
recorded as a blocker in [`architecture.md`](../1-state/architecture.md) and
[`features/grouping.md`](../1-state/features/grouping.md).

`engine/pipeline.ts` already solves this shape for `TRow[] → TRow[]`: an ordered array is the
single source of truth, and a stage-union type derives from it, so multiple features each claim a
named stage and compose without collision. This ADR applies the same mechanism one layer up.

## Decision

1. **The `TRow[] → RenderRow[]` seed is always the engine's** (`buildDefaultRenderRows`, 1:1 wrap).
   No feature replaces it.
2. **Add an ordered, multi-claim render stage chain**, mirroring `PIPELINE_ORDER`:

   ```ts
   export const RENDER_ORDER = ['group', 'tree'] as const;
   export type RenderStage = (typeof RENDER_ORDER)[number];
   export type RenderNodeTransform<TRow> = (
     nodes: readonly RenderNode<TRow>[],
   ) => readonly RenderNode<TRow>[];
   export type RenderStages<TRow> = Partial<Record<RenderStage, RenderNodeTransform<TRow>>>;
   ```

   _(As amended by [ADR-0023](0023-tree-shaped-render-ir.md), 2026-09-20 — `'paginate'` left
   this array unclaimed in #106 and was dropped; the stage signature moved from flat
   `RenderRowTransform` to nested `RenderNodeTransform` in #107.)_

3. **`TableFeatureSpec.renderRows` is replaced by `TableFeatureSpec.renderStages`** — a feature
   claims one or more named stages instead of the whole builder.
4. **Collision is per named stage, not per layer.** `SlotRegistry.claimRenderRows()` is deleted;
   render stages claim through the same mechanism as pipeline stages — two features claiming
   `'group'` still throw.
5. **`index` stays centrally assigned once, after the whole chain** (ADR-0005 unchanged) — every
   stage signature omits `index`; a stage declares row identity and shape, never final position.

`RENDER_ORDER`'s membership is fixed by the engine, same reasoning as `PIPELINE_ORDER`: order must
not depend on the `features` array. `'group'` runs before `'tree'` because grouping is the outer
structure (reversed, tree would flatten first and scatter children away from their value-cluster
parent).

_(The `'paginate'` stage this paragraph originally described running last, and whether a page
counts expanded children as a `withPagination()` config flag, is superseded — `'paginate'` left
`RENDER_ORDER` unclaimed in #106 and no pagination feature was ever built against it. Whether a
post-flatten anchor is reintroduced is [#102](https://github.com/DvirMon/ng-table/issues/102)'s
call; see [ADR-0020](0020-open-stage-registration-for-third-party-features.md) decision 2.)_

## Alternatives considered

- **Merge all reshaping into one declared builder** (`grouping.md`'s original proposal) — rejected, couples every reshaping feature to every other with no single owner.
- **Keep single-occupancy; make grouping+tree one mega-feature** — rejected, same coupling, plus forces consumers wanting only grouping to ship the tree walk.
- **Keep the slot; let composition order decide** — rejected, this is the pre-ADR-0003 silent-wrong-rows behavior single-occupancy was introduced to kill.
- **Unordered append list** — rejected, execution order would depend on composition order, the exact property `PIPELINE_ORDER` exists to remove.
- **Make `RENDER_ORDER` consumer-configurable** — rejected, neither TanStack nor AG Grid reorders for the pagination/expansion interaction; a boolean flag buys the same behavior without making every stage's input unpredictable.
- **Generalize `renderRows`'s signature but keep it single-claim** — rejected, solves nothing; the slot is the constraint, not its signature.

## Consequences

**Gained**

- `withGrouping()`, `withPagination()`, `withSelection()` become buildable/drillable, composing
  with tree and each other independently.
- One declaration per fact: `RENDER_ORDER` is the only list, `RenderStage` derives from it. (Since ADR-0020 the stage keys derive from `RenderStageRegistry`.)
- `claimRenderRows` and `RenderRowsBuilder` are deleted, not reinterpreted.

**Cost**

- Breaking change to the feature-authoring contract: `TableFeatureSpec.renderRows` → `renderStages`. `createTableFeature` is public; no shipped consumer other than `withExpansion()` claims it today.
- Touches `engine/pipeline.ts`, `engine/slots.ts`, `engine/core.ts`, `engine/compose-table.ts`, `engine/types.ts`, and their specs.
- Each stage must preserve `sourceIndex` semantics: a stage that synthesizes rows leaves it `undefined`; a stage that reorders/wraps existing rows carries it through. This is the mechanism [G6](../1-state/work/row-editing/active/with-row-editing/5-gaps.md) needs.
- `features/grouping.md`'s blocker note and `architecture.md`'s PRIORITY item are both resolved by this ADR and should point at it rather than restate the problem.
