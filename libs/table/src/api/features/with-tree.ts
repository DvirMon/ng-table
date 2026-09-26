import { computed, type Signal } from '@angular/core';
import type { Observable } from 'rxjs';
import { mapNodes, type RenderNode, type RenderNodeTransform } from '../../engine/render-stages';
import type { Feature, RowOf, TableFeatureSpec } from '../../engine/types';
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

// One call per evaluation — per `renderRows()` run, per `expand()` walk, per `state()`
// read. Each callback gets its own dedupe flag, so a throwing accessor never mutes the
// `isExpandable` report. Never hoist the flags to module scope: that reports once per
// process instead of once per evaluation. See ADR-0014.
function resolveCallbacks<TRow>(config: WithTreeConfig<TRow>): TreeCallbacks<TRow> {
  const childrenReported: ReportFlag = { done: false };
  const expandableReported: ReportFlag = { done: false };

  const readChildren = config.childrenAccessor
    ? guardCallback<TRow, TRow[] | undefined>(
        config.childrenAccessor,
        childrenReported,
        '[withTree] childrenAccessor threw. The affected row(s) render without children for ' +
          'this evaluation.',
        undefined
      )
    : (): TRow[] | undefined => undefined;

  const canExpand = config.isExpandable
    ? guardCallback<TRow, boolean>(
        config.isExpandable,
        expandableReported,
        '[withTree] isExpandable threw. The affected row(s) render without a toggle for this ' +
          'evaluation.',
        false
      )
    : (row: TRow): boolean => hasNonEmptyChildren(readChildren(row));

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

// One discovery walk, with its own evaluation-scoped report flags.
function discoverExpandableIds<TRow>(
  rows: readonly TRow[],
  trackBy: TrackByFn<TRow>,
  config: WithTreeConfig<TRow>
): RowId[] {
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

  return {
    members: { tree },
    // Claimed only when an accessor was supplied — a collapse-only instance leaves the
    // single-claim stage free for a future claimant.
    renderStages: config.childrenAccessor
      ? stageSchema<TRow>('render', (s) => {
          stage(s.tree, { run: buildTreeStage(input.trackBy, config) });
        })
      : undefined,
    // Contributed unconditionally, accessor or not: a collapse-only instance is exactly what
    // hides a group header's members, and the walk needs a defined set to do it.
    expandedRows: computed(() => store.expanded()),
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
 * `childrenAccessor` is supplied; omitted gives a collapse-only instance that still hides a
 * collapsed id's descendants without claiming the stage.
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
