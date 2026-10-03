import { Directive, type Signal } from '@angular/core';

/**
 * Shared trigger bindings for a button that opens and closes a region.
 *
 * @remarks
 * Internal base: concrete toggles extend it and supply `isOpen` and `toggle()`.
 */
@Directive({
  host: {
    '[attr.type]': '"button"',
    '(click)': 'toggle()',
    '[attr.aria-expanded]': 'isOpen() ? "true" : "false"',
    '[attr.data-expanded]': 'isOpen() ? "" : null',
  },
})
export abstract class NgpTableCollapsibleTrigger {
  protected abstract readonly isOpen: Signal<boolean>;
  protected abstract toggle(): void;
}
