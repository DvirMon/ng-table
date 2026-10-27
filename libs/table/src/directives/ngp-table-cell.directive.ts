import { computed, Directive, inject, input, type InputSignal, type Signal } from '@angular/core';

import { NGP_TABLE_ROW, NGP_TABLE_STORE } from './table.tokens';

// Dual-tag selector, role set unconditionally. See `ngp-table-header-cell.directive.ts` for
// why this is a separate directive rather than one shared directive with an `isHeader` flag.
@Directive({
  selector: 'td[ngpTableCell], div[ngpTableCell]',
  host: {
    role: 'gridcell',
    '[attr.aria-colindex]': 'ngpTableCell() + 1',
    '[attr.tabindex]': 'tabindex()',
  },
})
export class NgpTableCellDirective {
  // aria-colindex is 1-based per WAI-ARIA; the input is the 0-based column position.
  readonly ngpTableCell: InputSignal<number> = input.required<number>();

  // Optional: a cell may sit in a plain `<tr>` without `ngpTableRow`.
  private readonly row = inject(NGP_TABLE_ROW, { optional: true });
  private readonly table = inject(NGP_TABLE_STORE);

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
