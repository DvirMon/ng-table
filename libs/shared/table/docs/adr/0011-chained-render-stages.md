# ADR-0011 — Chained render stages replace the single-occupancy `renderRows` slot

**Status:** accepted
**Date:** 2026-09-03
**Related:** [ADR-0003](0003-in-house-table-store-engine.md) (introduced the single-claim slot),
[ADR-0005](0005-generic-table-host.md) (central `index` assignment),
[ADR-0007](0007-feature-member-claims.md) (member claims),
[ADR-0012](0012-split-expansion-into-panel-and-tree.md) (consumes this mechanism),
[ADR-0017](0017-engine-owned-descendant-prune.md) (partially supersedes — see note below)

**Partially superseded by [ADR-0017](0017-engine-owned-descendant-prune.md) (2026-09-16).** This
ADR's chained-stage model stands unchanged — stages still compose through `RENDER_ORDER`, still
resolve as an ordered fold. What's amended is decision 4's allocation of stage responsibilities:
it assumed every render stage is feature-claimable through `SlotRegistry`. ADR-0017 adds
`'prune'`, an engine-owned terminal stage no feature can claim (enforced by excluding it from the
`RenderStages` key union rather than through `SlotRegistry`). The chaining mechanism this ADR
introduced is exactly what makes that addition possible — see ADR-0017 for the stage itself.

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
   export const RENDER_ORDER = ['group', 'tree', 'paginate'] as const;
   export type RenderStage = (typeof RENDER_ORDER)[number];
   export type RenderRowTransform<TRow> = (
     rows: Omit<RenderRow<TRow>, 'index'>[]
   ) => Omit<RenderRow<TRow>, 'index'>[];
   export type RenderStages<TRow> = Partial<Record<RenderStage, RenderRowTransform<TRow>>>;
   ```

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
parent). `'paginate'` runs last, and whether a page counts expanded children is a config flag on
`withPagination()` (`paginateChildRows`, default matching AG Grid — stable page boundaries over
strict count), not a reordering of this array — full flag-precedent comparison:
[`grouping-expansion-coupling/prior-art.md`](../1-state/work/grouping-expansion-coupling/prior-art.md#pagination-vs-expanded-children-relocated-from-adr-0011-d7).

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
- One declaration per fact: `RENDER_ORDER` is the only list, `RenderStage` derives from it.
- `claimRenderRows` and `RenderRowsBuilder` are deleted, not reinterpreted.

**Cost**
- Breaking change to the feature-authoring contract: `TableFeatureSpec.renderRows` → `renderStages`. `createTableFeature` is public; no shipped consumer other than `withExpansion()` claims it today.
- Touches `engine/pipeline.ts`, `engine/slots.ts`, `engine/core.ts`, `engine/compose-table.ts`, `engine/types.ts`, and their specs.
- Each stage must preserve `sourceIndex` semantics: a stage that synthesizes rows leaves it `undefined`; a stage that reorders/wraps existing rows carries it through. This is the mechanism [G6](../1-state/work/with-row-editing/5-gaps.md) needs.
- `features/grouping.md`'s blocker note and `architecture.md`'s PRIORITY item are both resolved by this ADR and should point at it rather than restate the problem.
