import type { FieldTree } from '@angular/forms/signals';

import type { RenderRow } from '../api/types';

/**
 * Narrows the result of indexing a Signal Forms array field to `FieldTree<TRow>`, using
 * `RenderRow.sourceIndex` to decide whether an entry exists at all.
 *
 * Indexing `FieldTree<TRow[]>` at a number yields `MaybeFieldTree<TRow, number>`; TS cannot
 * reduce that back to `FieldTree<TRow> | undefined` while `TRow` is an unresolved generic
 * (TS2322), so the assertion below is required — made once here rather than at every call site.
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
