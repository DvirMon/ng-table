---
step: 2
type: code
commit: feat
depends_on: [1]
files:
  - libs/table/src/engine/types.ts
  - libs/table/src/engine/slots.ts
  - libs/table/src/engine/compose-table.ts
  - libs/table/src/engine/core.ts
  - libs/table/src/engine/compose-table.spec.ts
---

# Step 2 — `parentLink` slot, claimed once

This step adds a single-claim `parentLink` slot that a feature
can contribute, and resolves it into `ctx.parentOf` at
evaluation time.
It leaves `composeFeatures()` and derive-block handling for
the next step.

Decisions: [D6](../../1-decisions.md), [A3](../../3-architecture.md), [ADR-0028](../../../../../../../adr/0028-tree-parent-link-slot.md).

## Do

- Add `parentLink` to `TableFeatureSpec`, with a JSDoc noting
  it is single-claim and read by stages through
  `ctx.parentOf`:

  ```ts
  parentLink?: (row: TRow) => RowId | null;
  ```

- Add `SlotRegistry.claimParentLink(feature: string): void`.
  A second claim always throws, including with `ngDevMode`
  off. Message:

  ```
  [createTable] <a> and <b> both provide the parent link.
  Only one feature may provide a parent link.
  ```

- In `compose-table.ts`, claim the slot during the fold and
  record the contributed link on the core handle.
- In `core.ts`, build `ctx.parentOf` from the recorded link
  lazily, at evaluation time, and pass that `ctx` to both
  `runPipeline` and `runRenderStages`.

## Watch out

- Without a contribution, `ctx.parentOf` must be `undefined`
  — never a default `() => null`.
- Resolve the link at evaluation time, not at fold time — a
  consuming feature may fold before the contributing one, the
  same trap `expandedSources` laziness guards against.

## Out of scope

- `composeFeatures()` and `createTableFeature` derive-block
  handling — that's step 3.
- Degrading a throwing `parentLink` callback (#167).

## Done when

- [ ] A pipeline stage in one feature and a render stage in
      another feature both resolve parents through a link a
      third feature contributes.
- [ ] Two contributions throw, naming both, with `ngDevMode`
      off too.

---

← [Step 1: Stage context through both runners](step-1-stage-context.plan.md) | [Step 3: parentLink through composeFeatures() and derive blocks](step-3-compose-parent-link.plan.md) →
