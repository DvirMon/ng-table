import { Component, computed, signal } from '@angular/core';
import { createTable } from '../../../api/create-table';
import { withComputed } from '../../../api/features/with-computed';
import { withFiltering } from '../../../api/features/with-filtering';
import { withSelection } from '../../../api/features/with-selection';
import { equals } from '../../../filters/rules';
import type { RowId } from '../../../api/types';
import { COMPOSITION_DEPT_OPTIONS, COMPOSITION_ROWS_MOCK } from '../fixtures/mock';
import { derivedStateConfig } from '../fixtures/schema';
import type { CompositionRow } from '../fixtures/types';
import { DerivedStateToolbarComponent } from './derived-state-toolbar.component';

/**
 * `withComputed()` — nested vs. trailing
 *
 * One derive block nested inside `withSelection()`'s own slot, another as a trailing
 * top-level argument. The nested block sees only core + `withSelection()`'s members; the
 * trailing block reads back `hiddenSelected` — a member an earlier argument declared.
 */
@Component({
  selector: 'ngp-derived-state-story-host',
  templateUrl: './derived-state-story-host.component.html',
  styleUrls: ['../../styles/story-host.css'],
  imports: [DerivedStateToolbarComponent],
})
export class DerivedStateStoryHostComponent {
  protected readonly data = signal<CompositionRow[]>(COMPOSITION_ROWS_MOCK);
  protected readonly deptOptions = COMPOSITION_DEPT_OPTIONS;

  protected readonly table = createTable(
    this.data,
    derivedStateConfig,
    // `equals()`'s generics collapse `TCriterion` to `unknown` when called bare inside an
    // object-literal schema — saturating them keeps `activeDept` typed as `string | null`
    // instead of `unknown`. Latent defect in `filters/rules.ts`; flagged, not fixed here.
    withFiltering({ schema: (path) => ({ dept: equals<CompositionRow, 'dept', never>(path.dept) }) }),
    withSelection(
      {},
      withComputed((store) => ({
        hiddenSelected: computed(() => {
          const visibleIds = new Set(store.renderRows().map((row) => row.id));
          return [...store.selectedRows()].filter((id) => !visibleIds.has(id)).length;
        }),
      })),
    ),
    withComputed((store) => ({
      visibleSelected: computed(() => store.selectedRows().size - store.hiddenSelected()),
    })),
  );

  protected readonly activeDept = computed(() => this.table.filters.dept().value());

  protected toggleRowSelection(id: RowId): void {
    this.table.toggle(id);
  }

  /** The select's empty option is "All" — `reset(null)` returns `dept` to its declared source
   * rather than writing an empty string the `equals` criterion would then match on. */
  protected setDeptFilter(value: string): void {
    const isAllSelected = value === '';
    const dept = this.table.filters.dept();

    if (isAllSelected) {
      dept.reset(null);
      return;
    }
    dept.value.set(value);
  }
}
