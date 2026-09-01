import type { SortEditRow } from './sorting-editing.types';

const SAVE_LATENCY_MS = 400;

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
