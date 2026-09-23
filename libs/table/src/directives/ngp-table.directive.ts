import { computed, Directive, input, type InputSignal, type Signal } from '@angular/core';

import { NGP_TABLE_STORE } from './table.tokens';
import type { TableStore } from '../api/types';

// Dual-tag selector, native `<table>` and `<div>` grid share one directive. `role` is set
// unconditionally, even on native `<table>` — an explicit role matching the implicit native
// one is a documented no-op, not a conflict.
@Directive({
  selector: 'table[ngpTable], div[ngpTable]',
  providers: [{ provide: NGP_TABLE_STORE, useExisting: NgpTableDirective }],
  host: {
    role: 'table',
    '[attr.aria-rowcount]': 'ariaRowCount()',
    '[attr.aria-colcount]': 'ariaColCount()',
  },
})
export class NgpTableDirective<TRow = unknown> {
  readonly ngpTable: InputSignal<TableStore<TRow>> = input.required<TableStore<TRow>>();

  readonly ariaRowCount: Signal<number> = computed(() => this.ngpTable().totalRowCount());
  readonly ariaColCount: Signal<number> = computed(() => this.ngpTable().columns().length);
}
