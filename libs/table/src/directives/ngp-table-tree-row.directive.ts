import { computed, Directive, inject, type Signal } from '@angular/core';

import { NGP_TABLE_ROW } from './table.tokens';

// Presence-only attribute (ADR-0026 rule 1): `""` on a context row, absent otherwise.
/**
 * Marks tree rows with presence-only `data-context-row` (kept as an ancestor of a filter
 * match), `data-expandable` (has children) and `data-expanded` (currently expanded).
 */
@Directive({
  selector: 'tr[ngpTableRow][ngpTableTreeRow], div[ngpTableRow][ngpTableTreeRow]',
  host: {
    '[attr.data-context-row]': 'isContextRow() ? "" : null',
    '[attr.data-expandable]': 'isExpandable() ? "" : null',
    '[attr.data-expanded]': 'isExpanded() ? "" : null',
  },
})
export class NgpTableTreeRowDirective {
  private readonly row = inject(NGP_TABLE_ROW, { self: true });

  protected readonly isContextRow: Signal<boolean> = computed(
    (): boolean => this.row.ngpTableRow().isContextRow === true,
  );

  protected readonly isExpandable: Signal<boolean> = computed(
    (): boolean => this.row.ngpTableRow().hasChildren === true,
  );

  protected readonly isExpanded: Signal<boolean> = computed(
    (): boolean => this.row.ngpTableRow().isExpanded === true,
  );
}
