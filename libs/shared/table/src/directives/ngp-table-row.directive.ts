import { computed, Directive, input, type InputSignal, type Signal } from '@angular/core';

import { NGP_TABLE_ROW } from './tokens';
import type { RenderRow, RowId } from '../api/types';

// ADR-0005: dual-tag selector, role set unconditionally regardless of host tag.
@Directive({
  selector: 'tr[ngpTableRow], div[ngpTableRow]',
  providers: [{ provide: NGP_TABLE_ROW, useExisting: NgpTableRowDirective }],
  host: {
    role: 'row',
    '[attr.data-row-kind]': 'renderRow().kind',
    '[attr.data-depth]': 'renderRow().depth',
    // aria-rowindex is 1-based per WAI-ARIA; `renderRow().index` is the 0-based array position.
    '[attr.aria-rowindex]': 'renderRow().index + 1',
    '[attr.aria-expanded]': 'renderRow().isExpanded ?? null',
  },
})
export class NgpTableRowDirective {
  readonly renderRow: InputSignal<RenderRow<unknown>> = input.required<RenderRow<unknown>>({
    alias: 'ngpTableRow',
  });

  readonly rowId: Signal<RowId> = computed(() => this.renderRow().id);
  readonly isGroupHeader: Signal<boolean> = computed(() => this.renderRow().kind === 'group');
}
