import { Component, computed, signal } from '@angular/core';
import { createTable } from '../../../api/create-table';
import { createFilters } from '../../../filters/create-filters';
import { withComputed } from '../../../api/features/with-computed';
import { withFiltering } from '../../../api/features/with-filtering';
import { withSelection } from '../../../api/features/with-selection';
import { equals } from '../../../filters/rules';
import type { RowId } from '../../../api/types';
import { COMPOSITION_DEPT_OPTIONS, COMPOSITION_ROWS_MOCK } from '../fixtures/mock';
import { derivedStateConfig } from '../fixtures/schema';
import type { CompositionRow } from '../fixtures/types';

/**
 * The spec's headline `withComputed()` example: one derive block nested inside
 * `withSelection()`'s own slot, one as a trailing top-level argument. The nested block sees
 * core plus `withSelection()`'s own members only — `hiddenSelected` is derivable from
 * `renderRows()` (post-filter) and `selectedRows()` alone, with no visibility into
 * `withFiltering()` itself. The trailing block reads `hiddenSelected` back, a member an
 * *earlier* argument declared — the cross-slot read this story exists to prove.
 */
@Component({
  selector: 'ngp-derived-state-story-host',
  templateUrl: './derived-state-story-host.component.html',
  styleUrls: ['../../styles/story-host.css'],
})
export class DerivedStateStoryHostComponent {
  protected readonly data = signal<CompositionRow[]>(COMPOSITION_ROWS_MOCK);
  protected readonly deptOptions = COMPOSITION_DEPT_OPTIONS;

  protected readonly filters = createFilters(this.data, (path) => [equals(path.dept)]);

  protected readonly table = createTable(
    this.data,
    derivedStateConfig,
    withFiltering({ predicates: () => [this.filters().matcher()] }),
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

  protected readonly activeDept = computed(() => this.filters.dept().value());

  protected toggleRowSelection(id: RowId): void {
    this.table.toggle(id);
  }

  protected isRowSelected(id: RowId): boolean {
    return this.table.selectedRows().has(id);
  }

  /** The select's empty option is "All" — `reset(null)` returns `dept` to its declared source
   * rather than writing an empty string the `equals` criterion would then match on. */
  protected setDeptFilter(value: string): void {
    const isAllSelected = value === '';
    const dept = this.filters.dept();

    if (isAllSelected) {
      dept.reset(null);
      return;
    }
    dept.value.set(value);
  }
}
