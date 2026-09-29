import { computed, Directive, inject, type Signal } from '@angular/core';

import { NGP_TABLE_ROW } from './table.tokens';

// Presence-only attribute (ADR-0026 rule 1): `""` on a context row, absent otherwise.
@Directive({
  selector: 'tr[ngpTableRow][ngpTableTreeRow], div[ngpTableRow][ngpTableTreeRow]',
  host: {
    '[attr.data-context-row]': 'isContextRow() ? "" : null',
  },
})
export class NgpTableTreeRowDirective {
  private readonly row = inject(NGP_TABLE_ROW, { self: true });

  protected readonly isContextRow: Signal<boolean> = computed(
    (): boolean => this.row.ngpTableRow().isContextRow === true,
  );
}
