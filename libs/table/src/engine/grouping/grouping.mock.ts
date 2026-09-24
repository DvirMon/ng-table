import { createColumns } from '../../api/create-columns';
import type { ColumnBuilder, ColumnDef } from '../../api/types';
import { noData } from '../../table.mock';
import { resolveColumnDefs } from '../columns';

export interface Order {
  id: number;
  region: string;
  category: string;
}

export const orders: Order[] = [
  { id: 1, region: 'US', category: 'Electronics' },
  { id: 2, region: 'EU', category: 'Electronics' },
  { id: 3, region: 'US', category: 'Books' },
  { id: 4, region: 'US', category: 'Electronics' },
  { id: 5, region: 'EU', category: 'Books' },
];

/**
 * Declares one `Order` column by id, for use inside `createColumns()`'s builder callback.
 */
export function orderColumn<K extends keyof Order & string>(col: ColumnBuilder<Order>, id: K) {
  return col(id);
}

export const orderColumns: ColumnDef<Order>[] = resolveColumnDefs(
  [
    ...createColumns(noData<Order>(), (col) => [
      orderColumn(col, 'id'),
      orderColumn(col, 'region'),
      orderColumn(col, 'category'),
    ]).columns,
  ],
  'grouping.mock'
);
