import { Component, computed, input, signal } from '@angular/core';
import {
  createTable,
  setGroupLevels,
  withFiltering,
  withGrouping,
  withSelection,
  type ColumnDef,
  type RenderRow,
  type RowId,
} from '../../../index';
import { GROUPING_ROWS_MOCK } from '../fixtures/mock';
import {
  createDealFilters,
  groupingConfig,
  SELECTION_GROUPING_LEVELS,
} from '../fixtures/schema';
import type { DealRow } from '../fixtures/types';
import {
  formatAmount,
  formatValue,
  isBlankGroupValue,
  readRepCriterion,
  repFilterNode,
} from '../fixtures/utils';
import type { CascadeMode } from './grouping-selection.types';

/**
 * What ticking a group's checkbox does — the reference wiring for D16, which made the cascade
 * **consumer-owned** and then said the directive layer should ship the correct wiring as its
 * default "so most people never hold it wrong". Until that layer exists, this story is that
 * wiring.
 *
 * The `cascade` arg renders all three peer defaults (P10) off **one** `rowsOf()` call, because a
 * single hardcoded cascade would read as the library's position rather than the absence of one:
 * - `self` — AG Grid's default. It selects the group *node*, and there is no group node here: a
 *   group is a view, not a record (§6). So on rows it does nothing at all, and the checkbox stays
 *   a read-only tri-state readout. That is not a gap to paper over; it is the model showing.
 * - `descendants` — TanStack's default (`enableSubRowSelection`): every leaf beneath the group,
 *   at any depth, via `select(rowsOf(group).map(trackBy))`.
 * - `descendants+parents` — MUI X's default, which propagates both ways. The downward half is the
 *   same write. **The upward half costs no code**: an ancestor's state is derived from
 *   `rowsOf(ancestor) ∩ selectedRows()` every render, so a region turns from indeterminate to
 *   checked the moment its last category does. MUI X needs a propagation pass because it *stores*
 *   group selection; deriving it is what removes the need.
 *
 * `rowsOf()` is post-filter by construction (`filter` precedes `group` in `PIPELINE_ORDER`) and is
 * re-derived from `table.rows()` rather than scanned out of `renderRows()`, so it is also
 * collapse-independent. Ticking a group under an active filter therefore selects exactly the rows
 * its header counts — **this is ag-grid #11209 not happening**, where an external filter left a
 * group reading partially selected while every visible child was selected.
 *
 * Two failures are visible by their absence: no group id is ever written to `selectedRows`, so the
 * readout counts rows and never headers (TanStack #5700), and Ungroup has nothing to prune — no id
 * can dangle, because none was ever there (TanStack #5822).
 */
@Component({
  selector: 'ngp-grouping-selection-story-host',
  templateUrl: './grouping-selection-story-host.component.html',
  styleUrls: ['../../styles/story-host.css', '../grouping-story.css'],
})
export class GroupingSelectionStoryHostComponent {
  readonly cascade = input<CascadeMode>('descendants');

  protected readonly data = signal<DealRow[]>(GROUPING_ROWS_MOCK);
  protected readonly filters = createDealFilters();
  protected readonly table = createTable(
    this.data,
    groupingConfig,
    withGrouping({ initialGrouping: SELECTION_GROUPING_LEVELS }),
    withSelection(),
    withFiltering({ predicates: () => [this.filters().matcher()] })
  );

  protected readonly visibleColumns = computed(() =>
    this.table
      .columns()
      .filter((column) => column.visible)
      .sort((a, b) => a.order - b.order)
  );

  protected readonly repFilter = computed(() => readRepCriterion(this.filters));

  protected readonly isGrouped = computed(() => this.table.grouping().length > 0);

  /** §6 made visible: the denominator is rows the pipeline produced, never render rows, so a
   * header can never be counted as one of them. */
  protected readonly selectionReadout = computed(
    () => `${this.table.selectedRows().size} of ${this.table.rows().length} rows selected`
  );

  /** Always 0, and rendered anyway — TanStack #5700 is a group id ending up in the selection
   * state object, which is only ever observable by looking. */
  protected readonly selectedGroupHeaderCount = computed(() => {
    const groupIds = new Set(
      this.table
        .renderRows()
        .filter((row) => row.kind === 'group')
        .map((row) => row.id)
    );
    return [...this.table.selectedRows()].filter((id) => groupIds.has(id)).length;
  });

  protected onFilterRep(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    repFilterNode(this.filters).value.set(target.value);
  }

  protected groupLabel(row: RenderRow<DealRow>): string {
    return formatValue(row.groupKey?.value);
  }

  protected isBlankGroup(row: RenderRow<DealRow>): boolean {
    return isBlankGroupValue(row.groupKey?.value);
  }

  protected groupRowCount(row: RenderRow<DealRow>): number {
    return this.table.rowsOf(row).length;
  }

  protected groupAggregate(row: RenderRow<DealRow>, columnId: string): string {
    return formatAmount(row.aggregates?.[columnId]);
  }

  protected cellValue(column: ColumnDef<DealRow>, row: DealRow): string {
    const value = column.accessor(row);
    return column.id === 'amount' ? formatAmount(value) : formatValue(value);
  }

  protected isGroupFullySelected(row: RenderRow<DealRow>): boolean {
    return this.table.selectionStateOf(this.groupRowIds(row)) === 'all';
  }

  /** P10b — a partly-selected group renders tri-state wherever a cascade exists. Derived, never
   * stored, which is why no ancestor ever needs writing to. */
  protected isGroupPartlySelected(row: RenderRow<DealRow>): boolean {
    return this.table.selectionStateOf(this.groupRowIds(row)) === 'some';
  }

  protected isRowSelected(rowId: RowId): boolean {
    return this.table.selectedRows().has(rowId);
  }

  protected rowCheckboxLabel(row: DealRow): string {
    return `Select ${row.rep}'s ${formatAmount(row.amount)} deal`;
  }

  protected groupCheckboxLabel(row: RenderRow<DealRow>): string {
    const name = this.isBlankGroup(row) ? 'the unlabelled group' : this.groupLabel(row);
    return `Select the ${this.groupRowCount(row)} rows in ${name}`;
  }

  /**
   * The whole cascade, in one function reading the arg signal. `self` writes nothing because there
   * is no group record to write; every other mode writes the same leaf set, and the "parents"
   * direction needs no write at all.
   */
  protected onToggleGroupSelection(row: RenderRow<DealRow>): void {
    const shouldCascadeToDescendants = this.cascade() !== 'self';
    if (!shouldCascadeToDescendants) {
      return;
    }
    const ids = this.groupRowIds(row);
    if (this.table.selectionStateOf(ids) === 'all') {
      this.table.deselect(ids);
      return;
    }
    this.table.select(ids);
  }

  protected onToggleRowSelection(rowId: RowId): void {
    this.table.toggle(rowId);
  }

  protected clearSelection(): void {
    this.table.clearSelection();
  }

  /** Nothing to prune, and nothing prunes: ungrouping removes headers from `renderRows()` and the
   * selection is untouched, because no header id was ever in it. */
  protected toggleGrouping(): void {
    const nextLevels = this.isGrouped() ? [] : SELECTION_GROUPING_LEVELS;
    this.table.grouping.update(setGroupLevels<DealRow>(nextLevels));
  }

  /** D16's "leaf rows, not immediate children" — every row beneath the group at any depth,
   * post-filter and collapse-independent, resolved by the group's own id. */
  private groupRowIds(row: RenderRow<DealRow>): RowId[] {
    return this.table.rowsOf(row).map((deal) => this.table.trackBy(deal));
  }
}
