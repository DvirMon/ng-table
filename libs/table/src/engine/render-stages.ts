import type { RenderRow } from '../api/types';
import type { ResolvedStage } from './stage-order';

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
 * Fixed render-layer execution order, independent of `features` array order.
 */
export const RENDER_ANCHORS = ['group', 'tree'] as const;

/** The claimable render-stage names. `RenderStage` derives from its keys. */
export interface RenderStageRegistry {
  group: true;
  tree: true;
}

export type RenderStage = keyof RenderStageRegistry & string;

export type RenderNodeTransform<TRow> = (
  nodes: readonly RenderNode<TRow>[]
) => readonly RenderNode<TRow>[];

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

/** Folds render nodes through the resolved stage order — `resolveStageOrder` already fixed
 *  both the built-in anchor positions and any declared stage's slot; this just runs the list. */
export function runRenderStages<TRow>(
  nodes: readonly RenderNode<TRow>[],
  stages: readonly ResolvedStage<RenderNodeTransform<TRow>>[]
): readonly RenderNode<TRow>[] {
  return stages.reduce<readonly RenderNode<TRow>[]>(
    (current, stage) => stage.run(current),
    nodes
  );
}
