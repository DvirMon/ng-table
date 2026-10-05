import { linkedSignal, type WritableSignal } from '@angular/core';
import type { RowId, TrackByFn } from '../../types';
import { guardCallback, type ReportFlag } from './nest';
import type { WithTreeConfig } from './types';

// The context ids whose row passes `revealContextRow` (default: all). A throwing predicate
// reveals its row and reports once for this call (ADR-0014). Ids with no row in `rows` are
// skipped. Call once per evaluation — the report flag is created here, not at factory scope.
export function buildRevealedIds<TRow>(
  contextRowIds: ReadonlySet<RowId>,
  rows: readonly TRow[],
  trackBy: TrackByFn<TRow>,
  config: WithTreeConfig<TRow>,
): Set<RowId> {
  const revealed = new Set<RowId>();
  if (contextRowIds.size === 0) {
    return revealed;
  }
  const reveal = config.revealContextRow;
  const reported: ReportFlag = { done: false };
  const canReveal: (row: TRow) => boolean = reveal
    ? guardCallback<TRow, boolean>(
        reveal,
        reported,
        '[withTree] revealContextRow threw. The affected row(s) are revealed for this ' +
          'evaluation.',
        true,
      )
    : () => true;
  for (const row of rows) {
    const id = trackBy(row);
    if (contextRowIds.has(id) && canReveal(row)) {
      revealed.add(id);
    }
  }
  return revealed;
}

// Revealed rows the person closed. Keeps only ids still in the context set, so a row that stops
// being a context row is revealed again when it returns. Recomputes on read: always read it.
export function createClosedWhileRevealed(
  contextRowIds: () => ReadonlySet<RowId>,
): WritableSignal<ReadonlySet<RowId>> {
  return linkedSignal<ReadonlySet<RowId>, ReadonlySet<RowId>>({
    source: contextRowIds,
    computation: (context, previous) =>
      new Set([...(previous?.value ?? [])].filter((id) => context.has(id))),
  });
}
