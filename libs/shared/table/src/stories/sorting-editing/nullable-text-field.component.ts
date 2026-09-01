import { Component, input, model, output } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';

/**
 * `FormValueControl<string | null>` — `FormField`'s native `<input>` binding only supports
 * `string` or `number | null` (angular/angular#65839, closed not-planned), not `string | null`.
 * This is the documented custom-control path instead, keeping full `FormField` wiring
 * (validation, touched/dirty, `debounce('blur')` via `touch`) for a nullable text field.
 */
@Component({
  selector: 'ngp-nullable-text-field',
  template: `
    <input
      type="text"
      [value]="value() ?? ''"
      [placeholder]="placeholder()"
      (input)="onInput($event)"
      (blur)="touch.emit()"
    />
  `,
})
export class NullableTextFieldComponent implements FormValueControl<string | null> {
  readonly value = model<string | null>(null);
  readonly placeholder = input<string>('');
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
