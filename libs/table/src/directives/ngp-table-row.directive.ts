import {
  computed,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  type InputSignal,
  type Signal,
} from '@angular/core';

import { NGP_TABLE_ROW, NGP_TABLE_ROW_MOVE } from './table.tokens';
import type { RenderRow, RowId } from '../api/types';

// Dual-tag selector, role set unconditionally regardless of host tag. FLIP move animation is
// opt-in via `ngpTableRowMove` on the host table (ngp-table-row-move.directive.ts),
// which animates the row itself; this directive only registers its element there.
@Directive({
  selector: 'tr[ngpTableRow], div[ngpTableRow]',
  providers: [{ provide: NGP_TABLE_ROW, useExisting: NgpTableRowDirective }],
  host: {
    role: 'row',
    '[attr.data-row-kind]': 'ngpTableRow().kind',
    '[attr.data-depth]': 'ngpTableRow().depth',
    // aria-rowindex is 1-based per WAI-ARIA; `ngpTableRow().index` is the 0-based array position.
    '[attr.aria-rowindex]': 'ngpTableRow().index + 1',
    '[style.--ngp-table-row-depth]': 'ngpTableRow().depth',
  },
})
export class NgpTableRowDirective<TRow = unknown> {
  readonly ngpTableRow: InputSignal<RenderRow<TRow>> = input.required<RenderRow<TRow>>();

  readonly rowId: Signal<RowId> = computed(() => this.ngpTableRow().id);
  readonly isGroupHeader: Signal<boolean> = computed(() => this.ngpTableRow().kind === 'group');

  // Optional: absent when the host table has no `ngpTableRowMove` directive.
  private readonly rowMove = inject(NGP_TABLE_ROW_MOVE, { optional: true });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const element = this.host.nativeElement;

    // `rowId()` reads the required `ngpTableRow` input, unset until after construction — defer
    // via `effect()`.
    // `@for` tracks by row id, so this instance's id never changes and the effect runs exactly
    // once.
    effect(() => {
      this.rowMove?.registerRowElement(this.rowId(), element);
    });

    inject(DestroyRef).onDestroy(() => {
      this.rowMove?.unregisterRowElement(this.rowId(), element);
    });
  }
}
