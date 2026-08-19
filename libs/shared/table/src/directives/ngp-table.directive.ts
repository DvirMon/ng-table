import { computed, Directive, input, type InputSignal, type Signal } from '@angular/core';

import { NGP_TABLE_STORE } from './tokens';
import type { TableStore } from '../api/types';

// ADR-0005: dual-tag selector, native `<table>` and `<div>` grid share one directive. `role`
// is set unconditionally, even on native `<table>` — an explicit role matching the implicit
// native one is a documented no-op, not a conflict (matches Angular CDK Table's own practice).
@Directive({
  selector: 'table[ngpTable], div[ngpTable]',
  providers: [{ provide: NGP_TABLE_STORE, useExisting: NgpTableDirective }],
  host: {
    role: 'table',
    '[attr.aria-rowcount]': 'ariaRowCount()',
    '[attr.aria-colcount]': 'ariaColCount()',
  },
})
export class NgpTableDirective {
  readonly store: InputSignal<TableStore<unknown>> = input.required<TableStore<unknown>>({
    alias: 'ngpTable',
  });

  readonly ariaRowCount: Signal<number> = computed(() => this.store().totalRowCount());
  readonly ariaColCount: Signal<number> = computed(() => this.store().columns().length);
}
