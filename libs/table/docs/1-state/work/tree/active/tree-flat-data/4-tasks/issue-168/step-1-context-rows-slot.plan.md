---
step: 1
type: code
commit: feat
depends_on: []
files:
  - libs/table/src/engine/types.ts
  - libs/table/src/engine/core.ts
  - libs/table/src/engine/compose-table.ts
  - libs/table/src/engine/render-stages.ts
  - libs/table/src/api/types.ts
  - libs/table/src/engine/core.spec.ts
  - libs/table/src/engine/compose-table.spec.ts
  - libs/table/src/api/types.types.spec.ts
  - libs/table/src/engine/render-stages.types.spec.ts
---

# Step 1 — Context-rows engine slot

This step adds an accumulating `contextRows` slot to the engine and stamps `RenderRow.isContextRow` centrally.
It leaves the composite merge to step 2 and any feature that contributes the slot to step 4.

Decisions: [D18](../../1-decisions.md), [A2](../../3-architecture.md)

## Do

- Add the slot next to `expandedRows` in `engine/types.ts`:

  ```ts
  readonly contextRows?: Signal<ReadonlySet<RowId>>;
  ```

- In `compose-table.ts`, push each feature's contribution into a new `handle.contextSources` array during the outer fold.
- In `core.ts`, union the sources in a `computed`.
- Stamp `RenderRow.isContextRow` in `core.ts`, beside `index` and `sourceIndex`:
  - Data rows get `true` or `false` once at least one source exists.
  - Data rows get `undefined` when no source exists.
  - Synthesized rows (`data === null`) always get `undefined`.
- Add `readonly isContextRow?: boolean` to `RenderRow` in `api/types.ts`.
- Add `'isContextRow'` to the `Omit` list of `RenderNode` in `engine/render-stages.ts`.

## Watch out

- The "no sources" check reads `contextSources` at evaluation time, because features register during the fold.
- An empty union is not the same as no sources. One source with an empty set stamps `false`.
- The slot accumulates. Never claim it through `SlotRegistry`.

## Out of scope

- The `composeFeatures` inner merge and `PIPELINE_BEHAVIOR_KEYS` (step 2).
- Any feature that contributes the slot (step 4).

## Done when

- [ ] Data rows are stamped from the union of all sources.
- [ ] `isContextRow` is `undefined` when no feature contributes.
- [ ] `isContextRow` is `false` when a contributor has an empty set.
- [ ] Group rows keep `isContextRow` as `undefined`.

---

[Step 2: Compose context rows](step-2-compose-context-rows.plan.md) →
