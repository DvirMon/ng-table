import type { RowId } from '../api/types';

export type NavOrder = {
  readonly rowIds: readonly RowId[];
  readonly columnIds: readonly string[];
};
export type BodyCell = { readonly rowId: RowId; readonly columnId: string };
export type NavKey = {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey?: boolean;
};
