import type { RenderNode, RenderNodeTransform } from '../../../engine/render-stages';
import { resolveTreeLinks, type BrokenLinkKind } from '../../../engine/tree-links';
import type { ParentLink } from '../../../engine/types';
import type { RowId, TrackByFn } from '../../types';
import type { WithTreeConfig } from './types';

export interface ReportFlag {
  done: boolean;
}

function reportCallbackError(message: string, error: unknown): void {
  // eslint-disable-next-line no-console -- ADR-0014: floor reporting mechanism, no existing
  // runtime-degradation logging abstraction to reuse in this codebase yet.
  console.error(message, error);
}

// One evaluation-scoped try/catch-and-dedupe guard, generic over the callback's message and
// fallback value.
export function guardCallback<TRow, R>(
  fn: (row: TRow) => R,
  reported: ReportFlag,
  message: string,
  fallback: R
): (row: TRow) => R {
  return (row) => {
    try {
      return fn(row);
    } catch (error) {
      if (!reported.done) {
        reported.done = true;
        reportCallbackError(message, error);
      }
      return fallback;
    }
  };
}

// One guard per evaluation, shared across `withTree()`'s callbacks: a throwing
// `isExpandable` degrades to `false` and reports once, never per row. See ADR-0014.
function guardIsExpandable<TRow>(
  config: WithTreeConfig<TRow>
): ((row: TRow) => boolean) | undefined {
  if (!config.isExpandable) {
    return undefined;
  }
  const reported: ReportFlag = { done: false };
  return guardCallback<TRow, boolean>(
    config.isExpandable,
    reported,
    '[withTree] isExpandable threw. The affected row(s) render without a toggle for this ' +
      'evaluation.',
    false
  );
}

// Reports a broken-link kind at most once per evaluation, shared across every pool the
// `'tree'` stage nests (top level plus each group header's own member list) — a self-parent
// found in one header and another in a sibling header still reports `self` only once. See
// ADR-0014.
function reportBrokenLinksOnce(
  broken: Readonly<Record<BrokenLinkKind, readonly RowId[]>>,
  reported: Record<BrokenLinkKind, boolean>
): void {
  (['self', 'absent', 'cycle'] as const).forEach((kind: BrokenLinkKind) => {
    const shouldReportKind = broken[kind].length > 0 && !reported[kind];
    if (shouldReportKind) {
      reported[kind] = true;
      reportCallbackError(
        `[withTree] parentId produced a "${kind}" link. The affected row(s) render as roots ` +
          'for this evaluation.',
        undefined
      );
    }
  });
}

// Narrows a `RenderNode` to one backed by real `TRow` data — never a synthesized `'group'`
// header (`data === null`) — so the pool-nesting functions below read `node.data` with no
// assertion.
type RowNode<TRow> = RenderNode<TRow> & { readonly data: TRow };

function isRowNode<TRow>(node: RenderNode<TRow>): node is RowNode<TRow> {
  return node.data !== null;
}

// The 4 params `nestFlatPool`/`nestFlatSiblings` pass through their mutual recursion unchanged,
// bundled so the recursive call site carries one reference instead of four positional args.
interface NestContext<TRow> {
  readonly trackBy: TrackByFn<TRow>;
  readonly parentOf: ParentLink<TRow>;
  readonly isExpandableGuarded: ((row: TRow) => boolean) | undefined;
  readonly reported: Record<BrokenLinkKind, boolean>;
}

// Nests one flat pool of sibling rows — either the top-level input or a single group header's
// own member list, never across headers (#170 is roots-only grouping across groups) — by
// resolved parent id. Sibling order follows `poolNodes`' own order, which is the stage's input
// order (already pipeline-sorted). `canExpand` decides `hasChildren`; its default is "some
// other row in this same pool declares this row as its parent."
function nestFlatPool<TRow>(
  poolNodes: readonly RowNode<TRow>[],
  ctx: NestContext<TRow>
): readonly RowNode<TRow>[] {
  if (poolNodes.length === 0) {
    return [];
  }

  const rows = poolNodes.map((node) => node.data);
  const { parentById, broken } = resolveTreeLinks(rows, {
    parentOf: ctx.parentOf,
    trackBy: ctx.trackBy,
  });
  reportBrokenLinksOnce(broken, ctx.reported);

  const childIdsByParent = new Map<RowId, RowId[]>();
  const rootIds: RowId[] = [];
  for (const node of poolNodes) {
    const id = ctx.trackBy(node.data);
    const parent = parentById.get(id) ?? null;
    if (parent === null) {
      rootIds.push(id);
    } else {
      const siblings = childIdsByParent.get(parent);
      if (siblings) {
        siblings.push(id);
      } else {
        childIdsByParent.set(parent, [id]);
      }
    }
  }

  const nodeById = new Map(poolNodes.map((node) => [ctx.trackBy(node.data), node]));
  const canExpand =
    ctx.isExpandableGuarded ??
    ((row: TRow): boolean => (childIdsByParent.get(ctx.trackBy(row))?.length ?? 0) > 0);

  const buildNode = (id: RowId): RowNode<TRow> => {
    const node = nodeById.get(id)!;
    return {
      ...node,
      hasChildren: canExpand(node.data),
      children: (childIdsByParent.get(id) ?? []).map(buildNode),
    };
  };

  return rootIds.map(buildNode);
}

// Walks one level of siblings: a group header (`data === null`) passes through unchanged
// except its own member list is nested recursively; the pool of data-backed siblings at this
// level is nested by parent id and only its roots stay at this position — a non-root member
// is emitted only once, nested beneath its resolved parent.
function nestFlatSiblings<TRow>(
  siblings: readonly RenderNode<TRow>[],
  ctx: NestContext<TRow>
): readonly RenderNode<TRow>[] {
  const poolNodes = siblings.filter(isRowNode);
  const nested = nestFlatPool(poolNodes, ctx);
  const nestedById = new Map(nested.map((node) => [ctx.trackBy(node.data), node]));

  return siblings.flatMap((node) => {
    if (!isRowNode(node)) {
      return [
        {
          ...node,
          children: nestFlatSiblings(node.children, ctx),
        },
      ];
    }
    const built = nestedById.get(ctx.trackBy(node.data));
    return built ? [built] : [];
  });
}

// The `'tree'` render stage for `withTree({ parentId })` (#167). Its own guarded `parentId`
// call is separate from the silent `parentLink` contribution: only this stage reports, and it
// alone needs to tell a throw apart from a declared root to name `parentId` in the message.
export function buildFlatTreeStage<TRow>(
  trackBy: TrackByFn<TRow>,
  config: WithTreeConfig<TRow>
): RenderNodeTransform<TRow> {
  const parentId = config.parentId!;
  return (nodes) => {
    const reported: Record<BrokenLinkKind, boolean> = { self: false, absent: false, cycle: false };
    const parentIdReported: ReportFlag = { done: false };
    const parentOf: ParentLink<TRow> = guardCallback<TRow, RowId | null>(
      (row) => parentId(row) ?? null,
      parentIdReported,
      '[withTree] parentId threw. The affected row(s) render as roots for this evaluation.',
      null
    );

    const ctx: NestContext<TRow> = {
      trackBy,
      parentOf,
      isExpandableGuarded: guardIsExpandable(config),
      reported,
    };
    return nestFlatSiblings(nodes, ctx);
  };
}
