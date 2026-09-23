import { afterRenderEffect, Directive, inject, signal } from '@angular/core';

import { NGP_TABLE_ROW_ANIMATION, NGP_TABLE_STORE } from './table.tokens';
import type { RowId } from '../api/types';

// Dual-tag selector, matches `ngpTable`'s pattern. Opt-in: without this directive on the host,
// `ngpTableRow` measures/binds nothing (docs/3-ui/directives/row-animation.md).
@Directive({
  selector: 'table[ngpTableRowAnimation], div[ngpTableRowAnimation]',
  providers: [
    { provide: NGP_TABLE_ROW_ANIMATION, useExisting: NgpTableRowAnimationDirective },
  ],
  host: {
    'data-row-animation': '',
  },
})
export class NgpTableRowAnimationDirective<TRow = unknown> {
  // Required: this directive is meaningless without `ngpTable` on the same host element.
  private readonly parentTable = inject(NGP_TABLE_STORE);

  // FLIP row-reorder animation (docs/3-ui/directives/row-animation.md). Keyed by `RowId` so
  // `ngpTableRow` can look its own offset up regardless of where it landed in the DOM.
  private readonly rowFlipOffsets = signal(new Map<RowId, number>());
  private readonly rowFlipPlaying = signal(false);
  private previousRowTops = new Map<RowId, number>();

  // Row elements, keyed by id instead of DOM position — `animate.leave` keeps a leaving `<tr>`
  // in the DOM past its removal from `renderRows()`, which would otherwise shift index-paired
  // lookups for every row after it.
  private readonly rowElements = new Map<RowId, HTMLElement>();

  constructor() {
    // Re-runs only when `renderRows()` changes, after the DOM reflects it. `read`, not
    // `mixedReadWrite`: this hook reads layout and writes signals only — never the DOM.
    afterRenderEffect({
      read: (onCleanup) => {
        const renderRows = this.parentTable.ngpTable().renderRows();
        const newTops = this.captureRowTops(renderRows.map((row) => row.id));

        const deltas = new Map<RowId, number>();
        newTops.forEach((newTop, rowId) => {
          const oldTop = this.previousRowTops.get(rowId);
          if (oldTop !== undefined && oldTop !== newTop) {
            deltas.set(rowId, oldTop - newTop);
          }
        });
        this.previousRowTops = newTops;

        if (deltas.size === 0) {
          return;
        }

        // Invert: jump to the old position with no transition...
        this.rowFlipPlaying.set(false);
        this.rowFlipOffsets.set(deltas);

        // ...then play: next frame, clear the offset and enable the transition so the row
        // glides from its old spot to its new (real) one. Cancelled if the rows change again
        // before it fires, or on destroy, so a stale play never clears a newer invert.
        let frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(() => {
            this.rowFlipPlaying.set(true);
            this.rowFlipOffsets.set(new Map());
          });
        });
        onCleanup(() => cancelAnimationFrame(frame));
      },
    });
  }

  /** The row's current FLIP offset in pixels, or 0 if none is pending. */
  flipOffsetFor(rowId: RowId): number {
    return this.rowFlipOffsets().get(rowId) ?? 0;
  }

  /** Whether a FLIP transition is currently playing. */
  isRowFlipping(): boolean {
    return this.rowFlipPlaying();
  }

  /**
   * Registers a row's host element for FLIP offset measurement.
   *
   * @remarks
   * Always overwrites any existing entry for `rowId`.
   */
  registerRowElement(rowId: RowId, element: HTMLElement): void {
    this.rowElements.set(rowId, element);
  }

  /**
   * Unregisters a row's element.
   *
   * @remarks
   * Removes the entry only if `element` still matches what's registered for `rowId` — a
   * re-entering row with the same id may already have registered its own element before the
   * leaving instance is destroyed.
   */
  unregisterRowElement(rowId: RowId, element: HTMLElement): void {
    if (this.rowElements.get(rowId) === element) {
      this.rowElements.delete(rowId);
    }
  }

  private captureRowTops(rowIds: readonly RowId[]): Map<RowId, number> {
    const tops = new Map<RowId, number>();
    rowIds.forEach((rowId) => {
      const element = this.rowElements.get(rowId);
      if (element !== undefined) {
        tops.set(rowId, element.offsetTop);
      }
    });
    return tops;
  }
}
