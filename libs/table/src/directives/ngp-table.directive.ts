import {
  afterNextRender,
  computed,
  Directive,
  effect,
  inject,
  input,
  Injector,
  signal,
  type InputSignal,
  type Signal,
} from '@angular/core';

import { NGP_TABLE_STORE } from './table.tokens';
import type { RowId, TableStore } from '../api/types';

// Dual-tag selector, native `<table>` and `<div>` grid share one directive. `role` is set
// unconditionally, even on native `<table>` — an explicit role matching the implicit native
// one is a documented no-op, not a conflict.
@Directive({
  selector: 'table[ngpTable], div[ngpTable]',
  providers: [{ provide: NGP_TABLE_STORE, useExisting: NgpTableDirective }],
  host: {
    role: 'table',
    '[attr.aria-rowcount]': 'ariaRowCount()',
    '[attr.aria-colcount]': 'ariaColCount()',
  },
})
export class NgpTableDirective<TRow = unknown> {
  readonly ngpTable: InputSignal<TableStore<TRow>> = input.required<TableStore<TRow>>();

  readonly ariaRowCount: Signal<number> = computed(() => this.ngpTable().totalRowCount());
  readonly ariaColCount: Signal<number> = computed(() => this.ngpTable().columns().length);

  private readonly injector = inject(Injector);

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
    effect(() => {
      const renderRows = this.ngpTable().renderRows();

      afterNextRender(
        () => {
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
          // glides from its old spot to its new (real) one.
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              this.rowFlipPlaying.set(true);
              this.rowFlipOffsets.set(new Map());
            });
          });
        },
        { injector: this.injector },
      );
    });
  }

  /** Read by `ngpTableRow` for its `--ngp-table-row-flip-offset` host binding. */
  flipOffsetFor(rowId: RowId): number {
    return this.rowFlipOffsets().get(rowId) ?? 0;
  }

  /** Read by `ngpTableRow` for its `data-row-flip` host binding. */
  isRowFlipping(): boolean {
    return this.rowFlipPlaying();
  }

  /** Called by `ngpTableRow` on construction; always overwrites. */
  registerRowElement(rowId: RowId, element: HTMLElement): void {
    this.rowElements.set(rowId, element);
  }

  /**
   * Called by `ngpTableRow` on destroy. Only removes the entry when `element` is still the
   * currently-registered one for `rowId` — a re-entering row with the same id may already have
   * registered its own element before the leaving instance is destroyed.
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
