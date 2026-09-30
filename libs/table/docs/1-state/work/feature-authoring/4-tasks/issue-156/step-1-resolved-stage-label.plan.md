---
step: 1
type: code
commit: ref
depends_on: []
files:
  - libs/table/src/engine/stage-order.ts
  - libs/table/src/engine/stage-order.spec.ts
  - libs/table/src/engine/pipeline.spec.ts
  - libs/table/src/engine/render-stages.spec.ts
---
# Step 1 — Carry the feature label on resolved stages

Adds a `label` field to `ResolvedStage` so the runtime checks in
Step 2 can name the feature that produced an offending row.
Nothing reads the field yet.

Decisions: [Checks](../../plan.md)

## Do

```ts
export interface ResolvedStage<TTransform> {
  readonly name: string;
  readonly label: string;
  readonly run: TTransform;
}
```

In `resolveStageOrder`, the claims map stores `{ label, run }`
instead of a bare `run`. `assemble` emits `label` for both claims
and declares.

Existing `ResolvedStage` literals get `label: 'test'`:
`pipeline.spec.ts` (lines ~10-12, 22-23, 39-40) and
`render-stages.spec.ts` (lines ~23-24, 34-35, 52-53, 71, 91).

## Watch out

- `label` stays required, not optional. Step 2's reports name it.
- Last-claim-wins stays as is. The label travels with its run in
  the same map entry.

## Out of scope

- Using the label anywhere. That's Step 2.
- `SlotRegistry` duplicate-claim behaviour.

## Done when

- [ ] A resolved claim and a resolved declare each carry their
      owning feature's label.
- [ ] `pipeline.spec.ts` and `render-stages.spec.ts` compile with
      the new field.

---
[Step 2: Runtime row-id checks on render stages](step-2-runtime-row-id-checks.plan.md) →
