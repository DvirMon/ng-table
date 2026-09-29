import { computed, type Signal } from '@angular/core';
import type { Observable } from 'rxjs';
import type { RenderNode, RenderNodeTransform } from '../../engine/render-stages';
import { resolveTreeLinks, type BrokenLinkKind, type TreeLinks } from '../../engine/tree-links';
import type { Feature, ParentLink, RowOf, TableFeatureSpec } from '../../engine/types';
import { stage } from '../../schema/stage-rules';
import { stageSchema } from '../../schema/stage-schema';
import { createTableFeature } from '../create-table-feature';
import type { DerivedDict, RowId, TableStore, TrackByFn } from '../types';
import {
  createExpansionStore,
  type ExpansionChange,
  type ExpansionWriteOptions,
} from './expansion/state';

export type { ExpansionChange, ExpansionWriteOptions } from './expansion/state';

export interface WithTreeConfig<TRow> {
  /** Renders the toggle independently of whether children are loaded — lazy children.
   *  Default: some other row's `parentId` resolves to this row. */
  isExpandable?: (row: TRow) => boolean;
  /** Seeds the open set at construction. Emits nothing on `changed`. */
  initial?: readonly RowId[];
  /**
   * Reads a flat row's declared parent id (`null`/`undefined` mean root); nests flat rows by
   * parent id and claims the `'tree'` render stage and the parent link. Omitted: collapse-only,
   * no row tree, stage left unclaimed. A throw, an `undefined` return, a self-parent, an absent
   * parent, or a cycle all degrade that row to a root (reported once per kind per evaluation).
   */
  parentId?: (row: TRow) => RowId | null | undefined;
}

export interface TreeSlice {
  (): ReadonlySet<RowId>;
  /** One emission per write, carrying the whole symmetric difference. */
  readonly changed: Observable<ExpansionChange>;
  /** `'all'` when every expandable row is open, `'none'` when none is — including
   *  "nothing is expandable", which is what a collapse-only instance always reads. */
  readonly state: Signal<'all' | 'some' | 'none'>;
  toggle(id: RowId, options?: ExpansionWriteOptions): void;
  /** Adds. Omitted `ids`: every expandable row found by the discovery walk. */
  expand(ids?: readonly RowId[], options?: ExpansionWriteOptions): void;
  /** Removes. Omitted `ids`: everything currently open. */
  collapse(ids?: readonly RowId[], options?: ExpansionWriteOptions): void;
  /** Atomic replace — the restore path. */
  set(ids: readonly RowId[], options?: ExpansionWriteOptions): void;
  /** The id's declared parent, resolved through `engine/tree-links.ts` over all of `data()` —
   * not the pipeline's `rows()` view. `null` for a root or an id not present in `data()`. Never
   * reports (#167). */
  parentOf(id: RowId): RowId | null;
  /** Every descendant of `id` at any depth, depth-first in `data()` order, parent before child,
   * never including `id` itself. `[]` for a leaf or an id not present in `data()`. Never
   * reports (#167). */
  descendantsOf(id: RowId): RowId[];
}

export interface TreeMembers {
  readonly tree: TreeSlice;
}

// F-bounded so a factory body gets `input.rows(): RowOf<In>[]` with no cast. Includes `value` so
// `parentOf()` / `descendantsOf()` can walk all of the row data, not the pipeline's `rows()` view.
type TreeInput<In> = Pick<TableStore<RowOf<In>>, 'rows' | 'trackBy' | 'value'>;

interface ReportFlag {
  done: boolean;
}

function reportCallbackError(message: string, error: unknown): void {
  // eslint-disable-next-line no-console -- ADR-0014: floor reporting mechanism, no existing
  // runtime-degradation logging abstraction to reuse in this codebase yet.
  console.error(message, error);
}

// One evaluation-scoped try/catch-and-dedupe guard, generic over the callback's message and
// fallback value.
function guardCallback<TRow, R>(
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

// The parent link `withTree({ parentId })` contributes to `ctx.parentOf` for every stage
// (#167/ADR-0028) — total and silent. A throw or an `undefined` return both degrade to a root;
// this contribution never reports (only the `'tree'` stage does).
function toSilentParentLink<TRow>(
  parentId: (row: TRow) => RowId | null | undefined
): ParentLink<TRow> {
  return (row) => {
    try {
      return parentId(row) ?? null;
    } catch {
      return null;
    }
  };
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
function buildFlatTreeStage<TRow>(
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

// Discovers expandable ids straight from flat `input.rows()` (`expand()` with no ids, and
// `state()`) — degrades exactly like the `'tree'` stage (self/absent/cycle/throw all become a
// root), but never reports: only the `'tree'` stage reports (#167).
function discoverExpandableIdsFlat<TRow>(
  rows: readonly TRow[],
  trackBy: TrackByFn<TRow>,
  config: WithTreeConfig<TRow>
): RowId[] {
  const parentOf = toSilentParentLink(config.parentId!);
  const { parentById } = resolveTreeLinks(rows, { parentOf, trackBy });

  const idsWithChildren = new Set<RowId>();
  parentById.forEach((parent) => {
    if (parent !== null) {
      idsWithChildren.add(parent);
    }
  });

  const isExpandable = config.isExpandable;
  const canExpand: (row: TRow) => boolean = isExpandable
    ? (row) => {
        try {
          return isExpandable(row);
        } catch {
          return false;
        }
      }
    : (row) => idsWithChildren.has(trackBy(row));

  return rows.filter((row) => canExpand(row)).map((row) => trackBy(row));
}

// Discovers expandable ids when `parentId` is configured; a collapse-only instance (no
// `parentId`) has no tree structure to discover, so it always finds nothing.
function discoverExpandableIds<TRow>(
  rows: readonly TRow[],
  trackBy: TrackByFn<TRow>,
  config: WithTreeConfig<TRow>
): RowId[] {
  if (!config.parentId) {
    return [];
  }
  return discoverExpandableIdsFlat(rows, trackBy, config);
}

// Resolves every row's parent link over all of `value()`, not the pipeline's `rows()` view — a
// row a filter dropped still counts for `parentOf()` / `descendantsOf()` (#167). `null` when no
// `parentId` is configured — there is no fallback to a conventional field.
function resolveDataTreeLinks<TRow>(
  input: Pick<TableStore<TRow>, 'value' | 'trackBy'>,
  config: WithTreeConfig<TRow>
): TreeLinks | null {
  if (!config.parentId) {
    return null;
  }
  return resolveTreeLinks(input.value(), {
    parentOf: toSilentParentLink(config.parentId),
    trackBy: input.trackBy,
  });
}

// Groups `data()` ids by resolved parent, preserving each parent's children in `data()` order —
// the sibling order `descendantsOf()`'s depth-first walk below relies on.
function groupChildrenByParent<TRow>(
  rows: readonly TRow[],
  trackBy: TrackByFn<TRow>,
  parentById: ReadonlyMap<RowId, RowId | null>
): Map<RowId, RowId[]> {
  const childrenByParent = new Map<RowId, RowId[]>();
  for (const row of rows) {
    const id = trackBy(row);
    const parent = parentById.get(id) ?? null;
    if (parent === null) {
      continue;
    }
    const siblings = childrenByParent.get(parent);
    if (siblings) {
      siblings.push(id);
    } else {
      childrenByParent.set(parent, [id]);
    }
  }
  return childrenByParent;
}

// Depth-first: a child, then its own children, before the next sibling — never `id` itself.
function collectDescendantIds(
  id: RowId,
  childrenByParent: ReadonlyMap<RowId, RowId[]>
): RowId[] {
  const children = childrenByParent.get(id) ?? [];
  return children.flatMap((childId) => [
    childId,
    ...collectDescendantIds(childId, childrenByParent),
  ]);
}

function buildTreeSpec<TRow>(
  input: Pick<TableStore<TRow>, 'rows' | 'trackBy' | 'value'>,
  config: WithTreeConfig<TRow>
): TableFeatureSpec<TRow, TreeMembers> {
  // No `onExpanded`: `everExpanded` is the panel's member, not the tree's.
  const store = createExpansionStore({ initial: config.initial });

  function toggle(id: RowId, options?: ExpansionWriteOptions): void {
    store.toggle(id, options);
  }

  function expand(ids?: readonly RowId[], options?: ExpansionWriteOptions): void {
    const target = ids ?? discoverExpandableIds(input.rows(), input.trackBy, config);
    store.setExpanded([...new Set([...store.expanded(), ...target])], options);
  }

  function collapse(ids?: readonly RowId[], options?: ExpansionWriteOptions): void {
    if (ids === undefined) {
      store.setExpanded([], options);
      return;
    }
    const removing = new Set(ids);
    store.setExpanded(
      [...store.expanded()].filter((id) => !removing.has(id)),
      options
    );
  }

  function set(ids: readonly RowId[], options?: ExpansionWriteOptions): void {
    store.setExpanded(ids, options);
  }

  function parentOf(id: RowId): RowId | null {
    const links = resolveDataTreeLinks(input, config);
    return links?.parentById.get(id) ?? null;
  }

  function descendantsOf(id: RowId): RowId[] {
    const links = resolveDataTreeLinks(input, config);
    if (!links) {
      return [];
    }
    const childrenByParent = groupChildrenByParent(input.value(), input.trackBy, links.parentById);
    return collectDescendantIds(id, childrenByParent);
  }

  const state = computed<'all' | 'some' | 'none'>(() => {
    const expandable = discoverExpandableIds(input.rows(), input.trackBy, config);
    if (expandable.length === 0) {
      return 'none';
    }
    const open = store.expanded();
    const openCount = expandable.filter((id) => open.has(id)).length;
    if (openCount === 0) {
      return 'none';
    }
    return openCount === expandable.length ? 'all' : 'some';
  });

  const tree: TreeSlice = Object.assign(computed(() => store.expanded()), {
    changed: store.changed,
    state,
    toggle,
    expand,
    collapse,
    set,
    parentOf,
    descendantsOf,
  });

  // Claimed only when `parentId` was supplied — a collapse-only instance leaves the
  // single-claim stage free for a future claimant.
  const renderStages = config.parentId
    ? stageSchema<TRow>('render', (s) => {
        stage(s.tree, { run: buildFlatTreeStage(input.trackBy, config) });
      })
    : undefined;

  return {
    members: { tree },
    renderStages,
    // Contributed unconditionally: a collapse-only instance is exactly what hides a group
    // header's members, and the walk needs a defined set to do it.
    expandedRows: computed(() => store.expanded()),
    // Single-claim (ADR-0028) — only when `parentId` is set; a second contributor throws.
    parentLink: config.parentId ? toSilentParentLink(config.parentId) : undefined,
    onDestroy: () => store.destroy(),
    onRowsRemoved: (ids) => store.onRowsRemoved(ids),
  };
}

/**
 * Adds a real row tree to `createTable()`: expanding a parent reveals its children as rows
 * with the same columns, at any depth.
 *
 * @remarks
 * Real-row parents only — no path or levels API. Claims the `'tree'` render stage only when
 * `parentId` is supplied; omitted gives a collapse-only instance that still hides a collapsed
 * id's descendants without claiming the stage.
 *
 * @example
 * createTable(data, { trackBy: 'id' }, withTree({ parentId: (row) => row.parentId }));
 */
export function withTree<In extends TreeInput<In>, D extends DerivedDict>(
  derive: Feature<NoInfer<In> & TreeMembers, D>
): Feature<In, TreeMembers & D>;
export function withTree<In extends TreeInput<In>>(
  config?: WithTreeConfig<RowOf<In>>
): Feature<In, TreeMembers>;
export function withTree<In extends TreeInput<In>, D extends DerivedDict>(
  config: WithTreeConfig<RowOf<In>> | undefined,
  derive: Feature<NoInfer<In> & TreeMembers, D>
): Feature<In, TreeMembers & D>;
export function withTree(
  configOrDerive: WithTreeConfig<any> | Feature<any, any> = {},
  maybeDerive?: Feature<any, any>
): Feature<any, any> {
  const isDeriveFirst = typeof configOrDerive === 'function';
  const config: WithTreeConfig<any> = isDeriveFirst ? {} : configOrDerive;
  const derive = isDeriveFirst ? configOrDerive : maybeDerive;
  const factory = <In extends TreeInput<In>>(
    input: In
  ): TableFeatureSpec<RowOf<In>, TreeMembers> => buildTreeSpec(input, config);
  const feature: Feature<any, any> = derive
    ? createTableFeature(factory, derive)
    : createTableFeature(factory);
  return Object.assign(feature, { displayName: 'withTree' });
}
