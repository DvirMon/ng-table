import { computed, signal, type Signal } from '@angular/core';
import { from, mergeMap, type Observable } from 'rxjs';
import { mapNodes, type RenderNode, type RenderNodeTransform } from '../../engine/render-stages';
import type { Feature, RowOf, TableFeatureSpec } from '../../engine/types';
import { createTableFeature } from '../create-table-feature';
import type { DerivedDict, RowId, TableStore, TrackByFn } from '../types';
import { createExpansionStore, type ExpansionWriteOptions } from './expansion/state';

export type { ExpansionWriteOptions } from './expansion/state';

export interface WithExpansionConfig<TRow> {
  /** Reads a row's nested children. Default: `(row as { children?: TRow[] }).children`. */
  childrenAccessor?: (row: TRow) => TRow[] | undefined;
  /**
   * Decides whether a row should render the expand toggle, independent of whether its
   * children are loaded yet. Use this for lazy-loaded children (fetched on expand), where
   * `childrenAccessor` legitimately returns `undefined`/`[]` until the row has been opened
   * at least once. Default: derived from `childrenAccessor` (non-empty array required).
   */
  isExpandable?: (row: TRow) => boolean;
  /** Seeds `expandedRows`/`everExpanded` at construction. Emits nothing on `rowExpanded`. */
  initial?: readonly RowId[];
}

/** The slice of the store this feature reads, F-bounded so a factory body gets
 *  `input.rows(): RowOf<In>[]` etc. with no cast. */
type ExpansionInput<In> = Pick<TableStore<RowOf<In>>, 'rows' | 'trackBy'>;

export interface ExpansionMembers {
  readonly expandedRows: Signal<Set<RowId>>;

  // Additive-only: every id expanded at least once. Never shrinks on collapse — lets
  // consumers gate lazy-then-persist detail-panel mounting on `everExpanded().has(id)`
  // instead of `isExpanded`. See docs/1-state/features/expansion.md.
  readonly everExpanded: Signal<Set<RowId>>;

  readonly rowExpanded: Observable<RowId>;

  toggleExpanded(rowId: RowId, options?: ExpansionWriteOptions): void;
  /** Omitted `ids`: auto-discovers expandable rows via `childrenAccessor`, as before. Explicit
   * `ids` (e.g. `table.groupIds()` from `withGrouping()`): used verbatim — no `isExpandable`
   * filter, no recursion — and unioned with whatever was auto-discovered. */
  expandAll(options?: ExpansionWriteOptions): void;
  expandAll(ids: readonly RowId[], options?: ExpansionWriteOptions): void;
  collapseAll(options?: ExpansionWriteOptions): void;
}

function hasChildrenField<TRow>(
  row: TRow
): row is TRow & { children?: TRow[] } {
  return typeof row === 'object' && row !== null && 'children' in row;
}

function defaultChildrenAccessor<TRow>(row: TRow): TRow[] | undefined {
  return hasChildrenField(row) ? row.children : undefined;
}

function hasNonEmptyChildren<TRow>(children: TRow[] | undefined): children is TRow[] {
  return !!children && children.length > 0;
}

/** `Array.isArray`'s own predicate narrows to a mutable `any[]`, which doesn't exclude a
 * `readonly RowId[]` union member on the false branch — this local guard is typed to the exact
 * member so `expandAll`'s overload distinguishes its two call shapes correctly. */
function isRowIdArray(value: unknown): value is readonly RowId[] {
  return Array.isArray(value);
}

// Wraps a raw `TRow` child, recursively, as a nested `RenderNode` — the shape `mapNodes`
// expects, not a sibling to be flattened later.
function toChildNode<TRow>(
  row: TRow,
  trackBy: TrackByFn<TRow>,
  childrenAccessor: (row: TRow) => TRow[] | undefined,
  isExpandable: (row: TRow) => boolean
): RenderNode<TRow> {
  const children = childrenAccessor(row);
  return {
    id: trackBy(row),
    kind: 'row',
    data: row,
    hasChildren: isExpandable(row),
    children: hasNonEmptyChildren(children)
      ? children.map((child) => toChildNode(child, trackBy, childrenAccessor, isExpandable))
      : [],
  };
}

/**
 * The `'tree'` render stage. Passes through a node a preceding stage already synthesized (e.g.
 * a `'group'` header, `data === null`) untouched, and for a data-backed node stamps
 * `hasChildren` and nests its children beneath it via `mapNodes`. Collapse/expand visibility is
 * not this stage's concern: `flattenVisible` hides a node's descendants when its id is missing
 * from the unioned `expandedRows` set.
 */
function buildTreeStage<TRow>(
  trackBy: TrackByFn<TRow>,
  childrenAccessor: (row: TRow) => TRow[] | undefined,
  isExpandable: (row: TRow) => boolean
): RenderNodeTransform<TRow> {
  return (nodes) =>
    mapNodes(nodes, (node) => {
      if (node.data === null) {
        return node;
      }
      const children = childrenAccessor(node.data);
      return {
        ...node,
        hasChildren: isExpandable(node.data),
        children: hasNonEmptyChildren(children)
          ? children.map((child) => toChildNode(child, trackBy, childrenAccessor, isExpandable))
          : node.children,
      };
    });
}

// Recursively collects the id of every expandable row, at any depth — used by `expandAll()`
// to seed `expandedRows`. Only recurses into rows whose children are already loaded; rows
// with lazy/unloaded children still get expanded (and their `rowExpanded` event fires), but
// their own descendants can't be discovered until fetched.
function collectExpandableRowIds<TRow>(
  rows: TRow[],
  trackBy: TrackByFn<TRow>,
  childrenAccessor: (row: TRow) => TRow[] | undefined,
  isExpandable: (row: TRow) => boolean
): RowId[] {
  return rows.flatMap((row) => {
    if (!isExpandable(row)) {
      return [];
    }
    const children = childrenAccessor(row);
    const nested = hasNonEmptyChildren(children)
      ? collectExpandableRowIds(children, trackBy, childrenAccessor, isExpandable)
      : [];
    return [trackBy(row), ...nested];
  });
}

/**
 * The factory body: builds the feature spec from the store slice it reads plus its resolved
 * config. Shared by every `withExpansion()` overload via the generic `factory` below.
 */
function buildExpansionSpec<TRow>(
  input: Pick<TableStore<TRow>, 'rows' | 'trackBy'>,
  config: WithExpansionConfig<TRow>
): TableFeatureSpec<TRow, ExpansionMembers> {
  const childrenAccessor = config.childrenAccessor ?? defaultChildrenAccessor<TRow>;
  const isExpandable =
    config.isExpandable ?? ((row: TRow) => hasNonEmptyChildren(childrenAccessor(row)));

  // Accumulated via the store's `onExpanded` hook, never inside the store itself — additive-only
  // and exempt from `onRowsRemoved` pruning (see `ExpansionMembers.everExpanded`).
  const everExpanded = signal(new Set<RowId>());

  const store = createExpansionStore({
    initial: config.initial,
    onExpanded: (ids) => {
      everExpanded.update((seen) => {
        const next = new Set(seen);
        ids.forEach((id) => next.add(id));
        return next;
      });
    },
  });

  // The store seeds `expanded` silently at construction — no `onExpanded` call for the initial
  // set — so `everExpanded` is seeded here instead, synchronously, once.
  everExpanded.set(new Set(store.expanded()));

  function toggleExpanded(rowId: RowId, options?: ExpansionWriteOptions): void {
    store.toggle(rowId, options);
  }

  function expandAll(options?: ExpansionWriteOptions): void;
  function expandAll(ids: readonly RowId[], options?: ExpansionWriteOptions): void;
  function expandAll(
    idsOrOptions?: readonly RowId[] | ExpansionWriteOptions,
    maybeOptions?: ExpansionWriteOptions
  ): void {
    const explicitIds = isRowIdArray(idsOrOptions) ? idsOrOptions : undefined;
    const options = isRowIdArray(idsOrOptions) ? maybeOptions : idsOrOptions;

    const discovered = collectExpandableRowIds(
      input.rows(),
      input.trackBy,
      childrenAccessor,
      isExpandable
    );
    const ids = [...new Set([...discovered, ...(explicitIds ?? [])])];

    store.setExpanded(ids, options);
  }

  function collapseAll(options?: ExpansionWriteOptions): void {
    store.setExpanded([], options);
  }

  return {
    members: {
      expandedRows: computed(() => new Set(store.expanded())),
      everExpanded: everExpanded.asReadonly(),
      // Adapts the shared store's once-per-write `changed` back to the per-id stream this
      // member has always emitted, keeping its public shape unchanged.
      rowExpanded: store.changed.pipe(
        mergeMap((change) => from([...change.added, ...change.removed]))
      ),
      toggleExpanded,
      expandAll,
      collapseAll,
    },
    renderStages: {
      tree: buildTreeStage(input.trackBy, childrenAccessor, isExpandable),
    },
    // Read-only hand-off of the feature's own set to `flattenVisible` — unioned with every
    // other contributor in `engine/core.ts`.
    expandedRows: computed(() => store.expanded()),
    onDestroy: () => store.destroy(),
    onRowsRemoved: (ids) => store.onRowsRemoved(ids),
  };
}

/**
 * Adds multi-expand, tree-capable row expansion to a `createTable()`. Standalone — reads
 * only the store slice it needs, no dependency on any other feature. Claims the `'tree'`
 * render stage to flatten expanded children into `renderRows()`, so it cannot be composed
 * alongside another feature also claiming `'tree'`.
 */
export function withExpansion<In extends ExpansionInput<In>, D extends DerivedDict>(
  derive: Feature<NoInfer<In> & ExpansionMembers, D>
): Feature<In, ExpansionMembers & D>;
export function withExpansion<In extends ExpansionInput<In>>(
  config?: WithExpansionConfig<RowOf<In>>
): Feature<In, ExpansionMembers>;
export function withExpansion<In extends ExpansionInput<In>, D extends DerivedDict>(
  config: WithExpansionConfig<RowOf<In>> | undefined,
  derive: Feature<NoInfer<In> & ExpansionMembers, D>
): Feature<In, ExpansionMembers & D>;
export function withExpansion(
  configOrDerive: WithExpansionConfig<any> | Feature<any, any> = {},
  maybeDerive?: Feature<any, any>
): Feature<any, any> {
  const isDeriveFirst = typeof configOrDerive === 'function';
  const config: WithExpansionConfig<any> = isDeriveFirst ? {} : configOrDerive;
  const derive = isDeriveFirst ? configOrDerive : maybeDerive;
  const factory = <In extends ExpansionInput<In>>(
    input: In
  ): TableFeatureSpec<RowOf<In>, ExpansionMembers> => buildExpansionSpec(input, config);
  const feature: Feature<any, any> = derive
    ? createTableFeature(factory, derive)
    : createTableFeature(factory);
  return Object.assign(feature, { displayName: 'withExpansion' });
}
