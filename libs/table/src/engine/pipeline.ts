import type { ResolvedStage } from './stage-order';

/**
 * Fixed execution order, independent of the `features` array order. This array is the single
 * source of truth: `PipelineStage` is derived from `PipelineStageRegistry`, so a stage that
 * exists in the type is guaranteed to be executed, and adding one is a one-line edit here.
 */
export const PIPELINE_ANCHORS = ['filter', 'group', 'sort'] as const;

/**
 * The claimable pipeline stage keys. A team extends this via declaration merging when it
 * needs to author a new stage; `PipelineStage` reads straight off it.
 */
export interface PipelineStageRegistry {
  filter: true;
  group: true;
  sort: true;
}

export type PipelineStage = keyof PipelineStageRegistry & string;

/**
 * Built-in pipeline anchors a declared stage may anchor on. `'group'` is deliberately absent —
 * a declared stage anchoring on it gets its own "not anchor-eligible" message, never treated as
 * an unknown anchor. See `engine/stage-order.ts`.
 */
export const PIPELINE_ANCHOR_ELIGIBLE = ['filter', 'sort'] as const;

export type RowTransform<TRow> = (rows: TRow[]) => TRow[];

/** Folds rows through the resolved stage order — `resolveStageOrder` already fixed both the
 *  built-in anchor positions and any declared stage's slot; this just runs the list. */
export function runPipeline<TRow>(
  rows: TRow[],
  stages: readonly ResolvedStage<RowTransform<TRow>>[]
): TRow[] {
  return stages.reduce((current, stage) => stage.run(current), rows);
}
