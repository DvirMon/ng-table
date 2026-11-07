import { computed, Directive, ElementRef, inject, type Signal } from '@angular/core';

import { NGP_TABLE_ROW, NGP_TABLE_STORE } from './table.tokens';
import type { TreeMembers } from '../api/features/with-tree/types';

function hasTree(table: unknown): table is TreeMembers {
  return typeof table === 'object' && table !== null && 'tree' in table;
}

/**
 * Marks a tree row with presence-only `data-context-row` (ancestor kept for a filter match),
 * `data-expandable` (has children) and `data-expanded` (currently open).
 *
 * @remarks
 * Also sets `aria-level` (depth + 1) and, on an expandable row only, `aria-expanded`. With the
 * row itself focused, → expands, ← collapses (swapped under RTL) and Enter toggles an expandable
 * row. Keys from a cell or widget inside the row are left alone.
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
    '[attr.aria-level]': 'ariaLevel()',
    '[attr.aria-expanded]': 'isExpandable() ? (isExpanded() ? "true" : "false") : null',
    '(keydown)': 'toggleOnKeydown($event)',
  },
})
export class NgpTableTreeRowDirective {
  private readonly row = inject(NGP_TABLE_ROW, { self: true });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly store = inject(NGP_TABLE_STORE, { optional: true });

  protected readonly ariaLevel: Signal<number> = computed(
    (): number => this.row.ngpTableRow().depth + 1,
  );

  protected readonly isContextRow: Signal<boolean> = computed(
    (): boolean => this.row.ngpTableRow().isContextRow === true,
  );

  protected readonly isExpandable: Signal<boolean> = computed(
    (): boolean => this.row.ngpTableRow().hasChildren === true,
  );

  protected readonly isExpanded: Signal<boolean> = computed(
    (): boolean => this.row.ngpTableRow().isExpanded === true,
  );

  protected toggleOnKeydown(event: Event): void {
    if (!(event instanceof KeyboardEvent)) return;
    if (event.target !== this.host) return;
    const store = this.store;
    if (store === null) return;
    const table = store.ngpTable();
    if (!hasTree(table)) return;

    const isExpandable = this.isExpandable();
    const isExpanded = this.isExpanded();
    const isRtl = store.isRtl();
    const expandKey = isRtl ? 'ArrowLeft' : 'ArrowRight';
    const collapseKey = isRtl ? 'ArrowRight' : 'ArrowLeft';
    const id = this.row.ngpTableRow().id;

    const shouldExpand = event.key === expandKey && isExpandable && !isExpanded;
    const shouldCollapse = event.key === collapseKey && isExpandable && isExpanded;
    const shouldToggle = event.key === 'Enter' && isExpandable;

    if (shouldExpand) table.tree.expand([id]);
    else if (shouldCollapse) table.tree.collapse([id]);
    else if (shouldToggle) table.tree.toggle(id);
    else return;
    event.preventDefault();
  }
}
