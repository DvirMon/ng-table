import type { RenderRow } from '../api/types';

/**
 * Fixed execution order for the render layer, independent of `features` array order. This
 * array is the single source of truth — `RenderStages` is derived from it, so adding a stage
 * is a one-line edit here.
 */
export const RENDER_ORDER = ['group', 'tree', 'paginate'] as const;

export type RenderStage = (typeof RENDER_ORDER)[number];

export type RenderRowTransform<TRow> = (
  rows: Omit<RenderRow<TRow>, 'index'>[]
) => Omit<RenderRow<TRow>, 'index'>[];

/**
 * The render-row transforms a feature may **declare** via `TableFeatureSpec.renderStages`. Two
 * features declaring the same stage is a composition error — see `SlotRegistry`.
 * Not part of the public `TableStore<TRow>` contract — internal wiring only.
 */
export type RenderStages<TRow> = Partial<Record<RenderStage, RenderRowTransform<TRow>>>;

/** Folds render rows through whichever stages are registered, always in `RENDER_ORDER`. */
export function runRenderStages<TRow>(
  rows: Omit<RenderRow<TRow>, 'index'>[],
  stages: RenderStages<TRow>
): Omit<RenderRow<TRow>, 'index'>[] {
  return RENDER_ORDER.reduce(
    (current, stage) => stages[stage]?.(current) ?? current,
    rows
  );
}
