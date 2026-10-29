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
  readonly altKey?: boolean;
  readonly shiftKey?: boolean;
};

/** A column header cell addressed by its column id. */
export type HeaderCell = { readonly area: 'header'; readonly columnId: string };

/** A body cell tagged with its grid area. */
export type GridBodyCell = { readonly area: 'body' } & BodyCell;

/** Any cell grid navigation can address: a header cell or a body cell. */
export type GridCell = HeaderCell | GridBodyCell;

/** Inputs grid navigation needs beyond the key press: text direction and rows per page. */
export type GridNavOptions = { readonly isRtl: boolean; readonly pageSize: number };
