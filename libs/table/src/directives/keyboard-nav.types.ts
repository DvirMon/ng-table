import type { RowId } from '../api/types';

/** The row and column ids of the body, in render order, that arrow-key navigation walks. */
export type NavOrder = {
  readonly rowIds: readonly RowId[];
  readonly columnIds: readonly string[];
};

/** A body cell addressed by its row id and column id. */
export type BodyCell = { readonly rowId: RowId; readonly columnId: string };

/** The subset of a keyboard event that navigation reads, so it can be tested without the DOM. */
export type NavKey = {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey?: boolean;
};
