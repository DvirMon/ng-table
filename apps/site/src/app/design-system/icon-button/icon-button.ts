import { ChangeDetectionStrategy, Component, ElementRef, inject, input } from '@angular/core';
import type { IconButtonSize } from './icon-button.types';

/**
 * Attribute-hosted on a real `<button>` (ADR-0005) — the host *is* the button, so there is no
 * wrapper element and no re-plumbed native capability. Chrome and sizing only:
 *
 * - The glyph is consumer-authored (`<ng-icon>` projected through `<ng-content />`), so this
 *   component registers no icons at all. Consumers register what they use (ADR-0004).
 * - `aria-label` / `title` / `disabled` / `type` are native attributes the consumer sets directly.
 * - Copy-confirmation behavior lives in `[ngptCopyConfirm]`, a directive the consumer places
 *   beside this one. This stylesheet still reacts to the `data-copy-state` attribute that
 *   directive writes — the attribute is the contract between the two.
 */
@Component({
  selector: 'button[ngptIconButton]',
  templateUrl: './icon-button.html',
  styleUrl: './icon-button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-size]': 'size()',
  },
})
export class IconButton {
  readonly size = input<IconButtonSize>(30);

  constructor() {
    // A bare <button> defaults to type="submit" inside a form, which this never wants. Set as a
    // default rather than a host binding so a consumer's own type="submit" still wins.
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    if (!host.hasAttribute('type')) {
      host.setAttribute('type', 'button');
    }
  }
}
