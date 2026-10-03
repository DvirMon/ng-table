import { computed, Directive, inject, type Signal } from '@angular/core';

import { NgpTableCollapsibleTrigger } from './ngp-table-collapsible-trigger.directive';
import { NGP_TABLE_ROW, NGP_TABLE_STORE } from './table.tokens';
import type { TreeMembers } from '../api/features/with-tree/types';

function hasTree(table: unknown): table is TreeMembers {
  if (typeof table !== 'object' || table === null || !('tree' in table)) return false;
  return typeof table.tree === 'function' && 'toggle' in table.tree;
}

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
 * The type is always `button`. Sets `aria-expanded` and `data-expanded`; on a leaf row the
 * button is disabled and `aria-hidden`, and shows `aria-expanded="false"`. Note: throws in dev
 * mode unless the table composes `withTree()`.
 *
 * @example
 * <button ngpTableTreeToggle
 *   [attr.aria-label]="'Children of ' + row.data.name">▸</button>
 */
@Directive({
  selector: 'button[ngpTableTreeToggle]',
  host: {
    '[attr.disabled]': 'isLeaf() ? "" : null',
    '[attr.aria-hidden]': 'isLeaf() ? "true" : null',
    '[attr.data-disabled]': 'isLeaf() ? "" : null',
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
    if (hasTree(table)) table.tree.toggle(this.row.ngpTableRow().id);
  }
}
