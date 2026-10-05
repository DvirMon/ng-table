---
step: 1
type: code
commit: feat
depends_on: []
files:
  - libs/table/src/engine/stage-order.ts (new)
  - libs/table/src/engine/stage-order.spec.ts (new)
  - libs/table/src/engine/pipeline.ts
  - libs/table/src/ng-dev-mode.testing.ts
---

# Step 1 — The stage order resolver

Adds a pure module that turns a layer's claimed and declared
stages into one ordered list, with every construction check.
Nothing calls it yet; Step 2 wires it into the pipeline and
render folds.

Decisions: [Q2, Q5, Q6, Q8, Q9, Q10, Checks](../../plan.md)

## Do

New file, no signals, no Angular:

```ts
export interface LabelledStageRule<TTransform> {
  readonly label: string;
  readonly rule: StageRule<TTransform>;
}
export interface ResolvedStage<TTransform> {
  readonly name: string;
  readonly run: TTransform;
}
export function resolveStageOrder<TTransform>(
  layer: 'pipeline' | 'render',
  rules: readonly LabelledStageRule<TTransform>[],
): readonly ResolvedStage<TTransform>[];

// engine/pipeline.ts
export const PIPELINE_ANCHOR_ELIGIBLE = ['filter', 'sort'] as const;
```

The resolver reads the layer's built-in order (`PIPELINE_ANCHORS`
/ `RENDER_ANCHORS`) and its anchor-eligible set. On the pipeline
layer that set is `PIPELINE_ANCHOR_ELIGIBLE`; on the render layer
every name in `RENDER_ANCHORS` is eligible, and so is every
declared name on either layer.

Claims fill built-in slots. An unclaimed built-in is left out of
the output, but it still bounds its own gaps and stays a valid
anchor for a declared stage.

Placement is a gap, not a bare edge (Q9). `after X` places a
stage between built-in X and the next built-in. `before X`
places it between the previous built-in and X. A declared stage
may anchor on another declared stage.

## Watch out

- Write each construction check as its own function, with the
  `ngDevMode` gate inside its body — the pattern at
  `engine/columns.ts:34`. Prefix every thrown message with
  `[createTable]`, and name both features involved.
- Checks: unknown anchor; not anchor-eligible (pipeline `'group'`
  gets its own message, never "unknown anchor" — Q5); cycle;
  duplicate declared name, including a name equal to a built-in;
  ambiguous tie — any two declared stages whose relative order
  the graph doesn't fix (Q6), message says "anchor one on the
  other"; `synthesizesRows: true` whose final position sits
  before render `'group'`'s slot, checked by position so it
  fires even when `'group'` is unclaimed.
- With the dev gate off: a tie orders by stage name (Q2); an
  offending declared stage (unknown or not-eligible anchor,
  cycle) is dropped and never hangs the resolver; a duplicate
  declared name keeps the later declaration (Q10); a duplicate
  claim of a built-in keeps the later claim (Q8).
- Duplicate _claims_ of a built-in are thrown by `SlotRegistry`,
  not here. The resolver only needs last-claim-wins for the
  gate-off case, and that path is tested in Step 3.
- Update the `ng-dev-mode.testing.ts` header comment to list
  `stage-order.ts` among the files reading `ngDevMode`.
- Export nothing from `index.ts` yet.

## Out of scope

- Wiring the resolver into `core.ts`/`compose-table.ts` (Step 2).
- The `SlotRegistry` dev-only gate (Step 3).
- Typing declared names to the registries (Step 4).

## Done when

- [ ] Every declared-stage check lives in its own gated
      function.
- [ ] `stage-order.spec.ts` covers the three tables in
      [step-1-stage-order-resolver.test-plan.md](step-1-stage-order-resolver.test-plan.md).

---

[Step 2: Run the resolved order](step-2-run-resolved-order.plan.md) →
