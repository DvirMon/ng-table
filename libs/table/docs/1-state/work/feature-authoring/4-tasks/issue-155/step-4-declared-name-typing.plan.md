---
step: 4
type: code
commit: feat
depends_on: [2]
files:
  - libs/table/src/schema/stage-schema.ts
  - libs/table/src/schema/stage-rules.ts
  - libs/table/src/schema/stage-schema.types.spec.ts (new)
  - libs/table/src/engine/pipeline.types.spec.ts
---
# Step 4 — Declared names typed to the registries

Types a declared stage's `name` to the layer's own registry
keys, so an unmerged name is a compile error.

Decisions: [Q7](../../plan.md)

## Do

```ts
export interface StageHandle<TRow, TTransform, TName extends string = string> { … }
export interface StageDeclareOpts<TTransform, TName extends string = string> {
  readonly name: TName; …
}
export function stage<TRow, TTransform, TName extends string>(
  handle: StageHandle<TRow, TTransform, TName>,
  opts: StageClaimOpts<TTransform>
    | StageDeclareOpts<TTransform, NoInfer<TName>>,
): void;
```

`StagePath` maps each key to a handle carrying the layer's full
key union.

## Watch out

- The types spec opens with two `declare module` merges:
  `RenderStageRegistry { pin: true }` and
  `PipelineStageRegistry { audit: true }`. Step 2's fixtures
  typecheck because of these. Add a one-line comment in those
  fixtures pointing here.
- `pipeline.types.spec.ts` now expects
  `'filter' | 'group' | 'sort' | 'audit'`.
- Never merge `pin` into the pipeline registry — keep
  `render-stages.types.spec.ts`'s rejected name `'pinned'`.
- Put each `@ts-expect-error` on the exact offending line.
- Remove the "#155's concern" remarks in `stage-rules.ts` and
  `stage-schema.ts`.

## Out of scope

- Runtime behaviour.

## Done when

- [ ] `nx run shared-table:typecheck-spec` is the enforcing
      check for `stage-schema.types.spec.ts` — the only gate for
      this types-only step, per
      [step-4-declared-name-typing.test-plan.md](step-4-declared-name-typing.test-plan.md).

---
← [Step 2: Run the resolved order](step-2-run-resolved-order.plan.md) | [Step 5: Drop stale #155 notes](step-5-drop-stale-155-notes.plan.md) →
