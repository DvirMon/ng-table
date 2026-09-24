import { Component, computed, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import type { GroupKey } from '../../../api/types';
import { createTable } from '../../../api/create-table';
import { withGrouping } from '../../../api/features/with-grouping';
import { groupOrder } from '../../../api/features/with-grouping/schema';
import { withSorting } from '../../../api/features/with-sorting';
import { NgpTableDirective } from '../../../directives/ngp-table.directive';
import { NgpTableRowAnimationDirective } from '../../../directives/ngp-table-row-animation.directive';
import { NgpTableRowDirective } from '../../../directives/ngp-table-row.directive';
import { toAriaSort } from '../fixtures/utils';
import { NullableSelectFieldDirective } from './nullable-select-field.directive';
import { CATEGORY_OPTIONS, GROUP_EDIT_ROWS_MOCK } from './grouping-editing.mock';
import {
  compareCategoryGroups,
  groupEditRowsSchema,
  groupEditTableConfig,
} from './grouping-editing.schema';
import type { GroupEditRow } from './grouping-editing.types';

function hasCategory(key: GroupKey): boolean {
  return key !== null && key !== undefined;
}

/**
 * Grouping + row editing composed
 *
 * `withGrouping({ initial: ['category'], when })` plus a live category dropdown. A row with no
 * category yet renders flat — no header, depth 0. Picking a value commits the instant it's
 * chosen (no Save step), and the row moves under that category's header on the same write — a
 * fresh header if that category has never been picked before. `ngpTableRowAnimation` drives the
 * FLIP glide, so the row animates into its new group instead of jumping there, and
 * `animate.enter`/`animate.leave` fade a header in or out as it's created or emptied.
 *
 * `groupOrder` keeps headers alphabetical. Sorting by name reorders rows inside each group
 * and never moves a header — without the comparator, headers would follow the sort's
 * first occurrence.
 */
@Component({
  selector: 'ngp-grouping-editing-story-host',
  imports: [
    FormField,
    NgpTableDirective,
    NgpTableRowAnimationDirective,
    NgpTableRowDirective,
    NullableSelectFieldDirective,
  ],
  templateUrl: './grouping-editing-story-host.component.html',
  styleUrls: [
    '../../styles/story-host.css',
    '../../grouping/grouping-story.css',
    './grouping-editing-flip.css',
  ],
})
export class GroupingEditingStoryHostComponent {
  protected readonly data = signal<GroupEditRow[]>(GROUP_EDIT_ROWS_MOCK);
  protected readonly table = createTable(
    this.data,
    groupEditTableConfig,
    withGrouping({
      initial: ['category'],
      when: (cluster) => hasCategory(cluster.key),
      schema: (path) => {
        groupOrder(path['category'], compareCategoryGroups);
      },
    }),
    withSorting()
  );
  protected readonly rows = form(this.data, groupEditRowsSchema);
  protected readonly categoryOptions = CATEGORY_OPTIONS;
  protected readonly nameSortAria = computed(() =>
    toAriaSort(this.table.sortDirections().get('name'))
  );

  /** Rows still sitting flat at depth 0 — the count a person watches drop to 0 as they pick a
   * category for each one. */
  protected readonly ungroupedRowCount = computed(
    () => this.table.renderRows().filter((row) => row.kind === 'row' && row.depth === 0).length
  );
}
