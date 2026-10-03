import {
  computed,
  Directive,
  ElementRef,
  inject,
  input,
  type OnDestroy,
  type OnInit,
  type Signal,
} from '@angular/core';

import { NGP_TABLE_PANEL_REGISTRY } from './panel-registry';
import { NGP_TABLE_STORE } from './table.tokens';
import type { ExpansionMembers } from '../api/features/with-expansion';
import type { RowId } from '../api/types';

function hasExpansion(table: unknown): table is ExpansionMembers {
  if (typeof table !== 'object' || table === null || !('expansion' in table)) return false;
  return typeof table.expansion === 'function' && 'expand' in table.expansion;
}

function assertExpansionComposed(readTable: () => unknown): void {
  if (typeof ngDevMode === 'undefined' || !ngDevMode) return;
  if (hasExpansion(readTable())) return;
  throw new Error(
    'ngpTablePanel requires a table created with withExpansion(); add withExpansion() to createTable().',
  );
}

/**
 * Marks an element as the detail panel of one row.
 *
 * @remarks
 * Mints a table-scoped `id` that stays the same across close and reopen, and sets the
 * `inert` attribute while the row is closed. Note: throws in dev mode unless the table
 * composes `withExpansion()`, and when a second panel registers for the same row.
 *
 * @example
 * <div [ngpTablePanel]="row.id" role="region"></div>
 */
@Directive({
  selector: '[ngpTablePanel]',
  host: { '[id]': 'panelId', '[attr.inert]': 'isOpen() ? null : ""' },
})
export class NgpTablePanelDirective implements OnInit, OnDestroy {
  readonly ngpTablePanel = input.required<RowId>();

  private readonly table = inject(NGP_TABLE_STORE);
  private readonly registry = inject(NGP_TABLE_PANEL_REGISTRY);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected panelId = '';
  private registeredId: RowId | null = null;

  protected readonly isOpen: Signal<boolean> = computed((): boolean => {
    const table = this.table.ngpTable();
    return hasExpansion(table) && table.expansion().has(this.ngpTablePanel());
  });

  ngOnInit(): void {
    assertExpansionComposed(() => this.table.ngpTable());
    const id = this.ngpTablePanel();
    this.panelId = this.registry.registerPanel(id, this.host.nativeElement);
    this.registeredId = id;
  }

  ngOnDestroy(): void {
    if (this.registeredId === null) return;
    this.registry.unregisterPanel(this.registeredId);
  }
}
