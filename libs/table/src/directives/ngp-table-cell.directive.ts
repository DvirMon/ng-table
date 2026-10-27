import {
  computed,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  type InputSignal,
  type Signal,
} from '@angular/core';

import { NGP_TABLE_FOCUS_REGISTRY } from './focus-registry';
import { NGP_TABLE_ROW, NGP_TABLE_STORE } from './table.tokens';

/**
 * Marks a `<td>` or `<div>` as a grid body cell and makes it a roving-tabindex stop.
 *
 * @remarks
 * Sets `role="gridcell"` and `aria-colindex`. Only the active cell is a Tab stop; group rows
 * bind no `tabindex`.
 *
 * @example
 * <td [ngpTableCell]="0">{{ row.name }}</td>
 */
@Directive({
  selector: 'td[ngpTableCell], div[ngpTableCell]',
  host: {
    // Note: role is set unconditionally on both tags. See `ngp-table-header-cell.directive.ts`
    // for why this is a separate directive rather than one with an `isHeader` flag.
    role: 'gridcell',
    '[attr.aria-colindex]': 'ngpTableCell() + 1',
    '[attr.tabindex]': 'tabindex()',
  },
})
export class NgpTableCellDirective {
  /** The 0-based column position of this cell, bound as the 1-based `aria-colindex`. */
  readonly ngpTableCell: InputSignal<number> = input.required<number>();

  // Optional: a cell may sit in a plain `<tr>` without `ngpTableRow`.
  private readonly row = inject(NGP_TABLE_ROW, { optional: true });
  private readonly table = inject(NGP_TABLE_STORE);
  private readonly focusRegistry = inject(NGP_TABLE_FOCUS_REGISTRY, { optional: true });
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    // Registers this cell's element for DOM focus; the cleanup also runs on destroy.
    effect((onCleanup) => {
      const rowId = this.row?.rowId();
      const columnId = this.table.ngpTable().renderColumns()[this.ngpTableCell()]?.id;
      const isGroupRow = this.row?.isGroupHeader() ?? true;
      const registry = this.focusRegistry;
      if (registry === null) return;
      if (rowId === undefined || columnId === undefined || isGroupRow) return;

      registry.register({ rowId, columnId }, this.element);
      onCleanup(() => registry.unregister(this.element));
    });
  }

  // Roving tabindex: the one cell matching `activeTarget` is the Tab stop. Group rows bind no
  // attribute (group stops are #240).
  protected readonly tabindex: Signal<0 | -1 | null> = computed((): 0 | -1 | null => {
    const row = this.row;
    if (row === null || row.isGroupHeader()) return null;

    const target = this.table.activeTarget();
    const columnId = this.table.ngpTable().renderColumns()[this.ngpTableCell()]?.id;
    const isActiveCell =
      target?.area === 'body' && target.rowId === row.rowId() && target.columnId === columnId;
    return isActiveCell ? 0 : -1;
  });
}
