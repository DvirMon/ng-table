---
step: 2
type: code
commit: feat
depends_on: [1]
files:
  - libs/table/src/engine/core.ts
  - libs/table/src/engine/compose-table.ts
  - libs/table/src/api/features/compose-features.ts
  - libs/table/src/engine/pipeline.ts
  - libs/table/src/engine/render-stages.ts
  - libs/table/src/engine/compose-table.spec.ts
  - libs/table/src/api/features/compose-features.spec.ts
  - libs/table/src/engine/pipeline.spec.ts
  - libs/table/src/engine/render-stages.spec.ts
  - libs/table/src/engine/render-stages.types.spec.ts
---

# Step 2 — Run the resolved order

Runs the pipeline and render layers off `resolveStageOrder`'s
output instead of reducing over the fixed anchor lists. A
declared stage now actually executes, at its resolved position.

Decisions: [Q9, Checks](../../plan.md)

## Do

```ts
export function runPipeline<TRow>(
  rows: TRow[],
  stages: readonly ResolvedStage<RowTransform<TRow>>[],
): TRow[];
export function runRenderStages<TRow>(
  nodes: readonly RenderNode<TRow>[],
  stages: readonly ResolvedStage<RenderNodeTransform<TRow>>[],
): readonly RenderNode<TRow>[];
```

`core.ts` holds an ordered list per layer instead of the keyed
`PipelineStages`/`RenderStages` objects — remove those two types.

`compose-table.ts`'s `foldFeatures` collects every rule with its
feature label as it folds. Claims still go through
`SlotRegistry`. After the loop, call `resolveStageOrder` once
per layer and hand the result to the core handle. Remove the
`if ('name' in rule) continue` skip and its `#155` comment.

`compose-features.ts` forwards inner claim and declare rules to
the outer fold unchanged. Remove `toStageRules`, the keyed maps,
and the `#155` comment. Inner-vs-inner claim collisions still go
through the private registry.

## Watch out

- `stages`/`renderStages` on a composite must stay absent when
  empty, never `[]` — see compose-features case 14 and
  `mergeDerivedSpec`'s guard.
- The ungated duplicate-claim test at `compose-table.spec.ts:205`
  stays unchanged in this step. Step 3 flips it.
- Fixtures use render name `pin` and pipeline name `audit`. Step
  4 adds their registry merges.

## Out of scope

- The resolver's own check matrix (Step 1).
- Runtime row-id checks (#156).
- Declared-name typing (Step 4).

## Done when

- [ ] No code path still reduces over `PIPELINE_ANCHORS` or
      `RENDER_ANCHORS` to run stages.
- [ ] Existing `with-*` and compose specs pass unchanged, per
      [step-2-run-resolved-order.test-plan.md](step-2-run-resolved-order.test-plan.md).

---

← [Step 1: The stage order resolver](step-1-stage-order-resolver.plan.md) | [Step 3: Duplicate stage claim is dev-only](step-3-dev-only-duplicate-claim.plan.md) →
