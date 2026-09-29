import { computed, type Signal } from '@angular/core';
import type { Observable } from 'rxjs';
import { mapNodes, type RenderNode, type RenderNodeTransform } from '../../engine/render-stages';
import { resolveTreeLinks, type BrokenLinkKind } from '../../engine/tree-links';
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
  /** Reads a row's nested children. Omitted: collapse-only — no row tree, and the
   *  `'tree'` render stage is not claimed. There is no `row.children` fallback. */
  childrenAccessor?: (row: TRow) => TRow[] | undefined;
  /** Renders the toggle independently of whether children are loaded — lazy children.
   *  Default: the accessor returned a non-empty array. */
  isExpandable?: (row: TRow) => boolean;
  /** Seeds the open set at construction. Emits nothing on `changed`. */
  initial?: readonly RowId[];
  /**
   * Reads a flat row's declared parent id. `null` and `undefined` both mean root. Nests flat
   * rows by parent id instead of `childrenAccessor`; claims the `'tree'` render stage and the
   * parent link. A throw or an `undefined` return degrade that row to a root.
   *
   * @remarks
   * A self-parent, an absent parent, or a cycle also degrades that row to a root, reported once
   * per kind per evaluation (ADR-0014).
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
}

export interface TreeMembers {
  readonly tree: TreeSlice;
}

// F-bounded so a factory body gets `input.rows(): RowOf<In>[]` with no cast.
type TreeInput<In> = Pick<TableStore<RowOf<In>>, 'rows' | 'trackBy'>;

interface ReportFlag {
  done: boolean;
}

function reportCallbackError(message: string, error: unknown): void {
  // eslint-disable-next-line no-console -- ADR-0014: floor reporting mechanism, no existing
  // runtime-degradation logging abstraction to reuse in this codebase yet.
  console.error(message, error);
}

// One evaluation-scoped guard, reused for both `childrenAccessor` and `isExpandable`: same
// try/catch-and-dedupe shape, distinguished only by message and fallback value.
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

interface TreeCallbacks<TRow> {
  readChildren: (row: TRow) => TRow[] | undefined;
  canExpand: (row: TRow) => boolean;
}

// One guard per evaluation, shared by both `withTree()` nesting strategies: a throwing
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

// One call per evaluation — per `renderRows()` run, per `expand()` walk, per `state()`
// read. Each callback gets its own dedupe flag, so a throwing accessor never mutes the
// `isExpandable` report. Never hoist the flags to module scope: that reports once per
// process instead of once per evaluation. See ADR-0014.
function resolveCallbacks<TRow>(config: WithTreeConfig<TRow>): TreeCallbacks<TRow> {
  const childrenReported: ReportFlag = { done: false };

  const readChildren = config.childrenAccessor
    ? guardCallback<TRow, TRow[] | undefined>(
        config.childrenAccessor,
        childrenReported,
        '[withTree] childrenAccessor threw. The affected row(s) render without children for ' +
          'this evaluation.',
        undefined
      )
    : (): TRow[] | undefined => undefined;

  const canExpand =
    guardIsExpandable(config) ?? ((row: TRow): boolean => hasNonEmptyChildren(readChildren(row)));

  return { readChildren, canExpand };
}

function hasNonEmptyChildren<TRow>(children: TRow[] | undefined): children is TRow[] {
  return !!children && children.length > 0;
}

// Wraps a raw `TRow` child, recursively, as a nested `RenderNode` — the shape `mapNodes`
// expects, not a sibling to be flattened later.
function toChildNode<TRow>(
  row: TRow,
  trackBy: TrackByFn<TRow>,
  readChildren: (row: TRow) => TRow[] | undefined,
  canExpand: (row: TRow) => boolean
): RenderNode<TRow> {
  const children = readChildren(row);
  return {
    id: trackBy(row),
    kind: 'row',
    data: row,
    hasChildren: canExpand(row),
    children: hasNonEmptyChildren(children)
      ? children.map((child) => toChildNode(child, trackBy, readChildren, canExpand))
      : [],
  };
}

// The `'tree'` render stage. Passes a node a preceding stage already synthesized (a
// `'group'` header, `data === null`) through untouched; for a data-backed node stamps
// `hasChildren` and nests its children beneath it. Visibility is not this stage's concern —
// `flattenVisible` hides descendants of an id missing from the unioned `expandedRows` set.
function buildTreeStage<TRow>(
  trackBy: TrackByFn<TRow>,
  config: WithTreeConfig<TRow>
): RenderNodeTransform<TRow> {
  return (nodes) => {
    const { readChildren, canExpand } = resolveCallbacks(config);
    return mapNodes(nodes, (node) => {
      if (node.data === null) {
        return node;
      }
      const children = readChildren(node.data);
      return {
        ...node,
        hasChildren: canExpand(node.data),
        children: hasNonEmptyChildren(children)
          ? children.map((child) => toChildNode(child, trackBy, readChildren, canExpand))
          : node.children,
      };
    });
  };
}

// Collects the id of every expandable row, at any depth. Only recurses into rows whose
// children are already loaded: a lazy row still expands, but its own descendants cannot be
// discovered until fetched.
function collectExpandableRowIds<TRow>(
  rows: readonly TRow[],
  trackBy: TrackByFn<TRow>,
  readChildren: (row: TRow) => TRow[] | undefined,
  canExpand: (row: TRow) => boolean
): RowId[] {
  return rows.flatMap((row) => {
    if (!canExpand(row)) {
      return [];
    }
    const children = readChildren(row);
    const nested = hasNonEmptyChildren(children)
      ? collectExpandableRowIds(children, trackBy, readChildren, canExpand)
      : [];
    return [trackBy(row), ...nested];
  });
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
    if (broken[kind].length > 0 && !reported[kind]) {
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

// Nests one flat pool of sibling rows — either the top-level input or a single group header's
// own member list, never across headers (#170 is roots-only grouping across groups) — by
// resolved parent id. Sibling order follows `poolNodes`' own order, which is the stage's input
// order (already pipeline-sorted). `canExpand` decides `hasChildren`; its default is "some
// other row in this same pool declares this row as its parent."
function nestFlatPool<TRow>(
  poolNodes: readonly RowNode<TRow>[],
  trackBy: TrackByFn<TRow>,
  parentOf: ParentLink<TRow>,
  isExpandableGuarded: ((row: TRow) => boolean) | undefined,
  reported: Record<BrokenLinkKind, boolean>
): readonly RowNode<TRow>[] {
  if (poolNodes.length === 0) {
    return [];
  }

  const rows = poolNodes.map((node) => node.data);
  const { parentById, broken } = resolveTreeLinks(rows, { parentOf, trackBy });
  reportBrokenLinksOnce(broken, reported);

  const childIdsByParent = new Map<RowId, RowId[]>();
  const rootIds: RowId[] = [];
  for (const node of poolNodes) {
    const id = trackBy(node.data);
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

  const nodeById = new Map(poolNodes.map((node) => [trackBy(node.data), node]));
  const canExpand =
    isExpandableGuarded ??
    ((row: TRow): boolean => (childIdsByParent.get(trackBy(row))?.length ?? 0) > 0);

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
  trackBy: TrackByFn<TRow>,
  parentOf: ParentLink<TRow>,
  isExpandableGuarded: ((row: TRow) => boolean) | undefined,
  reported: Record<BrokenLinkKind, boolean>
): readonly RenderNode<TRow>[] {
  const poolNodes = siblings.filter(isRowNode);
  const nested = nestFlatPool(poolNodes, trackBy, parentOf, isExpandableGuarded, reported);
  const nestedById = new Map(nested.map((node) => [trackBy(node.data), node]));

  return siblings.flatMap((node) => {
    if (!isRowNode(node)) {
      return [
        {
          ...node,
          children: nestFlatSiblings(node.children, trackBy, parentOf, isExpandableGuarded, reported),
        },
      ];
    }
    const built = nestedById.get(trackBy(node.data));
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
    let reportedThrow = false;

    const parentOf: ParentLink<TRow> = (row) => {
      try {
        return parentId(row) ?? null;
      } catch (error) {
        if (!reportedThrow) {
          reportedThrow = true;
          reportCallbackError(
            '[withTree] parentId threw. The affected row(s) render as roots for this evaluation.',
            error
          );
        }
        return null;
      }
    };

    return nestFlatSiblings(nodes, trackBy, parentOf, guardIsExpandable(config), reported);
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

// One discovery walk, with its own evaluation-scoped report flags. Dispatches to the flat
// (`parentId`) walk when configured — that walk never reports, unlike this one.
function discoverExpandableIds<TRow>(
  rows: readonly TRow[],
  trackBy: TrackByFn<TRow>,
  config: WithTreeConfig<TRow>
): RowId[] {
  if (config.parentId) {
    return discoverExpandableIdsFlat(rows, trackBy, config);
  }
  const { readChildren, canExpand } = resolveCallbacks(config);
  return collectExpandableRowIds(rows, trackBy, readChildren, canExpand);
}

function buildTreeSpec<TRow>(
  input: Pick<TableStore<TRow>, 'rows' | 'trackBy'>,
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
  });

  // Claimed only when an accessor or `parentId` was supplied — a collapse-only instance leaves
  // the single-claim stage free for a future claimant.
  const renderStages = config.parentId
    ? stageSchema<TRow>('render', (s) => {
        stage(s.tree, { run: buildFlatTreeStage(input.trackBy, config) });
      })
    : config.childrenAccessor
      ? stageSchema<TRow>('render', (s) => {
          stage(s.tree, { run: buildTreeStage(input.trackBy, config) });
        })
      : undefined;

  return {
    members: { tree },
    renderStages,
    // Contributed unconditionally, accessor or not: a collapse-only instance is exactly what
    // hides a group header's members, and the walk needs a defined set to do it.
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
 * `childrenAccessor` or `parentId` is supplied; omitted gives a collapse-only instance that
 * still hides a collapsed id's descendants without claiming the stage.
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
