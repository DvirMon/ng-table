import type { RowId } from '../../../api/types';

/** Owner of a deal — an object on the row rather than a flattened field, so the `owner` column
 * has to declare an `accessor` to say which part of it a cell and a group key read. */
export interface DealOwner {
  name: string;
  email: string;
}

/** Fixture row for the grouping stories. `region` → `category` → `rep` are the three grouping
 * levels; `region` is nullable *and* optional so the blank-key cases (`null`, `undefined`, `''`)
 * all exist in the data. `amount` is the aggregated column, `closedAt` a `Date` level, `owner` an
 * object read through an `accessor`, and `parentId` links a flat row to its parent so a deal can
 * be expandable alongside grouping — `null` means root. */
export interface DealRow {
  id: RowId;
  region?: string | null;
  category: string;
  rep: string;
  amount: number;
  closedAt: Date;
  owner: DealOwner;
  parentId: string | null;
}

/** `GET /api/grouped-rows` response shape. */
export interface DealPage {
  rows: DealRow[];
  total: number;
}
