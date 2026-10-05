import type { RenderRow, RowId } from '../api/types';
import type { ResolvedStage } from './stage-order';
import type { StageContext } from './types';

/** Engine-internal render IR, never exported from `index.ts`. A node states structure, never
 *  position: `depth`, `parentId`, `index`, `sourceIndex` and `cells` are stamped later. Other
 *  fields are shared with `RenderRow` by construction. */
export interface RenderNode<TRow>
  extends Omit<
    RenderRow<TRow>,
    | 'depth'
    | 'index'
    | 'isExpanded'
    | 'sourceIndex'
    | 'parentId'
    | 'cells'
    | 'hasChildren'
    | 'isContextRow'
  > {
  /** Overrides the walk's `children.length > 0` derivation — set `true` for a lazy row
   *  whose children haven't loaded yet, so its toggle still renders. See ADR-0023. */
  readonly hasChildren?: boolean;
  readonly children: readonly RenderNode<TRow>[];
}

/** Built-in render anchors in execution order, fixed regardless of feature argument order. */
export const RENDER_ANCHORS = ['group', 'tree'] as const;

/**
 * Render stage names a feature may claim or declare; extend it via `declare module` merging
 * to author a new stage.
 */
export interface RenderStageRegistry {
  group: true;
  tree: true;
}

export type RenderStage = keyof RenderStageRegistry & string;

export type RenderNodeTransform<TRow> = (
  nodes: readonly RenderNode<TRow>[],
  ctx: StageContext<TRow>,
) => readonly RenderNode<TRow>[];

/**
 * Maps every node post-order, so `fn` sees a node whose `children` are already mapped.
 *
 * @remarks
 * `fn`'s return value is used as-is, never re-descended. The engine owns the recursion so a
 * stage cannot miss nodes nested under another stage's output. See ADR-0023.
 */
export function mapNodes<TRow>(
  nodes: readonly RenderNode<TRow>[],
  fn: (node: RenderNode<TRow>) => RenderNode<TRow>,
): readonly RenderNode<TRow>[] {
  return nodes.map((node) =>
    fn(node.children.length === 0 ? node : { ...node, children: mapNodes(node.children, fn) }),
  );
}

interface StageOutputScan {
  readonly ids: ReadonlySet<RowId>;
  readonly firstDuplicateId: RowId | undefined;
  readonly firstInventedId: RowId | undefined;
}

// One walk over a stage's output, children included. `inputIds` is `null` for the seed, which
// has nothing to be checked against. A `data === null` row is made up by design and exempt from
// the containment check.
function scanStageOutput<TRow>(
  nodes: readonly RenderNode<TRow>[],
  inputIds: ReadonlySet<RowId> | null,
): StageOutputScan {
  const ids = new Set<RowId>();
  let firstDuplicateId: RowId | undefined;
  let firstInventedId: RowId | undefined;

  const visit = (level: readonly RenderNode<TRow>[]): void => {
    for (const node of level) {
      const isDuplicate = ids.has(node.id);
      const isFirstDuplicate = isDuplicate && firstDuplicateId === undefined;
      if (isFirstDuplicate) firstDuplicateId = node.id;
      ids.add(node.id);

      const isRealRow = node.data !== null;
      const isMissingFromInput = inputIds !== null && !inputIds.has(node.id);
      const isInvented = isRealRow && isMissingFromInput;
      const isFirstInvented = isInvented && firstInventedId === undefined;
      if (isFirstInvented) firstInventedId = node.id;

      const hasChildren = node.children.length > 0;
      if (hasChildren) visit(node.children);
    }
  };
  visit(nodes);

  return { ids, firstDuplicateId, firstInventedId };
}

// Reports in production too (ADR-0014): a stage's output is data-dependent, so it is never
// thrown on and always passed through unchanged.
function reportStageOutput(
  stage: ResolvedStage<unknown>,
  { firstDuplicateId, firstInventedId }: StageOutputScan,
): void {
  const subject = `[createTable] render stage "${stage.name}" (${stage.label}) emitted`;
  const hasDuplicate = firstDuplicateId !== undefined;
  const hasInvented = firstInventedId !== undefined;
  if (hasDuplicate) {
    console.error(`${subject} duplicate row id "${firstDuplicateId}" — output passed through.`);
  }
  if (hasInvented) {
    console.error(
      `${subject} row id "${firstInventedId}" that was not in its input — output passed through.`,
    );
  }
}

/**
 * Runs render nodes through each stage in the order `resolveStageOrder` produced.
 *
 * @remarks
 * Each output is walked once and checked for duplicate ids and real rows absent from the
 * stage's input. Findings are reported, never thrown; the output passes through unchanged.
 */
export function runRenderStages<TRow>(
  nodes: readonly RenderNode<TRow>[],
  stages: readonly ResolvedStage<RenderNodeTransform<TRow>>[],
  ctx: StageContext<TRow>,
): readonly RenderNode<TRow>[] {
  const hasNoStages = stages.length === 0;
  if (hasNoStages) return nodes;

  let current = nodes;
  let inputIds = scanStageOutput(nodes, null).ids;
  for (const stage of stages) {
    current = stage.run(current, ctx);
    const scan = scanStageOutput(current, inputIds);
    reportStageOutput(stage, scan);
    inputIds = scan.ids;
  }
  return current;
}
