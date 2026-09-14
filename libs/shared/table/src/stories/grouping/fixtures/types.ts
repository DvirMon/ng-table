import type { RowId } from '../../../api/types';

/** Owner of a deal — an object-valued column, kept as a field rather than flattened so a
 * grouping level can be pointed at it. */
export interface DealOwner {
  name: string;
  email: string;
}

/** Fixture row for the grouping stories. `region` → `category` → `rep` are the three grouping
 * levels; `region` is nullable *and* optional so the blank-key cases (`null`, `undefined`, `''`)
 * all exist in the data. `amount` is the aggregated column, `closedAt` a `Date` level, `owner`
 * an object level, and `children` makes a row expandable alongside grouping. */
export interface DealRow {
  id: RowId;
  region?: string | null;
  category: string;
  rep: string;
  amount: number;
  closedAt: Date;
  owner: DealOwner;
  children?: DealRow[];
}

/** `GET /api/grouped-rows` response shape. */
export interface DealPage {
  rows: DealRow[];
  total: number;
}
