import { ChangeDetectionStrategy, Component, ElementRef, inject, input } from '@angular/core';
import type { PillButtonVariant } from './pill-button.types';

/**
 * Attribute-selector on a real `<button>` or `<a>` (not a wrapping custom element) — required so
 * ARIA/directive wiring from a caller (e.g. `[ngpMenuTrigger]` in `dropdown-pill`) lands on the
 * actual focusable element instead of an inert host tag. See `docs/decisions.md`.
 *
 * No `disabled` input: the consumer sets the native attribute on the `<button>`, and
 * `:host(:disabled)` in the stylesheet reacts to it (ADR-0005 — never re-declare native
 * capability as an input).
 */
@Component({
  selector: 'button[ngptPillButton], a[ngptPillButton]',
  templateUrl: './pill-button.html',
  styleUrl: './pill-button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-variant]': 'variant()',
  },
})
export class PillButton {
  readonly variant = input<PillButtonVariant>('default');

  constructor() {
    // A bare <button> defaults to type="submit" inside a form, which this never wants. Set as a
    // default rather than a host binding so a consumer's own type="submit" still wins, and skip
    // <a> entirely — `type` means something else there.
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    if (host.tagName === 'BUTTON' && !host.hasAttribute('type')) {
      host.setAttribute('type', 'button');
    }
  }
}
