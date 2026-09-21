import type { ColumnDef } from '../../api/types';

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

export function orderColumn<K extends keyof Order & string>(id: K): ColumnDef<Order> {
  return { id, accessor: (row: Order) => row[id], visible: true, order: 0, label: id };
}

export const orderColumns: ColumnDef<Order>[] = [
  orderColumn('id'),
  orderColumn('region'),
  orderColumn('category'),
];
