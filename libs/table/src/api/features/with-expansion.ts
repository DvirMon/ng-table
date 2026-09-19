import { signal, type Signal } from '@angular/core';
import { Subject, type Observable } from 'rxjs';
import { pruneByIds } from '../../engine/rows';
import type { StagedRow } from '../../engine/render-stages';
import type { Feature, RowOf, TableFeatureSpec } from '../../engine/types';
import { createTableFeature } from '../create-table-feature';
import type { DerivedDict, RowId, TableStore, TrackByFn } from '../types';

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
}

/** The slice of the store this feature reads, F-bounded so a factory body gets
 *  `input.rows(): RowOf<In>[]` etc. with no cast. */
type ExpansionInput<In> = Pick<TableStore<RowOf<In>>, 'rows' | 'trackBy'>;

/**
 * Suppresses the `rowExpanded` emission a write would otherwise produce. For writes that carry
 * no user intent — restoring persisted state, syncing from a server — where a subscriber would
 * otherwise mistake the write for an interaction. Mirrors Angular reactive forms'
 * `setValue(v, { emitEvent: false })`.
 */
export interface ExpansionWriteOptions {
  emitEvent?: boolean;
}

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

// Wraps a raw `TRow` child as an unstamped render row at its parent's `depth + 1`, carrying the
// parent's id so a child always knows its parent.
function toChildRenderRow<TRow>(
  row: TRow,
  depth: number,
  trackBy: TrackByFn<TRow>,
  parentId: RowId
): StagedRow<TRow> {
  return { id: trackBy(row), depth, kind: 'row', data: row, parentId };
}

/**
 * The `'tree'` render stage. Passes through any row a preceding stage already
 * produced (e.g. a `'group'` header, `data === null`) untouched, and for a data-backed row
 * stamps `hasChildren`/`isExpanded` onto it, then unconditionally appends its children,
 * recursively, at `row.depth + 1`, each carrying `parentId`. Collapse/expand visibility is not
 * this stage's concern: the engine-owned `'prune'` render stage (ADR-0017) hides a row's
 * descendants when its id is missing from the unioned `expandedRows` set.
 *
 * Takes `expandedRows` as a `Signal` and reads it inside the returned transform, not at
 * declaration time: `composeTable()` calls a feature's factory once during the fold and
 * keeps the returned `renderStages.tree` function forever, so a value read at declaration
 * time would freeze the first render forever instead of tracking later toggles.
 */
function buildTreeStage<TRow>(
  trackBy: TrackByFn<TRow>,
  expandedRows: Signal<Set<RowId>>,
  childrenAccessor: (row: TRow) => TRow[] | undefined,
  isExpandable: (row: TRow) => boolean
): (rows: StagedRow<TRow>[]) => StagedRow<TRow>[] {
  function expandRow(
    row: StagedRow<TRow>,
    expanded: Set<RowId>
  ): StagedRow<TRow>[] {
    if (row.data === null) {
      return [row];
    }
    const self: StagedRow<TRow> = {
      ...row,
      hasChildren: isExpandable(row.data),
      isExpanded: expanded.has(row.id),
    };
    const children = childrenAccessor(row.data);
    if (!hasNonEmptyChildren(children)) {
      return [self];
    }
    const nested = children.flatMap((child) =>
      expandRow(toChildRenderRow(child, row.depth + 1, trackBy, row.id), expanded)
    );
    return [self, ...nested];
  }

  return (rows) => {
    const expanded = expandedRows();
    return rows.flatMap((row) => expandRow(row, expanded));
  };
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

  const expandedRows = signal(new Set<RowId>());
  const everExpanded = signal(new Set<RowId>());
  const rowExpandedSource = new Subject<RowId>();

  function emitChanged(ids: readonly RowId[], options?: ExpansionWriteOptions): void {
    if (options?.emitEvent === false) {
      return;
    }
    ids.forEach((id) => rowExpandedSource.next(id));
  }

  function toggleExpanded(rowId: RowId, options?: ExpansionWriteOptions): void {
    const next = new Set(expandedRows());
    const isCollapsing = next.has(rowId);
    if (isCollapsing) {
      next.delete(rowId);
    } else {
      next.add(rowId);
      everExpanded.update((seen) => new Set(seen).add(rowId));
    }
    expandedRows.set(next);
    emitChanged([rowId], options);
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

    const previous = expandedRows();
    const newlyExpanded = ids.filter((id) => !previous.has(id));
    everExpanded.update((seen) => {
      const next = new Set(seen);
      ids.forEach((id) => next.add(id));
      return next;
    });
    expandedRows.set(new Set(ids));
    emitChanged(newlyExpanded, options);
  }

  function collapseAll(options?: ExpansionWriteOptions): void {
    const collapsed = [...expandedRows()];
    expandedRows.set(new Set());
    emitChanged(collapsed, options);
  }

  // `expandedRows` answers "is this row live and expanded" — an id that leaves `data` must
  // leave here too. `everExpanded` answers "has this id ever been expanded" and is
  // deliberately exempt (see its member doc).
  function onRowsRemoved(ids: readonly RowId[]): void {
    const next = pruneByIds(expandedRows(), ids);
    if (next !== expandedRows()) {
      expandedRows.set(new Set(next));
    }
  }

  return {
    members: {
      expandedRows: expandedRows.asReadonly(),
      everExpanded: everExpanded.asReadonly(),
      rowExpanded: rowExpandedSource.asObservable(),
      toggleExpanded,
      expandAll,
      collapseAll,
    },
    renderStages: {
      tree: buildTreeStage(input.trackBy, expandedRows, childrenAccessor, isExpandable),
    },
    // Read-only hand-off of the feature's own set to the engine's terminal `'prune'` render
    // stage (ADR-0017) — unioned with every other contributor in `engine/core.ts`.
    expandedRows: expandedRows.asReadonly(),
    onDestroy: () => rowExpandedSource.complete(),
    onRowsRemoved,
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
