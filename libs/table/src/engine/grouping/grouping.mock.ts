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

export interface TreeOrder extends Order {
  parentId: number | null;
}

/** Flat order tree (4 under 1, 5 under 4) whose descendants' region and category differ from
 * their root's. */
export const treeOrders: TreeOrder[] = [
  { id: 1, parentId: null, region: 'US', category: 'Electronics' },
  { id: 2, parentId: null, region: 'EU', category: 'Books' },
  { id: 3, parentId: null, region: 'US', category: 'Books' },
  { id: 4, parentId: 1, region: 'EU', category: 'Books' },
  { id: 5, parentId: 4, region: 'EU', category: 'Electronics' },
];

/** Broken parent links: rows 6 and 7 form a cycle, broken at 6 (first in input order); row 8's
 * parent 99 is absent. */
export const brokenLinkOrders: TreeOrder[] = [
  { id: 6, parentId: 7, region: 'EU', category: 'Books' },
  { id: 8, parentId: 99, region: 'US', category: 'Books' },
  { id: 7, parentId: 6, region: 'US', category: 'Books' },
];

export const treeOrderColumns: ColumnDef<TreeOrder>[] = resolveColumnDefs(
  [
    ...createColumns(noData<TreeOrder>(), (col) => [
      col('id'),
      col('region'),
      col('category'),
    ]).columns,
  ],
  'grouping.mock'
);

export const treeOrderLinks = {
  treeLinks: { parentOf: (r: TreeOrder) => r.parentId, trackBy: (r: TreeOrder) => r.id },
};
