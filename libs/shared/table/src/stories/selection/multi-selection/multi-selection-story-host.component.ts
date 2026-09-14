import { Component, computed, signal } from '@angular/core';
import { createTable } from '../../../api/create-table';
import { withSelection } from '../../../api/features/with-selection';
import { selectAllIds } from '../../../api/features/selection.utils';
import type { RowId } from '../../../api/types';
import { patchRow, removeRow } from '../../../mutations/row-mutations';
import { SAVED_SELECTION_IDS, SELECTION_ROWS_MOCK } from '../fixtures/mock';
import { multiSelectionConfig } from '../fixtures/schema';
import type { SelectionRow } from '../fixtures/types';
import { createSelectionEventLog } from './selection-event-log';

/**
 * The multi-selection baseline — every read and write surface `withSelection()` has, on one
 * screen. It exists because none of it had a rendering: `selectedRows()` is deliberately not a
 * `RenderRow` field (D5), so the binding recipe below (`[class]` + `[attr.aria-selected]` read
 * off the signal) *is* the missing contract, not a convenience.
 *
 * Two asymmetries are the reason the locked-row buttons sit next to each other: locking an
 * already-selected row keeps its mark (D58/D60), while an explicit clear drops it, because
 * `deselect`/`clearSelection` are ungated by design.
 *
 * The header checkbox computes its own tri-state from `selectionStateOf()` — the library ships
 * no derived "all visible selected" signal (S1/OQ-1), and `selectableRowIds` below is exactly
 * what that signal would replace.
 *
 * Single-select lives in `single-selection/`: `enableMultiRowSelection: false` is a
 * construction-time argument, so it is a sibling host, not a toggle here.
 */
@Component({
  selector: 'ngp-multi-selection-story-host',
  templateUrl: './multi-selection-story-host.component.html',
  styleUrls: ['../../styles/story-host.css', '../selection-story.css'],
})
export class MultiSelectionStoryHostComponent {
  protected readonly data = signal<SelectionRow[]>(SELECTION_ROWS_MOCK);

  protected readonly table = createTable(
    this.data,
    multiSelectionConfig,
    withSelection({ enableRowSelection: (row: SelectionRow) => !row.locked })
  );

  protected readonly eventLog = createSelectionEventLog(this.table.selectionChanged);

  /** Last demo action's outcome — the lock/restore/delete buttons each change state somewhere
   * other than where they are clicked. */
  protected readonly notice = signal<string | null>(null);

  protected readonly selectedCount = computed(() => this.table.selectedRows().size);

  /** The header checkbox's denominator: visible rows a `select()` would actually accept.
   * Pre-filtered with `isSelectable()` (D61) rather than re-deriving `enableRowSelection` —
   * without it a locked row would hold the header permanently indeterminate. */
  protected readonly selectableRowIds = computed(() =>
    selectAllIds(this.table).filter((id) => this.table.isSelectable(id))
  );

  private readonly headerSelectionState = computed(() =>
    this.table.selectionStateOf(this.selectableRowIds())
  );

  protected readonly isEverySelectableRowSelected = computed(
    () => this.headerSelectionState() === 'all'
  );

  protected readonly isSomeSelectableRowSelected = computed(
    () => this.headerSelectionState() === 'some'
  );

  /** Locked ids resolved once per render pass. `isSelectable()` scans `rows()` per call, so
   * asking it per row from the template would be O(n²) on every change detection. */
  protected readonly lockedRowIds = computed(
    () =>
      new Set(
        this.table
          .renderRows()
          .filter((row) => this.isRowLocked(row.id))
          .map((row) => row.id)
      )
  );

  private isRowLocked(id: RowId): boolean {
    return !this.table.isSelectable(id);
  }

  /** A locked control is `aria-disabled`, not `[disabled]` — it keeps its place in the tab order,
   * so the host, not the browser, has to refuse the write. `toggle()`'s deselect branch is
   * ungated (D58), so without this guard a locked row could still lose its mark by click. */
  protected toggleRowSelection(id: RowId): void {
    if (this.isRowLocked(id)) {
      return;
    }
    this.table.toggle(id);
  }

  /** Both directions of the one convergent gesture: tick selects every selectable visible row,
   * untick clears. No peer ships a separate Clear button — clearing is the header checkbox's
   * second state. */
  protected toggleAllRowSelection(): void {
    this.notice.set(null);
    if (this.isEverySelectableRowSelected()) {
      this.table.clearSelection();
      return;
    }
    this.table.select(this.selectableRowIds());
  }

  /** Locks the first selected unlocked row. The mark survives — unlike AG Grid, the only peer
   * that auto-deselects on a selectability change (D58/D60). */
  protected lockSelectedRow(): void {
    const targetId = [...this.table.selectedRows()].find((id) => !this.isRowLocked(id));
    if (targetId === undefined) {
      this.notice.set('Select an unlocked row first.');
      return;
    }
    this.table.value.update(patchRow<SelectionRow>(targetId, { locked: true }));
    this.notice.set(
      `${targetId} is locked now — select-all skips it, and its mark stayed. Untick the header checkbox and the mark goes: clearSelection() is ungated.`
    );
  }

  /** A restore is not user intent (D18), so it is written with `emitEvent: false` and never
   * reaches the event log. `SAVED_SELECTION_IDS` carries `s99`, which no row has: the write
   * succeeds, the unknown id renders nothing, the rest is untouched (D8). */
  protected restoreSavedSelection(): void {
    this.table.select(SAVED_SELECTION_IDS, { emitEvent: false });
    this.notice.set(
      `Restored ${SAVED_SELECTION_IDS.join(', ')} — s99 matches no row and is simply not rendered. Nothing was logged.`
    );
  }

  /** Removes a selected row from `data` the way a server push would. Reconciliation prunes the
   * id (ADR-0006) without emitting: the count drops and the event log stays empty — D11's
   * silence made visible by its absence. */
  protected deleteSelectedRowExternally(): void {
    const targetId = [...this.table.selectedRows()][0];
    if (targetId === undefined) {
      this.notice.set('Select a row first.');
      return;
    }
    this.table.value.update(removeRow<SelectionRow>(targetId));
    this.notice.set(
      `${targetId} left the data. The count dropped and the event log did not move — a prune is reconciliation, not a write.`
    );
  }
}
