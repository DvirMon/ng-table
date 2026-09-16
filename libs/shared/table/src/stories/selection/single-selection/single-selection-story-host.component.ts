import { Component, signal } from '@angular/core';
import { createTable } from '../../../api/create-table';
import { withSelection } from '../../../api/features/with-selection';
import type { RowId } from '../../../api/types';
import { SAVED_CONFLICTING_SELECTION_IDS, SELECTION_ROWS_MOCK } from '../fixtures/mock';
import { singleSelectionConfig } from '../fixtures/schema';
import type { SelectionRow } from '../fixtures/types';

/**
 * Single-row selection
 *
 * `enableMultiRowSelection: false` (construction-time), so a sibling host rather than a
 * toggle on `multi-selection/`. The radio group supplies replace semantics and roving focus
 * for free.
 *
 * `restoreConflictingSelection()` co-selects two ids in one call — it always throws, naming
 * what it rejected.
 */
@Component({
  selector: 'ngp-single-selection-story-host',
  templateUrl: './single-selection-story-host.component.html',
  styleUrls: ['../../styles/story-host.css', '../selection-story.css'],
})
export class SingleSelectionStoryHostComponent {
  protected readonly data = signal<SelectionRow[]>(SELECTION_ROWS_MOCK);

  protected readonly table = createTable(
    this.data,
    singleSelectionConfig,
    withSelection({ enableMultiRowSelection: false })
  );

  /** The error text from the last rejected write, rendered on canvas so the throw half of D14
   * is visible rather than described. */
  protected readonly conflictMessage = signal<string | null>(null);

  /** Clears any stale error banner before a fresh gesture. `table.toggle(id)` itself carries the
   * replace semantics — a second row's toggle silently replaces the first (D14). */
  protected toggleRow(id: RowId): void {
    this.conflictMessage.set(null);
    this.table.toggle(id);
  }

  /** A radio group has no untick gesture, so the clear is a button here. */
  protected clearSelection(): void {
    this.conflictMessage.set(null);
    this.table.clearSelection();
  }

  /** Restores a two-id saved selection into a single-select table. The call's own argument list
   * co-selects both ids, so the table always rejects it, naming the ids in the error. */
  protected restoreConflictingSelection(): void {
    this.conflictMessage.set(null);
    try {
      this.table.select(SAVED_CONFLICTING_SELECTION_IDS);
    } catch (error: unknown) {
      this.conflictMessage.set(
        error instanceof Error ? error.message : `withSelection() rejected the write: ${error}`
      );
    }
  }
}
