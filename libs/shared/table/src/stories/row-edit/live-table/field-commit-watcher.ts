import { effect, type Signal } from '@angular/core';
import type { EditRow } from '../fixtures/types';
import type { EditableField, FieldCommit } from './live-table.types';

/**
 * Diffs each `data()` emission against the previous one and reports the first changed editable
 * field per row as a `FieldCommit` — the live table's only commit signal, since there is no
 * separate Save. Owns the previous-snapshot closure and the diffing effect, so it must be called
 * from an injection context (a component constructor).
 */
export function watchFieldCommits(
  data: Signal<EditRow[]>,
  fields: readonly EditableField[],
  onCommit: (commit: FieldCommit) => void,
): void {
  let previousData: EditRow[] = data();

  effect(() => {
    const current = data();
    const previousById = new Map(previousData.map((row) => [row.id, row]));

    for (const row of current) {
      const previousRow = previousById.get(row.id);
      if (previousRow === undefined) continue;

      const changedField = fields.find((field) => row[field] !== previousRow[field]);
      if (changedField === undefined) continue;

      onCommit({ row, previousRow, field: changedField });
    }

    previousData = current;
  });
}
