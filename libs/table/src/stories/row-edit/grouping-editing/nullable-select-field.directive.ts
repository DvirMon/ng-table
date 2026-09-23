import { Directive, model, output } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';

/**
 * `FormValueControl<string | null>` hosted on a native `<select>` — same escape hatch as
 * `sorting-editing/nullable-text-field.directive.ts`'s `NullableTextFieldDirective`, for a value
 * type native `[formField]` can't express (angular/angular#65839: only `string` or
 * `number | null` are supported directly). `''` is the select's own "nothing picked" sentinel,
 * mapped to `null`.
 */
@Directive({
  selector: 'select[ngpNullableSelectField]',
  host: {
    '[value]': 'value() ?? ""',
    '(change)': 'onChange($event)',
  },
})
export class NullableSelectFieldDirective implements FormValueControl<string | null> {
  readonly value = model<string | null>(null);
  readonly touch = output<void>();

  protected onChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) {
      return;
    }
    this.value.set(target.value === '' ? null : target.value);
    this.touch.emit();
  }
}
