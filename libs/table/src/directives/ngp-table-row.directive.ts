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

import { NGP_TABLE_ROW, NGP_TABLE_STORE } from './table.tokens';
import type { RenderRow, RowId } from '../api/types';

// Dual-tag selector, role set unconditionally regardless of host tag.
@Directive({
  selector: 'tr[ngpTableRow], div[ngpTableRow]',
  providers: [{ provide: NGP_TABLE_ROW, useExisting: NgpTableRowDirective }],
  host: {
    role: 'row',
    '[attr.data-row-kind]': 'ngpTableRow().kind',
    '[attr.data-depth]': 'ngpTableRow().depth',
    // aria-rowindex is 1-based per WAI-ARIA; `ngpTableRow().index` is the 0-based array position.
    '[attr.aria-rowindex]': 'ngpTableRow().index + 1',
    '[attr.aria-expanded]': 'ngpTableRow().isExpanded ?? null',
    // FLIP row-reorder animation — same mechanism verified in the `table-demo` prototype:
    // transform written directly on the row (not via a `var()`-indirected custom property),
    // transition gated by a class the consumer's own CSS defines. See row-animation.md.
    '[style.transform]': 'flipTransform()',
    '[class.ngp-table-row--flip]': 'isFlipping()',
  },
})
export class NgpTableRowDirective<TRow = unknown> {
  readonly ngpTableRow: InputSignal<RenderRow<TRow>> = input.required<RenderRow<TRow>>();

  readonly rowId: Signal<RowId> = computed(() => this.ngpTableRow().id);
  readonly isGroupHeader: Signal<boolean> = computed(() => this.ngpTableRow().kind === 'group');

  // Optional: absent when `ngpTableRow` is used outside an `ngpTable`-hosted table.
  private readonly parentTable = inject(NGP_TABLE_STORE, { optional: true });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly flipOffset: Signal<number> = computed(
    () => this.parentTable?.flipOffsetFor(this.rowId()) ?? 0,
  );
  readonly flipTransform: Signal<string> = computed(() => {
    const offset = this.flipOffset();
    return offset !== 0 ? `translateY(${offset}px)` : '';
  });
  readonly isFlipping: Signal<boolean> = computed(() => this.parentTable?.isRowFlipping() ?? false);

  constructor() {
    const element = this.host.nativeElement;

    // `rowId()` reads the required `ngpTableRow` input, unset until after construction — defer
    // via `effect()` (matches `ngp-table.directive.ts`'s own constructor pattern). `@for` tracks
    // by row id, so this instance's id never changes and the effect runs exactly once.
    effect(() => {
      this.parentTable?.registerRowElement(this.rowId(), element);
    });

    inject(DestroyRef).onDestroy(() => {
      this.parentTable?.unregisterRowElement(this.rowId(), element);
    });
  }
}
