import type { RenderRow, RowId } from '../api/types';
import type { RenderNode } from './render-stages';

/** What the walk produces. `index`, `sourceIndex` and `cells` are stamped centrally in
 *  `engine/core.ts` after it runs. */
export type FlatRenderRow<TRow> = Omit<RenderRow<TRow>, 'index' | 'sourceIndex' | 'cells'>;

/**
 * Depth-first walk producing the flat render rows a template consumes.
 *
 * @remarks
 * The only reader of expansion state, and the only producer of `depth` and `parentId`.
 * `expanded === undefined` means no feature contributed — everything stays open and
 * `isExpanded` is left unstamped. A defined-but-empty set means a feature contributed and
 * nothing is open, so every nested row hides. Never conflate the two into a `size === 0`
 * check.
 */
export function flattenVisible<TRow>(
  nodes: readonly RenderNode<TRow>[],
  expanded: ReadonlySet<RowId> | undefined,
): FlatRenderRow<TRow>[] {
  const out: FlatRenderRow<TRow>[] = [];

  const walk = (node: RenderNode<TRow>, depth: number, parentId: RowId | undefined): void => {
    const hasChildren = node.hasChildren ?? node.children.length > 0;
    const isOpen = expanded === undefined || expanded.has(node.id);
    const contributesExpansionState = expanded !== undefined && hasChildren;
    out.push({
      id: node.id,
      kind: node.kind,
      data: node.data,
      depth,
      parentId,
      groupKey: node.groupKey,
      aggregates: node.aggregates,
      hasChildren,
      isExpanded: contributesExpansionState ? isOpen : undefined,
    });
    if (isOpen) {
      node.children.forEach((child) => walk(child, depth + 1, node.id));
    }
  };

  nodes.forEach((node) => walk(node, 0, undefined));
  return out;
}
