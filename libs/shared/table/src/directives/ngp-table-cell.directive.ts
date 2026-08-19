import { Directive, input, type InputSignal } from '@angular/core';

// ADR-0005: dual-tag selector, role set unconditionally. See
// `ngp-table-header-cell.directive.ts` for why this is a separate directive rather than one
// shared directive with an `isHeader` flag.
@Directive({
  selector: 'td[ngpTableCell], div[ngpTableCell]',
  host: {
    role: 'cell',
    '[attr.aria-colindex]': 'ngpTableCell() + 1',
  },
})
export class NgpTableCellDirective {
  // aria-colindex is 1-based per WAI-ARIA; the input is the 0-based column position.
  readonly ngpTableCell: InputSignal<number> = input.required<number>();
}
