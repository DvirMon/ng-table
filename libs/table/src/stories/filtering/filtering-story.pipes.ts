import { Pipe, type PipeTransform } from '@angular/core';
import { toDateInputValue } from './fixtures/utils';

/**
 * Renders the time of day when a row carries one — the 16:45 invoice is why a same-day `to`
 * bound excludes it, and a cell showing only the date would hide the reason.
 */
@Pipe({ name: 'invoiceIssuedAt' })
export class InvoiceIssuedAtPipe implements PipeTransform {
  transform(value: Date): string {
    const day = toDateInputValue(value);
    const hasTimeOfDay = value.getHours() !== 0 || value.getMinutes() !== 0;
    if (!hasTimeOfDay) {
      return day;
    }
    const hours = String(value.getHours()).padStart(2, '0');
    const minutes = String(value.getMinutes()).padStart(2, '0');
    return `${day} ${hours}:${minutes}`;
  }
}

/** Every pipe above, for a story host's `imports`. */
export const FILTERING_STORY_PIPES = [InvoiceIssuedAtPipe] as const;
