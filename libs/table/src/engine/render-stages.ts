import type { RenderRow, RowId } from '../api/types';

/**
 * Fixed render-layer execution order, independent of `features` array order — `RenderStages`
 * derives from it. `'prune'` runs after every claimable stage and before `'paginate'`. See
 * ADR-0017.
 */
export const RENDER_ORDER = ['group', 'tree', 'prune', 'paginate'] as const;

export type RenderStage = (typeof RENDER_ORDER)[number];

/** A render row mid-chain: `index` and `cells` are both stamped centrally in `engine/core.ts`
 * after the whole chain runs, so a stage never sees or sets either. */
export type StagedRow<TRow> = Omit<RenderRow<TRow>, 'index' | 'cells'>;

export type RenderRowTransform<TRow> = (rows: StagedRow<TRow>[]) => StagedRow<TRow>[];

/**
 * The render-row transforms a feature may **declare** via `TableFeatureSpec.renderStages`. Two
 * features declaring the same stage is a composition error — see `SlotRegistry`. `'prune'` is
 * excluded — it is engine-owned (ADR-0017), so declaring `renderStages.prune` is a compile
 * error rather than a runtime collision.
 * Not part of the public `TableStore<TRow>` contract — internal wiring only.
 */
export type RenderStages<TRow> = Partial<
  Record<Exclude<RenderStage, 'prune'>, RenderRowTransform<TRow>>
>;

/** `RENDER_ORDER` minus `'prune'` — derived, not hand-maintained, so a walk over a
 * `RenderStages<TRow>` (e.g. `compose-table.ts`'s fold) has a matching key set to iterate.
 * `'prune'` is not a valid key of `RenderStages` and must never be added here. */
export const CLAIMABLE_RENDER_STAGES = RENDER_ORDER.filter(
  (stage): stage is Exclude<RenderStage, 'prune'> => stage !== 'prune'
);

// `expanded === undefined` means no feature contributed the slot at all — a pure no-op. A
// *defined but empty* set means a feature contributed and nothing is currently expanded, so
// every nested row is hidden; these two states are never conflated into one `size === 0` check.
//
// Single forward pass with one `hidden` accumulator — correct only because both synthesizing
// stages emit a parent immediately before its descendants. A future stage inserted between
// `'tree'` and `'prune'` that breaks parent-before-child emission breaks this silently. See
// ADR-0017.
function pruneUnexpandedDescendants<TRow>(
  rows: StagedRow<TRow>[],
  expanded: ReadonlySet<RowId> | undefined
): StagedRow<TRow>[] {
  if (expanded === undefined) {
    return rows;
  }
  const hidden = new Set<RowId>();
  return rows.filter((row) => {
    const hasHiddenParent =
      row.parentId !== undefined &&
      (hidden.has(row.parentId) || !expanded.has(row.parentId));
    if (hasHiddenParent) {
      hidden.add(row.id);
      return false;
    }
    return true;
  });
}

/**
 * Folds render rows through every registered stage, in fixed `RENDER_ORDER`.
 *
 * @remarks
 * `'prune'` cannot be claimed via `stages`; it runs directly from the reduce. `expanded` is the
 * caller's already-unioned set of every contributed `expandedRows` signal — omit it (or pass
 * `undefined`) for "no contributor," which is a pass-through.
 */
export function runRenderStages<TRow>(
  rows: StagedRow<TRow>[],
  stages: RenderStages<TRow>,
  expanded?: ReadonlySet<RowId>
): StagedRow<TRow>[] {
  return RENDER_ORDER.reduce((current, stage) => {
    if (stage === 'prune') {
      return pruneUnexpandedDescendants(current, expanded);
    }
    return stages[stage]?.(current) ?? current;
  }, rows);
}
