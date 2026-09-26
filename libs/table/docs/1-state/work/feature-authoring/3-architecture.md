# Architecture — open stage registration (#102)

Consumed by `/to-issues` and `/to-tasks`. Grounded against `libs/table/src` on 2026-09-26.
Spec: [`2-spec.md`](2-spec.md). Decisions: [`plan.md`](plan.md). Contract: ADR-0020.

## Settled — not open for relitigation

- M6: anchors + mergeable interface registry; DI override deferred (plan.md Decision, Q4).
- One rule `stage`, recording-form `stageSchema` (ADR-0027 Rule 2); object form removed.
- Anchors — pipeline `filter`, `sort`; render `group`, `tree`. Pipeline `expand` removed.
  No post-flatten anchor (Q1).
- Ambiguous tie throws in dev with an edge-fix hint; name-sort is the production fallback
  only (Q2).
- Construction checks dev-only, gated in their own body (ADR-0014 amendment). Runtime id
  checks degrade + report in production, once per stage per evaluation.
- `synthesizesRows` is the only declarable; `rowCount` and `preservesEmissionOrder` dropped.
- Test seams: `composeTable`/`composeFeatures`, pure `resolveStageOrder`, `*.types.spec.ts`
  (confirmed 2026-09-26).

## Current source (what changes)

| Today | File | Becomes |
|---|---|---|
| `PIPELINE_ORDER = ['filter','group','sort','expand']`; `PipelineStage` derived; `PipelineStages<TRow> = Partial<Record<…>>`; `runPipeline` reduces over the const | `engine/pipeline.ts` | `PIPELINE_ANCHORS` (no `expand`) + `interface PipelineStageRegistry`; `runPipeline(rows, ordered)` over a resolved list |
| `RENDER_ORDER = ['group','tree']`; `RenderStages<TRow>` object; `runRenderStages` reduces over the const | `engine/render-stages.ts` | `RENDER_ANCHORS` + `interface RenderStageRegistry`; runs a resolved list; hosts runtime checks 1–2 |
| `TableFeatureSpec.stages?: PipelineStages<TRow>`, `.renderStages?: RenderStages<TRow>` | `engine/types.ts:74,81` | Both typed as the recorded stage schema |
| `foldFeatures` loops `PIPELINE_ORDER`/`RENDER_ORDER`, `registry.claimStage`, writes `handle.stages[stage]` | `engine/compose-table.ts:94-114` | Collects recorded rules per layer; resolves once after the loop; hands the ordered list to the core handle |
| `claimInnerStages`/`claimInnerRenderStages` loop the const arrays | `api/features/compose-features.ts:21-60,79-135` | Collect + forward inner rules; claims still labelled `composeFeatures inner feature N` |
| `SlotRegistry` maps keyed by `PipelineStage`/`RenderStage` | `engine/slots.ts:59-98` | Keyed by registry keys; declared-name duplicates also claim here |
| `stages`/`renderStages` closure objects; `rows = computed(() => runPipeline(data(), stages))`; `runRenderStages(seed, renderStages)` | `engine/core.ts:26-27,52-59,101` | Holds resolved ordered lists instead |
| `runRecordedSchema(buildPath, fn)` | `schema/run.ts` | Unchanged; `stageSchema` is its third caller |
| `createPathProxy`, `createRecorderSession`, `RecordedHandle` | `schema/path-proxy.ts` | Unchanged; stage handles implement `RecordedHandle` |
| `PIPELINE_BEHAVIOR_KEYS` | `api/create-table-feature.ts:62` | Unchanged |
| `withSorting` `stages: { sort }` | `api/features/with-sorting/feature.ts:311` | `stageSchema((s) => stage(s.sort, { run }))` |
| `withFiltering` `stages: { filter }` | `api/features/with-filtering/feature.ts:91` | `stage(s.filter, …)` |
| `withGrouping` `stages: { group }`, `renderStages: { group }` | `api/features/with-grouping/feature.ts:221-224` | `stage(s.group, …)` both layers; render one `synthesizesRows: true` |
| `withTree` `renderStages: config.childrenAccessor ? { tree } : …` | `api/features/with-tree.ts:255` | `stage(s.tree, …)`, still conditional on `childrenAccessor` |
| Barrel exports none of `engine/` | `src/index.ts` | Adds the feature-author surface (spec § Exports) |

The grouping render stage self-checks its input today (`engine/grouping/render.ts:184`,
"stage must run first in RENDER_ORDER") — keep the check, reword the message to the
anchor vocabulary.

Runtime reporting precedent: `console.error` with a `[createTable]`-style prefix
(`engine/cells.ts:8`, `api/features/with-tree.ts:53` `reportCallbackError`). Dedupe once
per stage per evaluation, as `engine/grouping/render.ts:62` dedupes per column.

## Types and contracts

Shapes, not final code:

```ts
// engine/pipeline.ts
export const PIPELINE_ANCHORS = ['filter', 'group', 'sort'] as const;
export interface PipelineStageRegistry { filter: true; group: true; sort: true }
export type PipelineStage = keyof PipelineStageRegistry & string;
export type RowTransform<TRow> = (rows: TRow[]) => TRow[];

// engine/render-stages.ts
export const RENDER_ANCHORS = ['group', 'tree'] as const;
export interface RenderStageRegistry { group: true; tree: true }
export type RenderStage = keyof RenderStageRegistry & string;

// schema/stage-rules.ts — one rule, two forms
type StageRule<TTransform> =
  | { anchor: string; run: TTransform }                                  // claim
  | { anchor: string; name: string; placement: 'before' | 'after';
      synthesizesRows?: boolean; run: TTransform };                      // declare

// engine/stage-order.ts — pure, no signals
export function resolveStageOrder<TTransform>(
  anchors: readonly string[],
  rules: readonly LabelledStageRule<TTransform>[],   // rule + owning feature label
): readonly { name: string; run: TTransform }[];
```

A declared stage that later becomes an anchor (`s.pin`) is the same handle kind as a
built-in one; the proxy fabricates any key, the registry interface is what makes a key
type-legal.

## File layout

| File | Status | Phase | Contents |
|---|---|---|---|
| `schema/stage-schema.ts` | new | declare | `stageSchema(fn)` over `runRecordedSchema()`; typed handle proxy per layer |
| `schema/stage-rules.ts` | new | declare | `stage(handle, opts)` — claim and declare forms |
| `engine/stage-order.ts` | new | compile | `resolveStageOrder()`; each dev throw in its own gated function; name-sort tie fallback |
| `engine/stage-order.spec.ts` | new | test | Seam 2 — full order/throw matrix |
| `engine/pipeline.ts` | edit | run | Anchors + registry; run resolved list; `expand` gone |
| `engine/render-stages.ts` | edit | run | Anchors + registry; resolved list; runtime checks 1–2 |
| `engine/types.ts` | edit | — | `TableFeatureSpec.stages/renderStages` → recorded schema |
| `engine/slots.ts` | edit | — | Widen keys; declared-name claims |
| `engine/core.ts` | edit | run | Hold resolved lists |
| `engine/compose-table.ts` | edit | compose | Collect rules, resolve after fold |
| `api/features/compose-features.ts` | edit | compose | Forward inner rules |
| `api/features/with-{sorting,filtering,grouping}/feature.ts`, `with-tree.ts` | edit | declare | Rule form |
| `engine/compose-table.spec.ts`, `api/features/compose-features.spec.ts` | edit | test | Seam 1 |
| a `*.types.spec.ts` beside `stage-schema.ts` | new | test | Seam 3 |
| `src/index.ts` | edit | — | Feature-author exports |
| `libs/table/CLAUDE.md` | edit | docs | File table, "Rules" bullets, `schema/run.ts` row, engine-export line |
| `docs/adr/0011-*.md`, `docs/adr/0004-*.md` | edit | docs | Adding ≠ reordering; `*_ORDER` rule restated |
| `docs/1-state/architecture.md` | edit | docs | Register the effort |
| `docs/1-state/feature-authoring.md` | new | docs | Guide, `withRowPinning` worked example |

## Dependency notes for slicing

- Exports (barrel) are independent of the engine work except for the new stage symbols.
- Compile probe gates only the registry typing (literal vs `string` names); the resolver,
  runtime checks and refactor do not depend on its outcome.
- The four feature refactors depend on `stageSchema`/`stage` + the new `TableFeatureSpec`
  typing, and must land in the same change as the object form's removal — the object form
  is not kept alongside.
- The guide depends on exports + engine.

## Open questions

- **Compile probe** (ADR-0020's remaining open item): does declaration merging on the
  registries survive `ngc` + barrel + `tools/generate-overloads.ts`? Fallback: `name: string`.
- **Anchoring on pipeline `'group'`.** Plan and ADR list pipeline anchors as `filter`,
  `sort` and call `'group'` fixed, while `withGrouping` still claims `s.group`. Not
  settled: does declaring a stage relative to `s.group` throw (and under which check —
  unknown anchor is the wrong message), or is it allowed? Settle before the resolver's
  anchor-validation slice.
- **Duplicate claim vs. existing message.** Today's `SlotRegistry` collision always throws,
  ungated. The new construction checks are dev-only. Decide whether a duplicate built-in
  claim moves to dev-only with the rest or keeps today's ungated throw.
