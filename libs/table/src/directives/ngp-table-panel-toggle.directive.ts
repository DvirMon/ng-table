import { computed, Directive, inject, type Signal } from '@angular/core';

import { hasExpansion } from './expansion.guard';
import { NgpTableCollapsibleTrigger } from './ngp-table-collapsible-trigger.directive';
import { NGP_TABLE_ROW, NGP_TABLE_STORE } from './table.tokens';

function assertExpansionComposed(readTable: () => unknown): void {
  if (typeof ngDevMode === 'undefined' || !ngDevMode) return;
  if (hasExpansion(readTable())) return;
  throw new Error(
    'ngpTablePanelToggle requires a table created with withExpansion(); add withExpansion() to createTable().',
  );
}

/**
 * Opens and closes its row's detail panel through `table.expansion.toggle()`.
 *
 * @remarks
 * The type is always `button`. Sets `aria-expanded` and `data-expanded` from the table's
 * expansion state, so the button follows a row opened by any other path. Note: throws in dev
 * mode unless the table composes `withExpansion()`.
 *
 * @example
 * <button ngpTablePanelToggle
 *   [attr.aria-label]="'Details of ' + row.id">▸</button>
 */
@Directive({ selector: 'button[ngpTablePanelToggle]' })
export class NgpTablePanelToggleDirective extends NgpTableCollapsibleTrigger {
  private readonly row = inject(NGP_TABLE_ROW);
  private readonly table = inject(NGP_TABLE_STORE);

  protected override readonly isOpen: Signal<boolean> = computed((): boolean => {
    const table = this.table.ngpTable();
    return hasExpansion(table) && table.expansion().has(this.row.ngpTableRow().id);
  });

  constructor() {
    super();
    assertExpansionComposed(() => this.table.ngpTable());
  }

  protected override toggle(): void {
    const table = this.table.ngpTable();
    if (hasExpansion(table)) table.expansion.toggle(this.row.ngpTableRow().id);
  }
}
