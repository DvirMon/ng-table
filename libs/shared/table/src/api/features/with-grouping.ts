import { signal } from '@angular/core';
import { buildGroupRenderRows, clusterRows } from '../../engine/grouping';
import type { TableCore, TableFeatureSpec } from '../../engine/types';
import { createWritableView, type WritableView } from '../../engine/writable-view';
import type { ColumnId, GroupingUpdater } from '../types';

type GroupingInput<TRow> = Pick<TableCore<TRow>, 'columns'>;

export interface WithGroupingConfig<TRow> {
  /** Seeds `grouping` at construction. An id naming no known column throws — a wiring error,
   * parallel to `engine/rows.ts`'s `trackBy` throw site (D14). */
  initialGrouping?: ColumnId<TRow>[];
}

export interface GroupingMembers<TRow> {
  readonly grouping: WritableView<string[], GroupingUpdater<TRow>>;
}

/**
 * Adds column-based row grouping to a `createTable()`. Standalone — reads only `core.columns`,
 * no dependency on any other feature. Claims the `'group'` pipeline and render stages
 * (`engine/grouping.ts`'s `clusterRows`/`buildGroupRenderRows`). `table.grouping` reads
 * `baseGrouping` directly — the D6 base+overlay fold (`groupingRule`) is issue #60, out of
 * scope here (see the step's scope note).
 */
export function withGrouping<TRow = unknown>(
  config: WithGroupingConfig<TRow> = {}
): (core: GroupingInput<TRow>) => TableFeatureSpec<TRow, GroupingMembers<TRow>> {
  return (core: GroupingInput<TRow>): TableFeatureSpec<TRow, GroupingMembers<TRow>> => {
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

    return {
      members: { grouping },
      stages: {
        group: (rows) => clusterRows(rows, baseGrouping(), core.columns()),
      },
      renderStages: {
        group: (rows) => buildGroupRenderRows(rows, baseGrouping(), core.columns()),
      },
    };
  };
}
