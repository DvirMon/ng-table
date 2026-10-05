import type { ResolvedStage } from './stage-order';
import type { StageContext } from './types';

/** Built-in pipeline anchors in execution order, fixed regardless of feature argument order. */
export const PIPELINE_ANCHORS = ['filter', 'group', 'sort'] as const;

/**
 * Pipeline stage names a feature may claim or declare; extend it via `declare module` merging
 * to author a new stage.
 */
export interface PipelineStageRegistry {
  filter: true;
  group: true;
  sort: true;
}

export type PipelineStage = keyof PipelineStageRegistry & string;

/**
 * Built-in pipeline anchors a declared stage may anchor on. `'group'` is excluded: anchoring on
 * it throws "not anchor-eligible", not "unknown anchor".
 */
export const PIPELINE_ANCHOR_ELIGIBLE = ['filter', 'sort'] as const;

export type RowTransform<TRow> = (rows: TRow[], ctx: StageContext<TRow>) => TRow[];

/** Runs rows through each stage in the order `resolveStageOrder` produced. */
export function runPipeline<TRow>(
  rows: TRow[],
  stages: readonly ResolvedStage<RowTransform<TRow>>[],
  ctx: StageContext<TRow>,
): TRow[] {
  return stages.reduce((current, stage) => stage.run(current, ctx), rows);
}
