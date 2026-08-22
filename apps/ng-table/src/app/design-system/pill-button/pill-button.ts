import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { PillButtonVariant } from './pill-button.types';

/**
 * Attribute-selector on a real `<button>` (not a wrapping custom element) — required so
 * ARIA/directive wiring from a caller (e.g. `[ngpMenuTrigger]` in `dropdown-pill`) lands on the
 * actual focusable element instead of an inert host tag. See `docs/decisions.md`.
 */
@Component({
  selector: 'button[ngptPillButton]',
  templateUrl: './pill-button.html',
  styleUrl: './pill-button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    type: 'button',
    '[attr.data-variant]': 'variant()',
    '[disabled]': 'disabled() || null',
  },
})
export class PillButton {
  readonly variant = input<PillButtonVariant>('default');
  readonly disabled = input<boolean>(false);
}
