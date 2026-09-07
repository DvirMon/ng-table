import { signal, type Signal } from '@angular/core';
import { Subject, type Observable } from 'rxjs';
import { pruneByIds } from '../../engine/rows';
import type { TableCore, TableFeatureSpec } from '../../engine/types';
import type { RenderRow, RowId, TrackByFn } from '../types';

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

/** The slice of the core store this feature reads. */
type ExpansionInput<TRow> = Pick<TableCore<TRow>, 'rows' | 'trackBy'>;

export interface ExpansionMembers {
  readonly expandedRows: Signal<Set<RowId>>;

  // Additive-only: every id expanded at least once. Never shrinks on collapse — lets
  // consumers gate lazy-then-persist detail-panel mounting on `everExpanded().has(id)`
  // instead of `isExpanded`. See docs/1-state/features/expansion.md.
  readonly everExpanded: Signal<Set<RowId>>;

  readonly rowExpanded: Observable<RowId>;

  toggleExpanded(rowId: RowId): void;
  expandAll(): void;
  collapseAll(): void;
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

/** Wraps a raw `TRow` child as an unstamped render row, at its parent's `depth + 1`. */
function toChildRenderRow<TRow>(
  row: TRow,
  depth: number,
  trackBy: TrackByFn<TRow>
): Omit<RenderRow<TRow>, 'index'> {
  return { id: trackBy(row), depth, kind: 'row', data: row };
}

/**
 * The `'tree'` render stage (ADR-0011). Passes through any row a preceding stage already
 * produced (e.g. a `'group'` header, `data === null`) untouched, and for a data-backed row
 * stamps `hasChildren`/`isExpanded` onto it, then — once expanded — appends its children,
 * recursively, at `row.depth + 1`.
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
): (rows: Omit<RenderRow<TRow>, 'index'>[]) => Omit<RenderRow<TRow>, 'index'>[] {
  function expandRow(
    row: Omit<RenderRow<TRow>, 'index'>,
    expanded: Set<RowId>
  ): Omit<RenderRow<TRow>, 'index'>[] {
    if (row.data === null) {
      return [row];
    }
    const self: Omit<RenderRow<TRow>, 'index'> = {
      ...row,
      hasChildren: isExpandable(row.data),
      isExpanded: expanded.has(row.id),
    };
    const children = childrenAccessor(row.data);
    if (!hasNonEmptyChildren(children) || !self.isExpanded) {
      return [self];
    }
    const nested = children.flatMap((child) =>
      expandRow(toChildRenderRow(child, row.depth + 1, trackBy), expanded)
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
 * Adds multi-expand, tree-capable row expansion to a `createTable()`. Standalone — reads
 * only core members, no dependency on any other feature. Claims the `'tree'` render stage
 * (ADR-0011) to flatten expanded children into `renderRows()` (see with-expansion.md), so it
 * cannot be composed alongside another feature also claiming `'tree'`.
 */
export function withExpansion<TRow = unknown>(
  config: WithExpansionConfig<TRow> = {}
): (core: ExpansionInput<TRow>) => TableFeatureSpec<TRow, ExpansionMembers> {
  const childrenAccessor = config.childrenAccessor ?? defaultChildrenAccessor<TRow>;
  const isExpandable =
    config.isExpandable ?? ((row: TRow) => hasNonEmptyChildren(childrenAccessor(row)));

  return (
    core: ExpansionInput<TRow>
  ): TableFeatureSpec<TRow, ExpansionMembers> => {
    const expandedRows = signal(new Set<RowId>());
    const everExpanded = signal(new Set<RowId>());
    const rowExpandedSource = new Subject<RowId>();

    function toggleExpanded(rowId: RowId): void {
      const next = new Set(expandedRows());
      const isCollapsing = next.has(rowId);
      if (isCollapsing) {
        next.delete(rowId);
      } else {
        next.add(rowId);
        everExpanded.update((seen) => new Set(seen).add(rowId));
      }
      expandedRows.set(next);
      rowExpandedSource.next(rowId);
    }

    function expandAll(): void {
      const ids = collectExpandableRowIds(
        core.rows(),
        core.trackBy,
        childrenAccessor,
        isExpandable
      );
      const previous = expandedRows();
      const newlyExpanded = ids.filter((id) => !previous.has(id));
      everExpanded.update((seen) => {
        const next = new Set(seen);
        ids.forEach((id) => next.add(id));
        return next;
      });
      expandedRows.set(new Set(ids));
      newlyExpanded.forEach((id) => rowExpandedSource.next(id));
    }

    function collapseAll(): void {
      const collapsed = [...expandedRows()];
      expandedRows.set(new Set());
      collapsed.forEach((id) => rowExpandedSource.next(id));
    }

    // ADR-0006: `expandedRows` answers "is this row live and expanded" — an id that leaves
    // `data` must leave here too. `everExpanded` answers "has this id ever been expanded" and
    // is deliberately exempt (see its member doc).
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
        tree: buildTreeStage(core.trackBy, expandedRows, childrenAccessor, isExpandable),
      },
      onRowsRemoved,
    };
  };
}
