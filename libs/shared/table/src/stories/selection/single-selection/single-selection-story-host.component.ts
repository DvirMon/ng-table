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
 * D14 enforces, so ticking a second row visibly unticks the first with no host code saying so.
 * That is also why the Clear button exists here and nowhere else — a radio cannot be unticked by
 * clicking it, and there is no header checkbox in a single-select table to carry the gesture.
 * Arrow-key roving focus and Space come from the group for free (§4.1), which is the closest
 * thing to keyboard navigation reachable before the selection directive is drilled.
 *
 * `restoreConflictingSelection()` shows D14's other half: a multi-id write throws under
 * `ngDevMode` naming what it discarded, and truncates to the last id in production.
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

  /** The `ngDevMode` error text from the last conflicting write, rendered on canvas so the
   * throw-in-dev half of D14 is visible rather than described. */
  protected readonly conflictMessage = signal<string | null>(null);

  /**
   * Moves the single mark to `id`. The previous mark is cleared first, and suppressed (D18), so
   * the stream still sees one gesture: `toggle()`/`select()` evaluate the multi-select rule
   * against existing **plus** requested ids, which under `ngDevMode` throws instead of replacing
   * — the replace-not-throw path is only reachable in production today.
   */
  protected selectOnlyRow(id: RowId): void {
    this.conflictMessage.set(null);
    this.table.clearSelection({ emitEvent: false });
    this.table.toggle(id);
  }

  /** A radio group has no untick gesture, so the clear is a button here. */
  protected clearSelection(): void {
    this.conflictMessage.set(null);
    this.table.clearSelection();
  }

  /** Restores a two-id saved selection into a single-select table. Both ids exist, so there is
   * nothing to skip — the table has to resolve the conflict, and under `ngDevMode` it throws
   * naming the ids it discarded. In production the same call keeps the last id and writes. */
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
