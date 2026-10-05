# Step 4 test plan — Declared-name typing

Step: [step-4-declared-name-typing.plan.md](step-4-declared-name-typing.plan.md)
Spec file: `libs/table/src/schema/stage-schema.types.spec.ts`

## Stubs (red phase)

None. The step creates no runtime symbol. It only changes these existing types:

- `StageHandle<TRow, TTransform, TName extends string = string>` in `schema/stage-schema.ts`. `StagePath` maps each anchor `K in TAnchor` to `StageHandle<TRow, TTransform, TAnchor>`.
- `StageDeclareOpts<TTransform, TName extends string = string>` in `schema/stage-rules.ts`, with `readonly name: TName`.
- `stage<TRow, TTransform, TName extends string>(handle: StageHandle<TRow, TTransform, TName>, opts: StageClaimOpts<…> | StageDeclareOpts<TTransform, NoInfer<TName>>)`. The repo is on TS 6.0.3, so `NoInfer` is available.

## Seams — in red-green order

Seams: none at runtime. The step is types only, and `stage()`'s recorded rule is identical before and after. Every assertion is compile-time, lives in the Types phase below, and is enforced only by `nx run shared-table:typecheck-spec`. `nx test` runs these without typechecking them, so a green run proves nothing. This step keeps test-after-code ordering.

Optional red check: write the spec before editing the types, then run `typecheck-spec`. C and E should fail as unused `@ts-expect-error`; A, B and D should already pass.

## Types phase (after green)

File setup, same shape as `engine/render-stages.types.spec.ts`: a `typecheckOnly()` wrapper, `type Row = { id: string }`, and module-level augmentations at the top of the file:

- `declare module '../engine/render-stages' { interface RenderStageRegistry { pin: true } }`
- `declare module '../engine/pipeline' { interface PipelineStageRegistry { audit: true } }`
  These merges are visible to the whole spec program; step 2's runtime fixtures (`pin`, `audit`) typecheck because of them. `engine/pipeline.types.spec.ts` is updated to expect `'filter' | 'group' | 'sort' | 'audit'`. Never merge `pin` into the pipeline registry.

Each `@ts-expect-error` goes on the exact offending line — the property access, or the `name:` line inside the opts literal — never above the whole `stage(...)` call.

A. Unknown anchor on the path is rejected (base case)

- Check: inside `stageSchema('render', (s) => …)`, `// @ts-expect-error` on `s.tre`.
- Why: carrying a third type parameter through `StagePath` could widen the mapped type (e.g. to `Record<string, …>`), letting a typo'd anchor compile.
- Order reason: independent; the regression guard.

B. A merged key appears on the render path

- Check: `s.pin` compiles, and `expectTypeOf(s.pin).toEqualTypeOf<StageHandle<Row, RenderNodeTransform<Row>, 'group' | 'tree' | 'pin'>>()`.
- Why: pins that the handle carries the layer's merged key union, not the single anchor `K` and not `string`. C and E depend on this.
- Order reason: builds on A.

C. A declared name outside the registry is rejected

- Check: `stage(s.tree, { name: 'pinn', placement: 'after', run: (n) => n })`, `@ts-expect-error` on the `name:` line.
- Why: the core seam. Catches `name` left as `string`, and `TName` inferred from `opts` as well as the handle (the bug `NoInfer` prevents).
- Order reason: builds on B.

D. A declared name inside the merged registry compiles

- Check: the same call with `name: 'pin'` compiles, no directive.
- Why: catches over-narrowing (name typed to the handle's own anchor or to built-ins only); step 2's fixtures would then fail `typecheck-spec`.
- Order reason: builds on C.

E. The pipeline layer does not see render-registry keys

- Check: inside `stageSchema('pipeline', (s) => …)`, `stage(s.sort, { name: 'pin', placement: 'after', run: (r) => r })`, `@ts-expect-error` on the `name:` line.
- Why: catches a handle carrying the union of both registries, or `RenderStage` on both overloads. Meaningful because `pin` is merged into the render registry only.
- Order reason: builds on D.

## Not tested

- The recorded `StageRule` shape — no runtime change; step 2's runtime specs cover it.
- The claim form `stage(s.tree, { run })` still compiling — every `with-*` feature and compose spec already exercises it through `typecheck-spec`.
- A declared `name` equal to a built-in (`name: 'tree'`) compiles by design; the collision is a construction-time runtime throw (step 1).
- A merge through the published `@ngp/table` barrel — verified by #153 (ADR-0020 Decision 3).

## Resolved questions

- The merges live at the top of this file, with a one-line pointer comment in step 2's fixtures.
- `StageHandle`'s new parameter is trailing `TName extends string = string`.
