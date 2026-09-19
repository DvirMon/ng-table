import type { ColumnDef } from '../../api/types';
import type { StagedRow } from '../render-stages';
import { buildGroupRenderRows } from './render';

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
): StagedRow<TRow>[] {
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

  it('emits every cluster member unconditionally — no gating of its own, collapse/expand is the engine prune stage\'s job (ADR-0017)', () => {
    const seed = toSeedRenderRows(orders);

    const result = buildGroupRenderRows(seed, ['region', 'category'], columns);

    expect(result.filter((row) => row.kind === 'group')).toHaveLength(6); // 2 regions + 4 region>category headers
    expect(result.filter((row) => row.kind === 'row')).toHaveLength(5);
  });

  it('stamps every header and leaf with its parent\'s id, at every depth', () => {
    const seed = toSeedRenderRows(orders);

    const result = buildGroupRenderRows(seed, ['region', 'category'], columns);

    const usHeader = result.find((row) => row.id === 'group:>region:string:US')!;
    expect(usHeader.parentId).toBeUndefined();

    const usElectronicsHeader = result.find(
      (row) => row.id === 'group:>region:string:US>category:string:Electronics'
    )!;
    expect(usElectronicsHeader.parentId).toBe(usHeader.id);

    const usElectronicsLeaf = result.find(
      (row) => row.kind === 'row' && row.data?.region === 'US' && row.data?.category === 'Electronics'
    )!;
    expect(usElectronicsLeaf.parentId).toBe(usElectronicsHeader.id);
  });

  describe('applyGroupKey and label resolution (D9)', () => {
    it("runs a level's raw field value through its extractValue extractor before it becomes the group key", () => {
      const seed = toSeedRenderRows(orders);
      const bucketByRegion = new Map<string, (fieldValue: unknown) => unknown>([
        ['region', (value) => (value === 'US' ? 'domestic' : 'intl')],
      ]);

      const result = buildGroupRenderRows(seed, ['region'], columns, {
        extractValueByColumn: bucketByRegion,
      });

      const headers = result.filter((row) => row.kind === 'group');
      expect(headers.map((row) => row.groupKey?.value)).toEqual(['domestic', 'intl']);
    });

    it("label resolves explicit -> a matching column's label -> the raw field name (D7a)", () => {
      const seed = toSeedRenderRows(orders);

      const explicit = buildGroupRenderRows(seed, ['region'], columns, {
        labelByColumn: new Map([['region', 'Sales Region']]),
      });
      expect(explicit.find((row) => row.kind === 'group')?.groupKey?.label).toBe('Sales Region');

      // No explicit label: falls back to the matching column's own `label` ('region', per the
      // `column()` fixture helper above).
      const columnFallback = buildGroupRenderRows(seed, ['region'], columns);
      expect(columnFallback.find((row) => row.kind === 'group')?.groupKey?.label).toBe('region');

      // Neither an explicit label nor a matching column: falls back to the raw field name.
      const rawKeyFallback = buildGroupRenderRows(seed, ['nope'], columns);
      expect(rawKeyFallback.find((row) => row.kind === 'group')?.groupKey?.label).toBe('nope');
    });
  });

  describe('a throwing aggregateFn (ADR-0014)', () => {
    function throwingAggregateColumn(id: string): ColumnDef<OrderWithAmount> {
      return {
        ...orderWithAmountColumn(id),
        aggregateFn: (): number => {
          throw new Error('boom');
        },
      };
    }

    it('leaves the failed group\'s aggregate undefined while the table state still computes for every group', () => {
      const reportSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const rows: OrderWithAmount[] = [
          { id: 1, region: 'US', category: 'Electronics', amount: 10 },
          { id: 2, region: 'EU', category: 'Electronics', amount: 20 },
        ];
        const amountColumns: ColumnDef<OrderWithAmount>[] = [
          orderWithAmountColumn('id'),
          orderWithAmountColumn('region'),
          orderWithAmountColumn('category'),
          throwingAggregateColumn('amount'),
        ];
        const seed = toSeedRenderRows(rows);

        const result = buildGroupRenderRows(seed, ['region'], amountColumns);

        const headers = result.filter((row) => row.kind === 'group');
        expect(headers).toHaveLength(2);
        expect(headers.every((header) => header.aggregates?.['amount'] === undefined)).toBe(true);
      } finally {
        reportSpy.mockRestore();
      }
    });

    it('reports exactly once per callback per evaluation, even across multiple groups and nested depths', () => {
      const reportSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const rows: OrderWithAmount[] = [
          { id: 1, region: 'US', category: 'Electronics', amount: 10 },
          { id: 2, region: 'US', category: 'Books', amount: 20 },
          { id: 3, region: 'EU', category: 'Electronics', amount: 30 },
        ];
        const amountColumns: ColumnDef<OrderWithAmount>[] = [
          orderWithAmountColumn('id'),
          orderWithAmountColumn('region'),
          orderWithAmountColumn('category'),
          throwingAggregateColumn('amount'),
        ];
        const seed = toSeedRenderRows(rows);

        // Two levels of grouping produce five headers (2 region + 3 region>category) — every
        // one of them hits the throwing aggregateFn independently.
        const result = buildGroupRenderRows(seed, ['region', 'category'], amountColumns);

        expect(result.filter((row) => row.kind === 'group')).toHaveLength(5);
        expect(reportSpy).toHaveBeenCalledTimes(1);
      } finally {
        reportSpy.mockRestore();
      }
    });

    it('a throwing aggregate on one column does not affect a sibling column\'s aggregate in the same group', () => {
      const reportSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const rows: OrderWithAmount[] = [
          { id: 1, region: 'US', category: 'Electronics', amount: 10 },
          { id: 2, region: 'US', category: 'Electronics', amount: 20 },
        ];
        const amountColumns: ColumnDef<OrderWithAmount>[] = [
          orderWithAmountColumn('id'),
          orderWithAmountColumn('region'),
          orderWithAmountColumn('category'),
          throwingAggregateColumn('amount'),
          averageAggregateColumn('avgAmount'),
        ];
        const seed = toSeedRenderRows(rows);

        const result = buildGroupRenderRows(seed, ['region'], amountColumns);

        const header = result.find((row) => row.kind === 'group')!;
        expect(header.aggregates?.['amount']).toBeUndefined();
        expect(header.aggregates?.['avgAmount']).toBeCloseTo(15);
      } finally {
        reportSpy.mockRestore();
      }
    });
  });
});
