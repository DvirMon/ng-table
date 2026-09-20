import type { ColumnDef, GroupWhen } from '../../api/types';
import type { RenderNode } from '../render-stages';
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

function toSeedRenderRows<TRow extends { id: number }>(rows: TRow[]): RenderNode<TRow>[] {
  return rows.map((row) => ({ id: row.id, kind: 'row' as const, data: row, children: [] }));
}

/** Depth-first collection of every `kind: 'group'` header in a built tree, at any nesting
 *  level — headers can sit inside another header now, so a test that wants "every header"
 *  can't just filter the top-level array. */
function collectGroupHeaders<TRow>(nodes: readonly RenderNode<TRow>[]): RenderNode<TRow>[] {
  return nodes.flatMap((node) =>
    node.kind === 'group' ? [node, ...collectGroupHeaders(node.children)] : []
  );
}

/** Depth-first collection of every `kind: 'row'` leaf, at any nesting level. */
function collectLeafRows<TRow>(nodes: readonly RenderNode<TRow>[]): RenderNode<TRow>[] {
  return nodes.flatMap((node) => (node.kind === 'row' ? [node] : collectLeafRows(node.children)));
}

describe('buildGroupRenderRows', () => {
  it('passes rows through unchanged when grouping is empty', () => {
    const seed = toSeedRenderRows(orders);

    const result = buildGroupRenderRows(seed, [], columns);

    expect(result).toBe(seed);
    expect(result.every((row) => row.kind === 'row')).toBe(true);
  });

  it("throws when grouping receives a row whose data is already null — the 'group' render stage must run first in RENDER_ORDER", () => {
    const seed: RenderNode<Order>[] = [{ id: 'synthetic', kind: 'group', data: null, children: [] }];

    expect(() => buildGroupRenderRows(seed, ['region'], columns)).toThrow(
      /must run first in RENDER_ORDER/
    );
  });

  it('one level: one group header per distinct value, holding its member rows as children', () => {
    const seed = toSeedRenderRows(orders);

    const result = buildGroupRenderRows(seed, ['region'], columns);

    expect(result).toHaveLength(2); // one header per distinct region — members nest inside
    expect(result.every((row) => row.kind === 'group')).toBe(true);

    const us = result.find((row) => row.groupKey?.value === 'US')!;
    expect(us.children.map((row) => row.kind)).toEqual(['row', 'row', 'row']);
    expect(us.children.every((row) => row.data?.region === 'US')).toBe(true);

    const eu = result.find((row) => row.groupKey?.value === 'EU')!;
    expect(eu.children).toHaveLength(2);
    expect(eu.children.every((row) => row.data?.region === 'EU')).toBe(true);
  });

  it('two levels: a header holds sub-headers as children, leaf rows nest at the deepest level', () => {
    const seed = toSeedRenderRows(orders);

    const result = buildGroupRenderRows(seed, ['region', 'category'], columns);

    const us = result.find((row) => row.groupKey?.value === 'US')!;
    expect(us.kind).toBe('group');
    // A region-level header holds only category sub-headers — never a leaf row directly.
    expect(us.children.every((row) => row.kind === 'group')).toBe(true);

    const usElectronics = us.children.find((row) => row.groupKey?.value === 'Electronics')!;
    expect(usElectronics.kind).toBe('group');
    expect(usElectronics.children.every((row) => row.kind === 'row')).toBe(true);
    expect(usElectronics.children).toHaveLength(2);
  });

  it('a non-admitted cluster inlines its items at the parent level instead of wrapping them in a header, without recursing into its own sub-clusters', () => {
    const seed = toSeedRenderRows(orders);
    const dissolveUs = new Map<string, GroupWhen<Order>>([
      ['region', (cluster) => cluster.key !== 'US'],
    ]);

    const result = buildGroupRenderRows(seed, ['region', 'category'], columns, {
      columnWhen: dissolveUs,
    });

    // EU stays admitted: one header, holding its own category sub-headers.
    const eu = result.find((row) => row.kind === 'group' && row.groupKey?.value === 'EU')!;
    expect(eu.children.every((row) => row.kind === 'group')).toBe(true);

    // US is dissolved: no header wraps it — its 3 leaves splice into the top level directly,
    // never re-clustered into region>category sub-headers of their own.
    const usRows = result.filter((row) => row.kind === 'row');
    expect(usRows).toHaveLength(3);
    expect(usRows.every((row) => row.data?.region === 'US')).toBe(true);
    expect(result.some((row) => row.kind === 'group' && row.groupKey?.value === 'US')).toBe(
      false
    );
  });

  it('D2: a header carries no hasChildren — children is what a header exposes now', () => {
    const seed = toSeedRenderRows(orders);

    const result = buildGroupRenderRows(seed, ['region', 'category'], columns);

    const headers = collectGroupHeaders(result);
    expect(headers.every((header) => header.hasChildren === undefined)).toBe(true);
    expect(headers.every((header) => header.children.length > 0)).toBe(true);
  });

  it("a header aggregates over its own leaves, not its children's aggregates", () => {
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

    const usHeader = collectGroupHeaders(result).find(
      (row) => row.groupKey?.columnId === 'region' && row.groupKey.value === 'US'
    )!;
    expect(usHeader.aggregates?.['amount']).toBeCloseTo((10 + 20 + 100) / 3);
    expect(usHeader.aggregates?.['amount']).not.toBeCloseTo((15 + 100) / 2);
  });

  it('group header ids are unique across sibling parents sharing a child-level value', () => {
    const seed = toSeedRenderRows(orders);

    const result = buildGroupRenderRows(seed, ['region', 'category'], columns);
    const headerIds = collectGroupHeaders(result).map((row) => row.id);

    expect(new Set(headerIds).size).toBe(headerIds.length);
    expect(headerIds).toContain('group:>region:string:US>category:string:Electronics');
    expect(headerIds).toContain('group:>region:string:EU>category:string:Electronics');
  });

  it("emits every cluster as a header unconditionally — no gating of its own, collapse/expand is flattenVisible's job (ADR-0017/ADR-0023)", () => {
    const seed = toSeedRenderRows(orders);

    const result = buildGroupRenderRows(seed, ['region', 'category'], columns);

    expect(collectGroupHeaders(result)).toHaveLength(6); // 2 regions + 4 region>category headers
    expect(collectLeafRows(result)).toHaveLength(5);
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

    it("leaves the failed group's aggregate undefined while the table state still computes for every group", () => {
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

    it('reports exactly once per callback per evaluation, even across multiple groups and nesting levels', () => {
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

        expect(collectGroupHeaders(result)).toHaveLength(5);
        expect(reportSpy).toHaveBeenCalledTimes(1);
      } finally {
        reportSpy.mockRestore();
      }
    });

    it("a throwing aggregate on one column does not affect a sibling column's aggregate in the same group", () => {
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
