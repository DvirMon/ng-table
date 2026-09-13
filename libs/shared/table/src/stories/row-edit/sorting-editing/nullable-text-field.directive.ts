import { Directive, model, output } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';

/**
 * `FormValueControl<string | null>` hosted directly on a native `<input>` — no wrapper
 * component. Signal Forms' native `[formField]` binding only supports `string` or
 * `number | null` (angular/angular#65839), not a nullable string; directive-hosted
 * `FormValueControl` (angular/angular#65450) is the documented escape hatch for a value type
 * the native binding can't express, keeping full `FormField` wiring (validation, touched/dirty,
 * `debounce('blur')` via `touch`).
 */
@Directive({
  selector: 'input[ngpNullableTextField]',
  host: {
    '[value]': 'value() ?? ""',
    '(input)': 'onInput($event)',
    '(blur)': 'touch.emit()',
  },
})
export class NullableTextFieldDirective implements FormValueControl<string | null> {
  readonly value = model<string | null>(null);
  readonly touch = output<void>();

  protected onInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    const trimmed = target.value.trim();
    this.value.set(trimmed === '' ? null : trimmed);
  }
}
