import { Directive, ElementRef, afterRenderEffect, inject, input } from '@angular/core';
import type { RowId } from '../api/types';

/**
 * Demo-only opt-in pattern (not part of the table's public directive surface): moves focus into
 * `tr[data-row-new="<id>"] input` once that row has rendered. Consumers who want this decide it
 * for their own flow — the table itself never assumes a newly-inserted row should grab focus.
 */
@Directive({
  selector: '[ngpFocusNewRow]',
})
export class FocusNewRowDirective {
  readonly ngpFocusNewRow = input<RowId | null>(null);

  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterRenderEffect({
      write: () => {
        const id = this.ngpFocusNewRow();
        if (id === null) return;
        this.elementRef.nativeElement
          .querySelector<HTMLInputElement>(`tr[data-row-new="${id}"] input`)
          ?.focus();
      },
    });
  }
}
