# ADR-0011 — Chained render stages replace the single-occupancy `renderRows` slot

**Status:** proposed
**Date:** 2026-09-03
**Related:** [ADR-0003](0003-in-house-table-store-engine.md) (introduced the single-claim slot),
[ADR-0005](0005-generic-table-host.md) (central `index` assignment),
[ADR-0007](0007-feature-member-claims.md) (member claims),
[ADR-0012](0012-split-expansion-into-panel-and-tree.md) (consumes this mechanism)

## Context

`renderRows` is the `TRow[] → RenderRow<TRow>[]` shape-change step. A feature declares it on its
`TableFeatureSpec`; `SlotRegistry.claimRenderRows()` throws if a second feature claims it:

```ts
claimRenderRows(feature: string): void {
  const isAlreadyClaimed = this.renderRowsOwner !== undefined;
  if (isAlreadyClaimed) {
    throw new Error(
      `[createTable] ${this.renderRowsOwner} and ${feature} both provide ` +
        '`renderRows`. Only one feature may override how render rows are built.'
    );
  }
  this.renderRowsOwner = feature;
}
```

Single-occupancy was the right call at the time: under `@ngrx/signals` a second claimant won
silently by `features` array order (ADR-0003), and throwing is strictly better than that. The
defect is not the throw — it is that *only one* feature can ever reshape render rows.

Every feature that synthesizes or drops render rows wants this slot:

| Feature | Needs to reshape `RenderRow[]` | Status |
|---|---|---|
| `withExpansion()` (tree today) | inserts children at `depth + 1` | shipped, claims the slot |
| `withGrouping()` | inserts `kind: 'group'` headers | spec'd, **cannot be built** |
| `withPagination()` | slices a window | spec'd, cannot be built |
| `withVirtualScroll()` | none — *reads* `renderRows()` only | unaffected, per `features/virtual-scroll.md` |

So `withGrouping()` cannot compose with expansion, `withPagination()` cannot compose with
either, and any two of the three are mutually exclusive forever.

### This is already recorded as a blocker, twice, with conflicting fixes

[`docs/1-state/architecture.md`](../1-state/architecture.md) open questions:

> **PRIORITY — `renderRows` single-occupancy blocks feature combination.** … Any feature that
> reshapes the render-row array … currently cannot compose with another such feature (e.g.
> paginate + expand together is not possible today). Flagged as major, not cosmetic: several
> not-yet-drilled features in this doc assume this combination works. Needs resolution — e.g. a
> chained/composable `renderRows` pipeline instead of single-claim — before drilling
> `withPagination()`, `withSelection()`, or `withVirtualScroll()`.

[`docs/1-state/features/grouping.md`](../1-state/features/grouping.md) blocker note proposes a
**different** resolution:

> Before implementing, resolve this — the two render-row builders must merge into one declared
> builder (grouping's cluster walk already needs to read `expandedRows`, so they were never truly
> independent).

Chained pipeline vs. merged builder are not the same answer. Neither was chosen, so both
`withGrouping()` and `withPagination()` have sat undrillable. This ADR picks one.

### The mechanism already exists one layer down

`engine/pipeline.ts` solves exactly this problem for `TRow[] → TRow[]` transforms — fixed order,
multi-claim, one declaration:

```ts
export const PIPELINE_ORDER = ['filter', 'group', 'sort', 'expand'] as const;
export type PipelineStage = (typeof PIPELINE_ORDER)[number];
export type PipelineStages<TRow> = Partial<Record<PipelineStage, RowTransform<TRow>>>;
```

Four features each claim their own named stage and compose without collision. The render layer
has no equivalent — it has one slot.

### Prior art

TanStack Table chains row models (core → grouped → expanded → sorted → filtered → paginated),
each a transform over the previous. It does not merge them into one builder. AG Grid keeps Tree
Data and Master/Detail as separate features precisely because it does not have a composable
seam between them — and it makes them mutually exclusive as a result, which is the outcome
this ADR exists to avoid.

## Decision

1. **The `TRow[] → RenderRow[]` seed is always the engine's.** `buildDefaultRenderRows`
   (1:1 wrap) always runs. No feature replaces it.
2. **Add an ordered, multi-claim render stage chain** over `RenderRow[]`, mirroring
   `PIPELINE_ORDER` — one array as the single source of truth, the stage union derived from it:

   ```ts
   export const RENDER_ORDER = ['group', 'tree', 'paginate'] as const;
   export type RenderStage = (typeof RENDER_ORDER)[number];
   export type RenderRowTransform<TRow> = (
     rows: Omit<RenderRow<TRow>, 'index'>[]
   ) => Omit<RenderRow<TRow>, 'index'>[];
   export type RenderStages<TRow> = Partial<Record<RenderStage, RenderRowTransform<TRow>>>;
   ```

3. **`TableFeatureSpec.renderRows` is replaced by `TableFeatureSpec.renderStages`.** A feature
   claims one or more *named* render stages instead of the whole builder.
4. **Collision is per named stage, not per layer.** `SlotRegistry.claimRenderRows()` is deleted;
   render stages claim through the same mechanism as pipeline stages, so two features claiming
   `'group'` still throw — the ADR-0003 guarantee is preserved, just at a finer grain.
5. **`index` stays centrally assigned once, after the whole chain** — the ADR-0005 invariant is
   unchanged, which is why every stage signature is `Omit<RenderRow<TRow>, 'index'>[]`. A stage
   declares row identity and shape, never final position.

`RENDER_ORDER`'s membership is fixed by the engine, not by features, for the same reason
`PIPELINE_ORDER` is: order must not depend on the `features` array.

Naming `'paginate'` before `withPagination()` exists follows the precedent already set by
`PIPELINE_ORDER`, which lists `'filter'` and `'group'` for features that do not exist yet. Adding a
stage stays a one-line edit to the array.

### 6. Ordering rationale, and why tree-vs-paginate is *not* an ordering question

**`'group'` before `'tree'`.** Grouping is the outer structure: it inserts `kind: 'group'` headers
over the row list, and tree then expands each row's children in place beneath their parent, inside
the group. Reversed, the tree would flatten first and grouping would scatter children away from
their parents into value-clusters of their own.

**`'paginate'` last**, and — the part worth recording — *whether a page counts expanded children is
a config flag on `withPagination()`, not a reordering of this array*. Both prior-art libraries put
pagination last unconditionally and expose a flag consumed by the pagination step:

| Library | Flag | Default | Effect |
|---|---|---|---|
| TanStack | `paginateExpandedRows` | `true` | children counted; a parent's children may span pages |
| AG Grid | `paginateChildRows` | `false` | page holds N *top-level* rows; expanding grows the page |

**Decision: default to AG Grid's behavior** — paginate top-level rows; expanding grows the current
page rather than pushing rows onto the next one. A flag (`paginateChildRows`, name matching the
behavior it selects) opts into strict page size.

Rationale: expanding is a frequent, exploratory action on a tree table, and under TanStack's
default every expand reflows every subsequent page — rows the user was not looking at move
underneath them. Stable page boundaries are worth more than a strict page count here. Strict count
matters mainly when page size is a render budget, which is `withVirtualScroll()`'s job in this
library, not pagination's. Detail-panel expansion ([ADR-0012](0012-split-expansion-into-panel-and-tree.md))
is unaffected either way — panel content is never a render row, so pagination never sees it.

This is recorded here because the flag's default is a product decision, but the *ordering* it might
otherwise have implied is not: `'paginate'` is last in both modes.

## Alternatives considered

| Option | Why not |
|---|---|
| Merge the builders into one declared builder (`grouping.md`'s proposal) | An enumerated fix — every new reshaping feature edits one shared function, and that function must then know about grouping *and* tree *and* pagination. Reintroduces exactly the coupling `features: []` exists to avoid, and the merged function has no owner |
| Keep single-occupancy; make grouping+tree one mega-feature | Same coupling, plus it forces consumers who want only grouping to ship the tree walk. Also just relocates the collision to the next reshaping feature (`withPagination()`) |
| Keep the slot; let `features` array order decide | This is the pre-ADR-0003 `@ngrx/signals` behavior that single-occupancy was introduced to kill. Silent wrong rows |
| Let features append to an unordered transform list | Execution order would depend on `features` order — the exact property `PIPELINE_ORDER` was designed to remove. A named, engine-fixed order is the point |
| Make `RENDER_ORDER` consumer-configurable, so tree-vs-paginate can be reordered per table | Considered specifically for the "do expanded children count toward page size" case, and rejected: neither TanStack nor AG Grid reorders for it — both keep pagination last and put the choice in a flag the pagination step reads (see §6). A configurable order would make every stage's input shape unpredictable to every other stage, to buy one behavior a boolean already buys |
| Generalize `renderRows` to `RenderRow[] → RenderRow[]` but keep it single-claim | Solves nothing; the slot is the constraint, not its signature |

## Consequences

**Gained**
- `withGrouping()` becomes buildable, and composes with detail-panel expansion, tree, and
  pagination independently.
- `withPagination()` / `withSelection()` become drillable — architecture.md's stated
  precondition for those is satisfied.
- One declaration per fact: `RENDER_ORDER` is the only list, `RenderStage` derives from it, so a
  typed stage is always an executed stage (same invariant `PIPELINE_ORDER` already holds).
- `claimRenderRows` and `RenderRowsBuilder` are deleted, not reinterpreted.

**Cost**
- Breaking change to the **feature-authoring** contract: `TableFeatureSpec.renderRows` →
  `renderStages`. `createTableFeature` is public, so any external custom feature declaring
  `renderRows` breaks. No shipped consumer does — `withExpansion()` is the only in-repo
  claimant.
- Touches `engine/pipeline.ts`, `engine/slots.ts`, `engine/core.ts`, `engine/compose-table.ts`,
  `engine/types.ts`, and their specs.
- Each stage must preserve `sourceIndex` semantics rather than assume it. `engine/core.ts`
  assigns `sourceIndex: isSynthesizedRow ? undefined : byId.get(row.id)` from `indexById`, which
  is built from top-level `data()` only. A stage that synthesizes rows must leave `sourceIndex`
  `undefined`; a stage that reorders or wraps existing rows must carry it through. This is the
  mechanism [G6](../1-state/work/with-row-editing/5-gaps.md) needs, and it is why G6 becomes a
  stage-level concern rather than an engine-wide one.
- `features/grouping.md`'s blocker note and `architecture.md`'s PRIORITY item are both resolved
  by this ADR and must be updated to point at it rather than restating the problem.

**Verification plan**
- `PipelineStages`-style derivation test: every `RENDER_ORDER` member is executed by
  `runRenderStages`, asserted from the array rather than a hand-written list.
- Two features claiming the same render stage throws, naming both — same assertion shape as the
  existing `claimStage` spec.
- Order independence: composing `[withTree(), withGrouping()]` and `[withGrouping(), withTree()]`
  produces identical `renderRows()` output.
- `index` is contiguous and 0-based after a multi-stage chain that both inserts and drops rows.
- Existing `engine/core.spec.ts` `sourceIndex` assertions (assign / reorder / undefined-for-group)
  pass unchanged.
