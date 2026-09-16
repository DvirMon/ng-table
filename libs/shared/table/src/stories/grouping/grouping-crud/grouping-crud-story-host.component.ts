import { Component, computed, input, signal } from '@angular/core';
import {
  createTable,
  insertRow,
  patchRow,
  removeRow,
  withGrouping,
  type RenderRow,
  type RowId,
} from '../../../index';
import { GROUPING_ROWS_MOCK } from '../fixtures/mock';
import { groupingConfig, STATIC_GROUPING_LEVELS } from '../fixtures/schema';
import type { DealRow } from '../fixtures/types';
import { GROUPING_STORY_PIPES } from '../grouping-story.pipes';
import { GroupingCrudToolbarComponent } from './grouping-crud-toolbar.component';
import { createRowForGroup } from './grouping-crud.utils';

/**
 * Grouped CRUD, banner group rows
 *
 * Group headers rendered as one full-width banner instead of a cell per column, each with its
 * own Add row to group button. Add, +1k and × write through `table.value.update()` with
 * `insertRow`/`patchRow`/`removeRow`.
 *
 * Only the deepest level offers Add — an ancestor group leaves the levels below it undecided.
 */
@Component({
  selector: 'ngp-grouping-crud-story-host',
  templateUrl: './grouping-crud-story-host.component.html',
  styleUrls: [
    '../../styles/story-host.css',
    '../grouping-story.css',
    './grouping-crud.css',
  ],
  imports: [...GROUPING_STORY_PIPES, GroupingCrudToolbarComponent],
})
export class GroupingCrudStoryHostComponent {
  /** Banner off: the same group rows rendered as one cell per column, for comparison. */
  readonly bannerGroupRows = input(true);
  readonly showCount = input(true);

  protected readonly data = signal<DealRow[]>(GROUPING_ROWS_MOCK);
  protected readonly table = createTable(
    this.data,
    groupingConfig,
    withGrouping({ initialGrouping: STATIC_GROUPING_LEVELS }),
  );

  protected readonly visibleColumns = computed(() =>
    this.table
      .columns()
      .filter((column) => column.visible)
      .sort((a, b) => a.order - b.order),
  );

  /** Depth of the deepest grouping level — the only depth that offers Add row to group. */
  protected readonly leafGroupDepth = computed(
    () => this.table.grouping().length - 1,
  );

  /** Column id of the deepest level, named in the hint so it follows a grouping change. */
  protected readonly deepestLevel = computed(
    () => this.table.grouping()[this.leafGroupDepth()] ?? '',
  );

  /** Level id to column label — `grouping()` carries bare ids, and the hint renders a label. */
  protected readonly columnLabelById = computed<Record<string, string>>(() =>
    Object.fromEntries(
      this.table.columns().map((column) => [column.id, column.label]),
    ),
  );

  /** A banner cell spans every rendered column plus the trailing actions column. */
  protected readonly bannerColspan = computed(
    () => this.visibleColumns().length + 1,
  );

  private nextId = 0;

  private createId(): RowId {
    this.nextId += 1;
    return `new-${this.nextId}`;
  }

  /** Create: inserts a row carrying this group's key on every level. Leaf-level headers only. */
  protected addRowToGroup(group: RenderRow<DealRow>): void {
    // The template guards this too. Re-checked here because a depth check is what makes the
    // group's key complete — a caller reaching this from an ancestor header would be asking for
    // a row whose deeper levels nobody decided.
    const isLeafGroup = group.depth === this.leafGroupDepth();
    // Any leaf under the group answers for its key: `group.id` stringifies the values and
    // `groupKey` holds this header's own level only.
    const template = this.table.rowsOf(group)[0];
    if (!isLeafGroup || !template) {
      return;
    }
    // Appended, not placed: the `'group'` render stage re-clusters, so no write names a group.
    const row = createRowForGroup(
      template,
      this.table.grouping(),
      this.createId(),
    );
    this.table.value.update(insertRow<DealRow>(row));
  }

  /** Update: raises an amount, which re-runs `aggregateFn` up every ancestor total. */
  protected bumpAmount(row: DealRow): void {
    this.table.value.update(
      patchRow<DealRow>(row.id, { amount: row.amount + 1000 }),
    );
  }

  /** Delete: removing a group's last row drops its header too — no group state to clean up. */
  protected removeDeal(row: DealRow): void {
    this.table.value.update(removeRow<DealRow>(row.id));
  }

  protected resetData(): void {
    this.data.set(GROUPING_ROWS_MOCK);
  }
}
