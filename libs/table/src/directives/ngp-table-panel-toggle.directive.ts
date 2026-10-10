import { computed, Directive, effect, ElementRef, inject, type Signal } from '@angular/core';

import { hasExpansion } from './expansion.guard';
import { NgpTableCollapsibleTrigger } from './ngp-table-collapsible-trigger.directive';
import { NGP_TABLE_PANEL_REGISTRY } from './panel-registry';
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
@Directive({
  selector: 'button[ngpTablePanelToggle]',
  host: { '[attr.aria-controls]': 'controlsId()' },
})
export class NgpTablePanelToggleDirective extends NgpTableCollapsibleTrigger {
  private readonly row = inject(NGP_TABLE_ROW);
  private readonly table = inject(NGP_TABLE_STORE);
  private readonly registry = inject(NGP_TABLE_PANEL_REGISTRY);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly controlsId: Signal<string | null> = computed(
    (): string | null => this.registry.panelId(this.row.ngpTableRow().id)(),
  );

  protected override readonly isOpen: Signal<boolean> = computed((): boolean => {
    const table = this.table.ngpTable();
    return hasExpansion(table) && table.expansion().has(this.row.ngpTableRow().id);
  });

  constructor() {
    super();
    assertExpansionComposed(() => this.table.ngpTable());
    this.registerWithPanelRegistry();
  }

  // Note: keyed by host, so a reused view swapping rows never deletes another toggle's entry.
  private registerWithPanelRegistry(): void {
    const host = this.host.nativeElement;
    effect((onCleanup): void => {
      const id = this.row.ngpTableRow().id;
      this.registry.registerToggle(id, host);
      onCleanup(() => this.registry.unregisterToggle(id, host));
    });
  }

  protected override toggle(): void {
    const table = this.table.ngpTable();
    if (hasExpansion(table)) table.expansion.toggle(this.row.ngpTableRow().id);
  }
}
