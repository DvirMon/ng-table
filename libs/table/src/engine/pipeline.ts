/**
 * Fixed execution order, independent of the `features` array order. This array is the single
 * source of truth: `PipelineStages` is derived from `PipelineStageRegistry`, so a stage that
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

/**
 * The row transforms a feature may **declare** via `TableFeatureSpec.stages`. Two features
 * declaring the same stage is a composition error — see `SlotRegistry`.
 * Not part of the public `TableStore<TRow>` contract — internal wiring only.
 */
export type PipelineStages<TRow> = Partial<Record<PipelineStage, RowTransform<TRow>>>;

/** Folds rows through whichever stages are registered, always in `PIPELINE_ANCHORS`. */
export function runPipeline<TRow>(
  rows: TRow[],
  stages: PipelineStages<TRow>
): TRow[] {
  return PIPELINE_ANCHORS.reduce(
    (current, stage) => stages[stage]?.(current) ?? current,
    rows
  );
}
