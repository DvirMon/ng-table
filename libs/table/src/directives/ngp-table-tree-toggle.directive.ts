import { computed, Directive, inject, type Signal } from '@angular/core';

import { hasTree } from './has-tree';
import { NgpTableCollapsibleTrigger } from './ngp-table-collapsible-trigger.directive';
import { NGP_TABLE_ROW, NGP_TABLE_STORE } from './table.tokens';

function assertTreeComposed(readTable: () => unknown): void {
  if (typeof ngDevMode === 'undefined' || !ngDevMode) return;
  if (hasTree(readTable())) return;
  throw new Error(
    'ngpTableTreeToggle requires a table created with withTree(); add withTree() to createTable().',
  );
}

/**
 * Toggles its row's children open or closed through `table.tree.toggle()`.
 *
 * @remarks
 * The type is always `button`, out of the Tab order (`tabindex="-1"`) and hidden from assistive
 * technology (`aria-hidden="true"`); the row carries `aria-expanded`. Sets `data-expanded`; on a
 * leaf row the button is also disabled. Pointer-only: keyboard users expand and collapse through
 * the row. A click toggles the row and moves focus to it, except on a group header, which is not
 * a focus stop. Note: throws in dev mode unless the table composes `withTree()`.
 *
 * @example
 * <button ngpTableTreeToggle>▸</button>
 */
@Directive({
  selector: 'button[ngpTableTreeToggle]',
  host: {
    '[attr.disabled]': 'isLeaf() ? "" : null',
    '[attr.data-disabled]': 'isLeaf() ? "" : null',
    '[attr.tabindex]': '"-1"',
    '[attr.aria-hidden]': '"true"',
  },
})
export class NgpTableTreeToggleDirective extends NgpTableCollapsibleTrigger {
  private readonly row = inject(NGP_TABLE_ROW);
  private readonly table = inject(NGP_TABLE_STORE);

  protected readonly isLeaf: Signal<boolean> = computed(
    (): boolean => this.row.ngpTableRow().hasChildren !== true,
  );
  protected override readonly isOpen: Signal<boolean> = computed(
    (): boolean => this.row.ngpTableRow().isExpanded === true,
  );

  constructor() {
    super();
    assertTreeComposed(() => this.table.ngpTable());
  }

  protected override toggle(): void {
    const table = this.table.ngpTable();
    if (!hasTree(table)) return;
    const { id: rowId, kind } = this.row.ngpTableRow();
    table.tree.toggle(rowId);
    // Note: a group header registers no focus stop, so moving focus there would leave the grid
    // with no `tabindex="0"`.
    if (kind === 'group') return;
    table.focus.moveTo({ area: 'body', rowId, columnId: null }, { focusElement: true });
  }
}
