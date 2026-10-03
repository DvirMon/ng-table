import { computed, Directive, input, type InputSignal, type Signal } from '@angular/core';

import { createPanelRegistry, NGP_TABLE_PANEL_REGISTRY } from './panel-registry';
import { NGP_TABLE_STORE } from './table.tokens';
import type { ColumnValueMap, TableStore } from '../api/types';

/**
 * Binds a `createTable()` store to a native `<table>` or `<div>` grid host.
 *
 * @remarks
 * Provides the store and a per-table panel registry to the row, cell and panel directives
 * inside it, and sets `role="table"`, `aria-rowcount` and `aria-colcount`.
 *
 * @example
 * <table [ngpTable]="table"></table>
 */
@Directive({
  selector: 'table[ngpTable], div[ngpTable]',
  providers: [
    { provide: NGP_TABLE_STORE, useExisting: NgpTableDirective },
    { provide: NGP_TABLE_PANEL_REGISTRY, useFactory: createPanelRegistry },
  ],
  host: {
    // Set even on native `<table>`: an explicit role matching the implicit native one is a
    // documented no-op, not a conflict, so one directive serves both host tags.
    role: 'table',
    '[attr.aria-rowcount]': 'ariaRowCount()',
    '[attr.aria-colcount]': 'ariaColCount()',
  },
})
export class NgpTableDirective<TRow = unknown, TValues extends ColumnValueMap = ColumnValueMap> {
  /** The table store this host renders. */
  readonly ngpTable: InputSignal<TableStore<TRow, TValues>> =
    input.required<TableStore<TRow, TValues>>();

  readonly ariaRowCount: Signal<number> = computed(() => this.ngpTable().totalRowCount());
  readonly ariaColCount: Signal<number> = computed(() => this.ngpTable().columns().length);
}
