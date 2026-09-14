import { Component, signal } from '@angular/core';
import { createTable } from '../../../api/create-table';
import { withSelection } from '../../../api/features/with-selection';
import type { RowId } from '../../../api/types';
import { SAVED_CONFLICTING_SELECTION_IDS, SELECTION_ROWS_MOCK } from '../fixtures/mock';
import { singleSelectionConfig } from '../fixtures/schema';
import type { SelectionRow } from '../fixtures/types';

/**
 * The single-select path. `enableMultiRowSelection: false` is a construction-time argument, so
 * this is a sibling of `multi-selection/` rather than a toggle on it — a toggle would leave the
 * unused branch sitting in the host's source.
 *
 * The control is a radio group, not a checkbox: the group's own semantics are the replace rule
 * D14 enforces, so ticking a second row visibly unticks the first with no host code saying so —
 * `toggle(id)` is called directly, with no host-side replace logic. That is also why the Clear
 * button exists here and nowhere else — a radio cannot be unticked by clicking it, and there is
 * no header checkbox in a single-select table to carry the gesture. Arrow-key roving focus and
 * Space come from the group for free (§4.1), which is the closest thing to keyboard navigation
 * reachable before the selection directive is drilled.
 *
 * `restoreConflictingSelection()` shows D14's other half: a single call's own argument list
 * co-selecting two ids always throws, naming what it rejected.
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
