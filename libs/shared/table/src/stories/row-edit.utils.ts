import type { EditRow } from './row-edit.types';

const SAVE_LATENCY_MS = 700;

/** Pessimistic-save stand-in (S2, S5): the row stays open for the whole round trip. Rejects a
 * blank name so the failure path is reachable without an external mock. */
export function saveRowPessimistic(row: EditRow): Promise<EditRow> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (row.name.trim() === '') {
        reject(new Error(`Rejected: "${row.dept}" row needs a name.`));
        return;
      }
      resolve(row);
    }, SAVE_LATENCY_MS);
  });
}
