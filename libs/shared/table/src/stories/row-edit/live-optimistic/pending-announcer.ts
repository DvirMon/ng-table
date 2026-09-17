import { effect, signal, type Signal } from '@angular/core';
import type { RowId } from '../../../api/types';

/**
 * Announces once per pending-state transition (a row entering or leaving `pending()`), not per
 * keystroke — `pending()` only changes at capture/settle points (focus/blur+fetch), never
 * mid-typing. Owns the transition-diff effect; must be created in an injection context.
 */
export function createPendingAnnouncer(pending: Signal<ReadonlySet<RowId>>): Signal<string> {
  const announcement = signal('');
  let previousPending: ReadonlySet<RowId> = new Set();

  effect(() => {
    const currentPending = pending();
    const entered = [...currentPending].filter((id) => !previousPending.has(id));
    const left = [...previousPending].filter((id) => !currentPending.has(id));

    if (entered.length > 0) {
      announcement.set(`Saving ${entered.length} row${entered.length > 1 ? 's' : ''}…`);
    } else if (left.length > 0) {
      announcement.set('Save complete.');
    }
    previousPending = currentPending;
  });

  return announcement.asReadonly();
}
