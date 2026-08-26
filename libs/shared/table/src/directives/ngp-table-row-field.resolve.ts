import type { FieldTree } from '@angular/forms/signals';

import type { RenderRow } from '../api/types';

/**
 * Narrows the result of indexing a Signal Forms array field to `FieldTree<TRow>`, using
 * `RenderRow.sourceIndex` to decide whether an entry exists at all.
 *
 * Indexing `FieldTree<TRow[]>` at a number yields `MaybeFieldTree<TRow, number>` —
 * `(TRow & undefined) | FieldTree<Exclude<TRow, undefined>, number>`. TS cannot reduce
 * `Exclude<TRow, undefined>` back to `TRow` while `TRow` is an unresolved generic (TS2322),
 * so the result cannot be assigned to `FieldTree<TRow> | undefined` without an assertion. This
 * is the same algebra that made `fieldFor()` untypeable (D23) — the assertion is made once,
 * here, at the one place the whole directive funnels through, instead of at every call site a
 * resolver function would have required. See D23/D33,
 * `docs/1-state/work/with-row-editing/2-decisions.md`.
 */
export function resolveRowField<TRow>(
  form: FieldTree<TRow[]>,
  row: RenderRow<TRow>
): FieldTree<TRow> | undefined {
  const { sourceIndex } = row;
  if (sourceIndex === undefined) {
    return undefined;
  }
  return form[sourceIndex] as unknown as FieldTree<TRow>;
}
