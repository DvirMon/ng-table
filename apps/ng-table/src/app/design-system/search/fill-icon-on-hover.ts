import { Directive, ElementRef, Renderer2, inject } from '@angular/core';

/**
 * Sets `fill` directly on the icon's inner `<path>` via `Renderer2` instead of a CSS descendant
 * selector. `<ng-icon>` inserts its svg through raw DOM insertion (not Angular's template
 * compiler), so the svg never carries this component's `_ngcontent` id and no scoped CSS
 * selector can ever reach it — see search/docs/decisions.md.
 */
@Directive({
  selector: 'button[ngptFillIconOnHover]',
  host: {
    '(mouseenter)': 'setFilled(true)',
    '(mouseleave)': 'setFilled(false)',
    '(focus)': 'setFilled(true)',
    '(blur)': 'setFilled(false)',
  },
})
export class FillIconOnHover {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly renderer = inject(Renderer2);

  protected setFilled(filled: boolean): void {
    const path = this.host.querySelector('svg path');
    if (path) {
      this.renderer.setStyle(path, 'fill', filled ? 'currentColor' : 'none');
    }
  }
}
