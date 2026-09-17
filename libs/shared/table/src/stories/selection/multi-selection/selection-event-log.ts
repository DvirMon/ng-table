import { signal, type Signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { Observable } from 'rxjs';
import type { SelectionChange } from '../../../api/features/with-selection';

export interface SelectionEventLog {
  readonly entries: Signal<readonly string[]>;
}

/** Appends one line per `selectionChanged` delta. Owns the subscription, so it must be created
 * in an injection context. Demo-only instrumentation: it is the only surface on which a
 * single-delta clear (D9) and a silent reconciliation prune (D11, no emission at all) are
 * distinguishable from each other. */
export function createSelectionEventLog(
  changes: Observable<SelectionChange>
): SelectionEventLog {
  const entries = signal<readonly string[]>([]);

  changes.pipe(takeUntilDestroyed()).subscribe((change) => {
    entries.update((current) => [...current, describeDelta(change)]);
  });

  return { entries: entries.asReadonly() };
}

function describeDelta(change: SelectionChange): string {
  const parts: string[] = [];
  if (change.added.length > 0) {
    parts.push(`+${change.added.join(', ')}`);
  }
  if (change.removed.length > 0) {
    parts.push(`-${change.removed.join(', ')}`);
  }
  return `selectionChanged { ${parts.join('  ')} }`;
}
