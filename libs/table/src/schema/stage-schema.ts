import type { PipelineStage, RowTransform } from '../engine/pipeline';
import type { RenderNodeTransform, RenderStage } from '../engine/render-stages';
import { createPathProxy, PATH_RECORDER, type PathRecorder } from './path-proxy';
import { runRecordedSchema } from './run';
import type { StageRule } from './stage-rules';

/**
 * Handle fabricated by a stage path's `get` trap for one anchor — carries the recorder
 * `stage()` writes into. Same `RecordedHandle` shape as `ColumnHandle`/`GroupingHandle`
 * (`schema/path-proxy.ts`), recording `StageRule` instead.
 */
export interface StageHandle<TRow, TTransform> {
  readonly id: string;
  /** @internal */
  readonly [PATH_RECORDER]: PathRecorder<TRow, StageRule<TTransform>>;
}

/**
 * Structural `path` proxy for a stage schema fn. `TAnchor` is the layer's own anchor
 * literal union (`PipelineStage` or `RenderStage`), so a property access on an unknown
 * anchor name is a compile error; a known anchor fabricates its `StageHandle`.
 */
export type StagePath<TRow, TTransform, TAnchor extends string> = {
  readonly [K in TAnchor]: StageHandle<TRow, TTransform>;
};

function buildStagePath<TRow, TTransform, TAnchor extends string>(
  recorder: PathRecorder<TRow, StageRule<TTransform>>
): StagePath<TRow, TTransform, TAnchor> {
  return createPathProxy(
    (id): StageHandle<TRow, TTransform> => ({ id, [PATH_RECORDER]: recorder })
  ) as StagePath<TRow, TTransform, TAnchor>;
}

/**
 * Runs a stage schema fn once, synchronously, through a fresh recorder session and returns
 * the `stage()` rules it recorded. `layer` fixes which anchor set and transform shape the
 * path is typed against — pipeline stages transform rows, render stages transform render
 * nodes — resolved by the two overloads below, keyed on the literal.
 *
 * @remarks
 * Resolving or executing a declared stage (`name` + `placement`) is issue #155's concern;
 * this only records what a schema fn declared.
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
