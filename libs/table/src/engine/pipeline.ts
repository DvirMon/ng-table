/**
 * Fixed execution order, independent of the `features` array order. This array is the single
 * source of truth: `PipelineStages` is derived from it, so a stage that exists in the type is
 * guaranteed to be executed, and adding one is a one-line edit here.
 */
export const PIPELINE_ORDER = ['filter', 'group', 'sort', 'expand'] as const;

export type PipelineStage = (typeof PIPELINE_ORDER)[number];

export type RowTransform<TRow> = (rows: TRow[]) => TRow[];

/**
 * The row transforms a feature may **declare** via `TableFeatureSpec.stages`. Two features
 * declaring the same stage is a composition error — see `SlotRegistry`.
 * Not part of the public `TableStore<TRow>` contract — internal wiring only.
 */
export type PipelineStages<TRow> = Partial<Record<PipelineStage, RowTransform<TRow>>>;

/** Folds rows through whichever stages are registered, always in `PIPELINE_ORDER`. */
export function runPipeline<TRow>(
  rows: TRow[],
  stages: PipelineStages<TRow>
): TRow[] {
  return PIPELINE_ORDER.reduce(
    (current, stage) => stages[stage]?.(current) ?? current,
    rows
  );
}
