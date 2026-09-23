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

import { NGP_TABLE_ROW, NGP_TABLE_ROW_ANIMATION } from './table.tokens';
import type { RenderRow, RowId } from '../api/types';

// Dual-tag selector, role set unconditionally regardless of host tag. FLIP move animation is
// opt-in via `ngpTableRowAnimation` on the host table (ngp-table-row-animation.directive.ts):
// offset reaches CSS via the `--ngp-table-row-flip-offset` custom property, gliding state via
// the `data-row-flipping` presence attribute — no inline `transform`, no bound class
// (ADR-0026). Without it, both are `null`/absent.
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
    '[style.--ngp-table-row-flip-offset]': 'flipOffsetStyle()',
    '[attr.data-row-flipping]': 'isFlipping() ? "" : null',
  },
})
export class NgpTableRowDirective<TRow = unknown> {
  readonly ngpTableRow: InputSignal<RenderRow<TRow>> = input.required<RenderRow<TRow>>();

  readonly rowId: Signal<RowId> = computed(() => this.ngpTableRow().id);
  readonly isGroupHeader: Signal<boolean> = computed(() => this.ngpTableRow().kind === 'group');

  // Optional: absent when the host table has no `ngpTableRowAnimation` directive.
  private readonly rowAnimation = inject(NGP_TABLE_ROW_ANIMATION, { optional: true });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly flipOffset: Signal<number> = computed(
    () => this.rowAnimation?.flipOffsetFor(this.rowId()) ?? 0,
  );
  /**
   * The FLIP offset as a CSS length for `--ngp-table-row-flip-offset`. `null` when there's no
   * animation directive on the host, or the offset is exactly 0 — no jitter threshold; browsers
   * no-op an imperceptible transform.
   */
  readonly flipOffsetStyle: Signal<string | null> = computed(() => {
    const offset = this.flipOffset();
    return offset !== 0 ? `${offset}px` : null;
  });
  readonly isFlipping: Signal<boolean> = computed(
    () => this.rowAnimation?.isRowFlipping() ?? false,
  );

  constructor() {
    const element = this.host.nativeElement;

    // `rowId()` reads the required `ngpTableRow` input, unset until after construction — defer
    // via `effect()`.
    // `@for` tracks by row id, so this instance's id never changes and the effect runs exactly
    // once.
    effect(() => {
      this.rowAnimation?.registerRowElement(this.rowId(), element);
    });

    inject(DestroyRef).onDestroy(() => {
      this.rowAnimation?.unregisterRowElement(this.rowId(), element);
    });
  }
}
