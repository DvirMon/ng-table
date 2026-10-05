---
step: 1
type: code
commit: refactor
depends_on: []
files:
  - libs/table/src/engine/types.ts
  - libs/table/src/engine/pipeline.ts
  - libs/table/src/engine/render-stages.ts
  - libs/table/src/engine/core.ts
  - libs/table/src/index.ts
  - libs/table/src/engine/pipeline.spec.ts
  - libs/table/src/engine/render-stages.spec.ts
  - libs/table/src/engine/pipeline.types.spec.ts
  - libs/table/src/engine/render-stages.types.spec.ts
---

# Step 1 — Stage context through both runners

This step threads a shared `StageContext` through the pipeline
and render-stage runners so every stage can read it.
It leaves resolving `parentOf` to a later step.

Decisions: [A1](../../3-architecture.md), [ADR-0028](../../../../../../../adr/0028-tree-parent-link-slot.md).

## Do

- Add `StageContext<TRow>` to `engine/types.ts`, re-exported
  (type-only) from `src/index.ts`:

  ```ts
  export type StageContext<TRow> = {
    readonly parentOf?: (row: TRow) => RowId | null;
  };
  ```

- Change the stage function types to take a second `ctx`
  parameter:

  ```ts
  export type RowTransform<TRow> = (rows: TRow[], ctx: StageContext<TRow>) => TRow[];

  export type RenderNodeTransform<TRow> = (
    nodes: readonly RenderNode<TRow>[],
    ctx: StageContext<TRow>,
  ) => readonly RenderNode<TRow>[];
  ```

- Give `runPipeline` and `runRenderStages` a required `ctx`
  parameter (no default), and forward the same `ctx` object
  to every stage they run.
- Update `engine/core.ts` to pass `{}` at both call sites.
- Update the 7 existing two-argument runner calls in
  `pipeline.spec.ts` (3) and `render-stages.spec.ts` (4) to
  pass `{}`.

## Watch out

- Existing one-argument stage lambdas must keep compiling
  unchanged — a function with fewer parameters is assignable
  to a type with more.
- `parentOf` takes a `TRow` (the row data), never a
  `RenderNode`. This matters for `render-stages.ts`, where
  `TRow` is not the node type.

## Out of scope

- Resolving `parentOf` from any feature — that's step 2.
- Any new `TableFeatureSpec` field.

## Done when

- [ ] `runPipeline` hands the same `ctx` object to every
      pipeline stage.
- [ ] `runRenderStages` hands the same `ctx` object to every
      render stage.
- [ ] One-argument stage lambdas still type-check.

---

[Step 2: `parentLink` slot, claimed once](step-2-parent-link-slot.plan.md) →
