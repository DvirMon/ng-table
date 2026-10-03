import { computed, Directive, input, type InputSignal, type Signal } from '@angular/core';

import { createPanelRegistry, NGP_TABLE_PANEL_REGISTRY } from './panel-registry';
import { NGP_TABLE_STORE } from './table.tokens';
import type { ColumnValueMap, TableStore } from '../api/types';

// Dual-tag selector, native `<table>` and `<div>` grid share one directive. `role` is set
// unconditionally, even on native `<table>` — an explicit role matching the implicit native
// one is a documented no-op, not a conflict.
@Directive({
  selector: 'table[ngpTable], div[ngpTable]',
  providers: [
    { provide: NGP_TABLE_STORE, useExisting: NgpTableDirective },
    { provide: NGP_TABLE_PANEL_REGISTRY, useFactory: createPanelRegistry },
  ],
  host: {
    role: 'table',
    '[attr.aria-rowcount]': 'ariaRowCount()',
    '[attr.aria-colcount]': 'ariaColCount()',
  },
})
export class NgpTableDirective<TRow = unknown, TValues extends ColumnValueMap = ColumnValueMap> {
  readonly ngpTable: InputSignal<TableStore<TRow, TValues>> =
    input.required<TableStore<TRow, TValues>>();

  readonly ariaRowCount: Signal<number> = computed(() => this.ngpTable().totalRowCount());
  readonly ariaColCount: Signal<number> = computed(() => this.ngpTable().columns().length);
}
