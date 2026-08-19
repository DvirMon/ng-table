import { computed, Directive, input, type InputSignal, type Signal } from '@angular/core';

import { NGP_TABLE_ROW } from './tokens';
import type { RenderRow, RowId } from '../api/types';

// ADR-0005: dual-tag selector, role set unconditionally regardless of host tag.
@Directive({
  selector: 'tr[ngpTableRow], div[ngpTableRow]',
  providers: [{ provide: NGP_TABLE_ROW, useExisting: NgpTableRowDirective }],
  host: {
    role: 'row',
    '[attr.data-row-kind]': 'ngpTableRow().kind',
    '[attr.data-depth]': 'ngpTableRow().depth',
    // aria-rowindex is 1-based per WAI-ARIA; `ngpTableRow().index` is the 0-based array position.
    '[attr.aria-rowindex]': 'ngpTableRow().index + 1',
    '[attr.aria-expanded]': 'ngpTableRow().isExpanded ?? null',
  },
})
export class NgpTableRowDirective<TRow = unknown> {
  readonly ngpTableRow: InputSignal<RenderRow<TRow>> = input.required<RenderRow<TRow>>();

  readonly rowId: Signal<RowId> = computed(() => this.ngpTableRow().id);
  readonly isGroupHeader: Signal<boolean> = computed(() => this.ngpTableRow().kind === 'group');
}
