# Step 1 test plan — Stage context through both runners

Step: [step-1-stage-context.plan.md](step-1-stage-context.plan.md)
Spec file: `libs/table/src/engine/pipeline.spec.ts`
and `libs/table/src/engine/render-stages.spec.ts`
(types phase: the matching `*.types.spec.ts` beside each)

## Stubs (red phase)

Signature-only changes; bodies stay as they are (NOT throwing). `runPipeline` and `runRenderStages` sit on the live path of every `composeTable` / `createTable` spec, so a throwing body would turn the whole suite red, not just the two new tests. Keeping the old body makes each new test fail on its assertion (the stage receives `undefined` as `ctx`).

- `export type StageContext<TRow> = { readonly parentOf?: (row: TRow) => RowId | null }` in `engine/types.ts`, re-exported from `src/index.ts`
- `export type RowTransform<TRow> = (rows: TRow[], ctx: StageContext<TRow>) => TRow[]` (`engine/pipeline.ts`)
- `export type RenderNodeTransform<TRow> = (nodes: readonly RenderNode<TRow>[], ctx: StageContext<TRow>) => readonly RenderNode<TRow>[]` (`engine/render-stages.ts`)
- `runPipeline<TRow>(rows: TRow[], stages: readonly ResolvedStage<RowTransform<TRow>>[], ctx: StageContext<TRow>): TRow[]` — body unchanged (`stage.run(current)`)
- `runRenderStages<TRow>(nodes: readonly RenderNode<TRow>[], stages: readonly ResolvedStage<RenderNodeTransform<TRow>>[], ctx: StageContext<TRow>): readonly RenderNode<TRow>[]` — body unchanged
- `engine/core.ts` passes `{}` at both call sites so the spec config still compiles.

## Seams — in red-green order

### A. runPipeline(rows, [s1, s2], ctx) → s1 and s2 each receive that same ctx

- Test: `it('hands the same context to every pipeline stage')`
- Asserts: two stages, each pushes its second argument into `seen`; called with a sentinel `ctx = { parentOf: () => null }`; `expect(seen).toHaveLength(2)`, `expect(seen[0]).toBe(ctx)`, `expect(seen[1]).toBe(ctx)`.
- Why this seam: catches a runner that forwards nothing (the current `stage.run(current)` body), and — with two stages — one that hands ctx only to the first stage or builds a fresh object per stage. Later steps rely on the second stage reading the one engine-resolved `parentOf`.
- Order reason: independent.

### B. runRenderStages(nodes, [s1, s2], ctx) → s1 and s2 each receive that same ctx

- Test: `it('hands the same context to every render stage')`
- Asserts: same shape as A, using the existing `node()` helper and `ResolvedStage<RenderNodeTransform<Row>>[]` with `'group'` and `'tree'`; `seen` has length 2, both entries `toBe(ctx)`.
- Why this seam: a separate runner with its own `reduce` — the same bug can land here while A passes. `withTree()`'s flat nesting stage (a later issue) is a render stage and is the primary consumer of `ctx.parentOf`.
- Order reason: independent; mirrors A, so do it second and copy A's shape.

## Types phase (after green)

- `pipeline.types.spec.ts`: `expectTypeOf<Parameters<RowTransform<Row>>[1]>().toEqualTypeOf<StageContext<Row>>()` — pins that `TRow` flows into ctx; catches the ctx parameter being typed `StageContext<unknown>` / `any`, which would make `parentOf(row)` lose its row type in every stage.
- `render-stages.types.spec.ts`: `expectTypeOf<Parameters<RenderNodeTransform<Row>>[1]>().toEqualTypeOf<StageContext<Row>>()` — same pin for render stages, where `TRow` is the row data, not the node (`parentOf` takes a `TRow`, never a `RenderNode`).
- `pipeline.types.spec.ts`, inside the file's `typecheckOnly` pattern: `const oneArg: RowTransform<Row> = (rows) => rows;` — pins the additive guarantee (a one-argument stage still type-checks) in the domain that owns the type. No `toExtend`/`toMatchTypeOf` usage exists in the lib; a typed const, not a new matcher.

## Not tested

- `core.ts` passing `{}` — a fixed value with no logic; a compose-level test would only assert `ctx toEqual {}` (tautological). The value is a placeholder replaced when `parentOf` resolution lands.
- The `StageContext` shape (`readonly parentOf?`) — a type-level equality against its own declaration can never disagree with the code (tautological).
- The `StageContext` re-export from `src/index.ts` — type-only re-export, no logic; `typecheck-spec` catches a broken path.
- "Existing one-argument stage lambdas keep compiling" at the call sites — already covered: existing specs use one-argument lambdas typed against the new types (`taggingStage`, `pinningStage`, `groupWrappingStage` in `compose-table.spec.ts`; `withGroupRow` in `core.spec.ts`). `nx run shared-table:typecheck-spec` is the test; the types phase adds one explicit pin.
- "A declared stage receives ctx" as its own case — the runners only see a `ResolvedStage[]`; declared stages and anchor claims go through the same `reduce`, so A/B cover both. The existing #155 `declared stages` block in `compose-table.spec.ts` already proves declared stages reach the runner.
- ctx with an empty stage list — nothing receives it; existing pass-through tests cover the return value.
- The spec's seam 1 (the `createTable()` public store) — this step adds nothing a consumer can observe; it is an internal engine refactor, so the runner unit specs are the right seam. Store-level cases start with the steps that populate `parentOf`.

## Resolved

- `ctx` is required on both runners (no default). The 7 existing two-argument runner calls in `pipeline.spec.ts` (3) and `render-stages.spec.ts` (4) pass `{}`. Approved 2026-09-27.
