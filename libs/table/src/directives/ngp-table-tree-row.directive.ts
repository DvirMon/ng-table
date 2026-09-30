import { computed, Directive, inject, type Signal } from '@angular/core';

import { NGP_TABLE_ROW } from './table.tokens';

/**
 * Marks a tree row with presence-only `data-context-row` (ancestor kept for a filter match),
 * `data-expandable` (has children) and `data-expanded` (currently open).
 *
 * @example
 * <tr [ngpTableRow]="row" ngpTableTreeRow>…</tr>
 */
@Directive({
  selector: 'tr[ngpTableRow][ngpTableTreeRow], div[ngpTableRow][ngpTableTreeRow]',
  host: {
    // Note: `""` or absent, never "true"/"false" (ADR-0026 rule 1).
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
