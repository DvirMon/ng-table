import type { PipelineStage, RowTransform } from '../engine/pipeline';
import type { RenderNodeTransform, RenderStage } from '../engine/render-stages';
import { createPathProxy, PATH_RECORDER, type PathRecorder } from './path-proxy';
import { runRecordedSchema } from './run';
import type { StageRule } from './stage-rules';

/** One anchor reached through a `StagePath`; `stage()` records its rule against this handle. */
export interface StageHandle<TRow, TTransform, TName extends string = string> {
  readonly id: string;
  /** @internal */
  readonly [PATH_RECORDER]: PathRecorder<TRow, StageRule<TTransform>>;
}

/**
 * The `path` a `stageSchema()` callback receives: one `StageHandle` per registry key of the
 * layer, so an unknown anchor is a compile error. Each handle carries the full key union,
 * which `stage()` checks a declared `name` against.
 */
export type StagePath<TRow, TTransform, TAnchor extends string> = {
  readonly [K in TAnchor]: StageHandle<TRow, TTransform, TAnchor>;
};

function buildStagePath<TRow, TTransform, TAnchor extends string>(
  recorder: PathRecorder<TRow, StageRule<TTransform>>
): StagePath<TRow, TTransform, TAnchor> {
  return createPathProxy(
    (id): StageHandle<TRow, TTransform, TAnchor> => ({ id, [PATH_RECORDER]: recorder })
  ) as StagePath<TRow, TTransform, TAnchor>;
}

/**
 * Records the `stage()` calls a feature makes for one layer and returns them as rules.
 *
 * @remarks
 * Runs `fn` once, synchronously. `'pipeline'` stages transform rows; `'render'` stages
 * transform `RenderNode`s.
 *
 * @example
 * stages: stageSchema('pipeline', (s) => {
 *   stage(s.sort, { run: (rows) => [...rows].reverse() });
 * }),
 */
export function stageSchema<TRow>(
  layer: 'pipeline',
  fn: (path: StagePath<TRow, RowTransform<TRow>, PipelineStage>) => void
): readonly StageRule<RowTransform<TRow>>[];
export function stageSchema<TRow>(
  layer: 'render',
  fn: (path: StagePath<TRow, RenderNodeTransform<TRow>, RenderStage>) => void
): readonly StageRule<RenderNodeTransform<TRow>>[];
export function stageSchema<TRow, TAnchor extends string = string, TTransform = unknown>(
  _layer: 'pipeline' | 'render',
  fn: (path: StagePath<TRow, TTransform, TAnchor>) => void
): readonly StageRule<TTransform>[] {
  return runRecordedSchema<TRow, StageRule<TTransform>, StagePath<TRow, TTransform, TAnchor>>(
    (recorder) => buildStagePath<TRow, TTransform, TAnchor>(recorder),
    fn
  );
}
