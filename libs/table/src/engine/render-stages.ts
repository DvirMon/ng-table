import type { RenderRow } from '../api/types';

/** Engine-internal render IR. Never exported from `index.ts`. `depth`, `parentId`,
 *  `index`, `sourceIndex` and `cells` are all derived or stamped later — a node states
 *  structure, never position. Shares `id`/`kind`/`data`/`groupKey`/`aggregates` with
 *  `RenderRow` by construction, so the two can't desync. */
export interface RenderNode<TRow>
  extends Omit<
    RenderRow<TRow>,
    'depth' | 'index' | 'isExpanded' | 'sourceIndex' | 'parentId' | 'cells' | 'hasChildren'
  > {
  /** Overrides the walk's `children.length > 0` derivation — set `true` for a lazy row
   *  whose children haven't loaded yet, so its toggle still renders. See ADR-0023. */
  readonly hasChildren?: boolean;
  readonly children: readonly RenderNode<TRow>[];
}

/**
 * Fixed render-layer execution order, independent of `features` array order — `RenderStages`
 * derives from it.
 */
export const RENDER_ORDER = ['group', 'tree'] as const;

export type RenderStage = (typeof RENDER_ORDER)[number];

export type RenderNodeTransform<TRow> = (
  nodes: readonly RenderNode<TRow>[]
) => readonly RenderNode<TRow>[];

/**
 * The render-node transforms a feature may declare via `TableFeatureSpec.renderStages` — two
 * features claiming the same stage throws (`SlotRegistry`). Internal wiring only, not part of
 * the public `TableStore<TRow>` contract.
 */
export type RenderStages<TRow> = Partial<Record<RenderStage, RenderNodeTransform<TRow>>>;

/**
 * Post-order walk: `fn` sees a node whose `children` are already mapped, and its return
 * value is used as-is — never re-descended. The engine owns this recursion so a stage
 * cannot forget to reach nodes nested under another stage's output. See ADR-0023.
 */
export function mapNodes<TRow>(
  nodes: readonly RenderNode<TRow>[],
  fn: (node: RenderNode<TRow>) => RenderNode<TRow>
): readonly RenderNode<TRow>[] {
  return nodes.map((node) =>
    fn(node.children.length === 0 ? node : { ...node, children: mapNodes(node.children, fn) })
  );
}

/**
 * Folds render nodes through every registered stage, in fixed `RENDER_ORDER`.
 */
export function runRenderStages<TRow>(
  nodes: readonly RenderNode<TRow>[],
  stages: RenderStages<TRow>
): readonly RenderNode<TRow>[] {
  return RENDER_ORDER.reduce<readonly RenderNode<TRow>[]>(
    (current, stage) => stages[stage]?.(current) ?? current,
    nodes
  );
}
