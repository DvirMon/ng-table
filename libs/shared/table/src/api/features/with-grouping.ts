import { signal, type Signal } from '@angular/core';
import { buildGroupRenderRows, clusterRows, rowsBeneathGroup } from '../../engine/grouping';
import type { TableCore, TableFeatureSpec } from '../../engine/types';
import { createWritableView, type WritableView } from '../../engine/writable-view';
import type { ColumnId, GroupingUpdater, GroupSummary, RenderRow, RowId } from '../types';

type GroupingInput<TRow> = Pick<TableCore<TRow>, 'columns' | 'rows'>;

/** A shallow duck-type check (callable, not a full `Signal<Set<RowId>>` shape check) — safe only
 * because `SlotRegistry` (ADR-0007) guarantees `composed['expandedRows']` can be nothing but
 * `withExpansion()`'s signal or `undefined`; a second feature claiming that member key throws
 * at construction before this ever runs. */
function isExpandedRowsSignal(value: unknown): value is Signal<ReadonlySet<RowId>> {
  return typeof value === 'function';
}

export interface WithGroupingConfig<TRow> {
  /** Seeds `grouping` at construction. An id naming no known column throws — a wiring error,
   * parallel to `engine/rows.ts`'s `trackBy` throw site (D14). */
  initialGrouping?: ColumnId<TRow>[];
  /** Orders clusters by their contents, siblings only, at every depth. Omitted: stable
   * first-occurrence order. Throws: falls back to stable order for the affected level and
   * reports once per evaluation. Decoupled from `sorting`. See `withGrouping()`'s decisions
   * doc, D4/D5/D9/D15. */
  groupOrder?: (a: GroupSummary<TRow>, b: GroupSummary<TRow>) => number;
}

export interface GroupingMembers<TRow> {
  readonly grouping: WritableView<string[], GroupingUpdater<TRow>>;
  /** Leaf rows beneath a group header, at any depth — post-filter by construction, since
   * `filter` precedes `group` in `PIPELINE_ORDER`. Resolved by `group.id`, so a header from an
   * earlier render pass still works; a group that no longer exists returns `[]`. Reads
   * `core.rows()` (pipeline output), independent of collapse/expand state. */
  readonly rowsOf: (group: RenderRow<TRow>) => readonly TRow[];
}

/**
 * Adds column-based row grouping to a `createTable()`. Standalone — reads only `core.columns`,
 * no dependency on any other feature. Claims the `'group'` pipeline and render stages
 * (`engine/grouping.ts`'s `clusterRows`/`buildGroupRenderRows`). `table.grouping` reads
 * `baseGrouping` directly — the D6 base+overlay fold (`groupingRule`) is issue #60, out of
 * scope here (see the step's scope note). `groupOrder` orders cluster siblings (D4).
 */
export function withGrouping<TRow = unknown>(
  config: WithGroupingConfig<TRow> = {}
): (
  core: GroupingInput<TRow>,
  composed: Record<string, unknown>
) => TableFeatureSpec<TRow, GroupingMembers<TRow>> {
  return (
    core: GroupingInput<TRow>,
    composed: Record<string, unknown>
  ): TableFeatureSpec<TRow, GroupingMembers<TRow>> => {
    const initial: string[] = config.initialGrouping ?? [];
    const knownIds = new Set(core.columns().map((c) => c.id));
    const unknownIds = initial.filter((id) => !knownIds.has(id));
    if (unknownIds.length > 0) {
      throw new Error(
        `[withGrouping] initialGrouping names unknown column id(s): ${unknownIds.join(', ')}.`
      );
    }

    const baseGrouping = signal<string[]>(initial);
    const grouping = createWritableView<string[], GroupingUpdater<TRow>>(
      () => baseGrouping(),
      (updater) => baseGrouping.update(updater)
    );

    const rowsOf = (group: RenderRow<TRow>): readonly TRow[] =>
      rowsBeneathGroup(core.rows(), baseGrouping(), core.columns(), group.id);

    return {
      members: { grouping, rowsOf },
      stages: {
        group: (rows) => clusterRows(rows, baseGrouping(), core.columns(), config.groupOrder),
      },
      renderStages: {
        group: (rows) => {
          const expandedRowsMember = composed['expandedRows'];
          const expandedRows = isExpandedRowsSignal(expandedRowsMember)
            ? expandedRowsMember()
            : undefined;
          return buildGroupRenderRows(
            rows,
            baseGrouping(),
            core.columns(),
            config.groupOrder,
            expandedRows
          );
        },
      },
    };
  };
}
