import { Directive, input, type InputSignal } from '@angular/core';

// ADR-0005: separate directive from `NgpTableCellDirective`, not a shared directive with an
// `isHeader` boolean — matches Angular CDK's `CdkHeaderCell`/`CdkCell` split. Header-only
// concerns (`aria-sort`, sort-trigger affordance) belong here later, never on the data-cell
// directive's public API. `aria-sort` itself stays owned by the sort feature directive
// (`docs/3-ui/cross-cutting/accessibility.md`), not set by this base directive.
@Directive({
  selector: 'th[ngpTableHeaderCell], div[ngpTableHeaderCell]',
  host: {
    role: 'columnheader',
    '[attr.aria-colindex]': 'ngpTableHeaderCell() + 1',
  },
})
export class NgpTableHeaderCellDirective {
  // aria-colindex is 1-based per WAI-ARIA; the input is the 0-based column position.
  readonly ngpTableHeaderCell: InputSignal<number> = input.required<number>();
}
