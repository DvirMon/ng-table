import type { SortEditRow } from './sorting-editing.types';

const SAVE_LATENCY_MS = 400;

/** Maps a column's sort direction to the `aria-sort` value for its `<th>` — `undefined`/no entry
 * reads as `'none'`, matching `table.sortDirections()`'s "unsorted columns are absent" shape. */
export function sortAriaValue(
  direction: 'asc' | 'desc' | undefined,
): 'ascending' | 'descending' | 'none' {
  switch (direction) {
    case 'asc':
      return 'ascending';
    case 'desc':
      return 'descending';
    default:
      return 'none';
  }
}

/** Pessimistic-save stand-in, mirroring `row-edit.utils.ts`'s `saveRowPessimistic` but scoped to
 * `SortEditRow` — kept local per this story's file-independence (see `sorting-editing.types.ts`).
 * Rejects a blank name so the failure path stays reachable without an external mock. */
export function saveSortEditRow(row: SortEditRow): Promise<SortEditRow> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (row.name.trim() === '') {
        reject(new Error('Rejected: row needs a name.'));
        return;
      }
      resolve(row);
    }, SAVE_LATENCY_MS);
  });
}
