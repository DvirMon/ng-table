import type { ColumnDef, RenderRow } from '../api/types';
import { buildClusters, buildGroupRenderRows, clusterRows, type ClusterNode } from './grouping';

interface Order {
  id: number;
  region: string;
  category: string;
}

const orders: Order[] = [
  { id: 1, region: 'US', category: 'Electronics' },
  { id: 2, region: 'EU', category: 'Electronics' },
  { id: 3, region: 'US', category: 'Books' },
  { id: 4, region: 'US', category: 'Electronics' },
  { id: 5, region: 'EU', category: 'Books' },
];

function column(id: string): ColumnDef<Order> {
  return {
    id,
    accessor: (row: Order) => row[id as keyof Order],
    visible: true,
    order: 0,
    label: id,
  };
}

const columns: ColumnDef<Order>[] = [column('id'), column('region'), column('category')];

describe('clusterRows', () => {
  it('clusters by 1 level: same-key rows land contiguous, first-occurrence order preserved', () => {
    const result = clusterRows(orders, ['region'], columns);

    expect(result.map((row) => row.region)).toEqual(['US', 'US', 'US', 'EU', 'EU']);
  });

  it('preserves original relative order within each cluster', () => {
    const result = clusterRows(orders, ['region'], columns);

    expect(result.map((row) => row.id)).toEqual([1, 3, 4, 2, 5]);
  });

  it('clusters by 2 levels: leaf clusters are contiguous at every depth', () => {
    const result = clusterRows(orders, ['region', 'category'], columns);

    // All US rows contiguous, and within US, all Electronics rows contiguous.
    expect(result.map((row) => [row.region, row.category])).toEqual([
      ['US', 'Electronics'],
      ['US', 'Electronics'],
      ['US', 'Books'],
      ['EU', 'Electronics'],
      ['EU', 'Books'],
    ]);
  });

  it('returns the same array reference when grouping is empty', () => {
    const result = clusterRows(orders, [], columns);

    expect(result).toBe(orders);
  });

  it('returns the same array reference when every id in grouping is unknown', () => {
    const result = clusterRows(orders, ['nope'], columns);

    expect(result).toBe(orders);
  });

  it('drops a single unknown id among otherwise-valid levels, clustering by the rest', () => {
    const result = clusterRows(orders, ['nope', 'region'], columns);

    expect(result.map((row) => row.region)).toEqual(['US', 'US', 'US', 'EU', 'EU']);
  });
});

describe('buildClusters', () => {
  it('produces the right node shape for a 2-level input', () => {
    const nodes = buildClusters<Order>(orders, ['region', 'category'], (row, columnId) =>
      row[columnId as keyof Order]
    );

    const us = nodes.find((node) => node.value === 'US')!;
    expect(us.columnId).toBe('region');
    expect(us.children.map((child) => child.value).sort()).toEqual(['Books', 'Electronics']);

    const usElectronics = us.children.find((child) => child.value === 'Electronics')!;
    expect(usElectronics.columnId).toBe('category');
    expect(usElectronics.children).toEqual([]);
  });

  it('every node\'s items contains all leaves under it — parent items.length equals the sum of children items.length', () => {
    const nodes = buildClusters<Order>(orders, ['region', 'category'], (row, columnId) =>
      row[columnId as keyof Order]
    );

    function assertItemsCoverChildren(node: ClusterNode<Order>): void {
      expect(node.items.length).toBeGreaterThan(0);
      if (node.children.length === 0) return;
      const childrenItemsTotal = node.children.reduce((sum, child) => sum + child.items.length, 0);
      expect(node.items.length).toBe(childrenItemsTotal);
      for (const child of node.children) {
        assertItemsCoverChildren(child);
      }
    }

    for (const node of nodes) {
      assertItemsCoverChildren(node);
    }
  });
});

interface OrderWithAmount extends Order {
  amount: number;
}

function orderWithAmountColumn(id: string): ColumnDef<OrderWithAmount> {
  return {
    id,
    accessor: (row: OrderWithAmount) => row[id as keyof OrderWithAmount],
    visible: true,
    order: 0,
    label: id,
  };
}

function averageAggregateColumn(id: string): ColumnDef<OrderWithAmount> {
  return {
    ...orderWithAmountColumn(id),
    aggregateFn: (rows: OrderWithAmount[]) =>
      rows.reduce((sum, row) => sum + row.amount, 0) / rows.length,
  };
}

function toSeedRenderRows<TRow extends { id: number }>(
  rows: TRow[]
): Omit<RenderRow<TRow>, 'index'>[] {
  return rows.map((row) => ({ id: row.id, depth: 0, kind: 'row' as const, data: row }));
}

describe('buildGroupRenderRows', () => {
  it('passes rows through unchanged when grouping is empty', () => {
    const seed = toSeedRenderRows(orders);

    const result = buildGroupRenderRows(seed, [], columns);

    expect(result).toBe(seed);
    expect(result.every((row) => row.kind === 'row' && row.depth === 0)).toBe(true);
  });

  it('one level: one group header per distinct value, followed by its member rows at depth 1', () => {
    const seed = toSeedRenderRows(orders);

    const result = buildGroupRenderRows(seed, ['region'], columns);

    const shape = result.map((row) => [row.kind, row.depth, row.kind === 'row' ? row.data?.region : undefined]);
    expect(shape).toEqual([
      ['group', 0, undefined],
      ['row', 1, 'US'],
      ['row', 1, 'US'],
      ['row', 1, 'US'],
      ['group', 0, undefined],
      ['row', 1, 'EU'],
      ['row', 1, 'EU'],
    ]);
  });

  it('two levels: nested headers at depth 0/1, leaf rows at depth 2', () => {
    const seed = toSeedRenderRows(orders);

    const result = buildGroupRenderRows(seed, ['region', 'category'], columns);

    // First group boundary is the 'US' header (depth 0), immediately followed by the
    // 'Electronics' sub-header (depth 1), then the two matching leaf rows (depth 2).
    expect(result[0].kind).toBe('group');
    expect(result[0].depth).toBe(0);
    expect(result[1].kind).toBe('group');
    expect(result[1].depth).toBe(1);
    expect(result[2].kind).toBe('row');
    expect(result[2].depth).toBe(2);
  });

  it('depth correctness: a header aggregates over its own leaves, not its children\'s aggregates', () => {
    // US > Electronics: amounts [10, 20] → avg 15. US > Books: amounts [100] → avg 100.
    // US's own-leaves average = (10 + 20 + 100) / 3 = 43.33...
    // Wrongly averaging the children's own averages would give (15 + 100) / 2 = 57.5 instead.
    const rows: OrderWithAmount[] = [
      { id: 1, region: 'US', category: 'Electronics', amount: 10 },
      { id: 2, region: 'US', category: 'Electronics', amount: 20 },
      { id: 3, region: 'US', category: 'Books', amount: 100 },
      { id: 4, region: 'EU', category: 'Electronics', amount: 5 },
    ];
    const amountColumns: ColumnDef<OrderWithAmount>[] = [
      orderWithAmountColumn('id'),
      orderWithAmountColumn('region'),
      orderWithAmountColumn('category'),
      averageAggregateColumn('amount'),
    ];
    const seed = toSeedRenderRows(rows);

    const result = buildGroupRenderRows(seed, ['region', 'category'], amountColumns);

    const usHeader = result.find((row) => row.kind === 'group' && row.depth === 0)!;
    expect(usHeader.aggregates?.['amount']).toBeCloseTo((10 + 20 + 100) / 3);
    expect(usHeader.aggregates?.['amount']).not.toBeCloseTo((15 + 100) / 2);
  });

  it('group header ids are unique across sibling parents sharing a child-level value', () => {
    const seed = toSeedRenderRows(orders);

    const result = buildGroupRenderRows(seed, ['region', 'category'], columns);
    const headerIds = result.filter((row) => row.kind === 'group').map((row) => row.id);

    expect(new Set(headerIds).size).toBe(headerIds.length);
    expect(headerIds).toContain('group:>region:string:US>category:string:Electronics');
    expect(headerIds).toContain('group:>region:string:EU>category:string:Electronics');
  });
});
