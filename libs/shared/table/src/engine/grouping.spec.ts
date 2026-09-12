import type { ColumnDef, GroupSummary, RenderRow, RowId } from '../api/types';
import {
  buildClusters,
  buildGroupRenderRows,
  clusterRows,
  rowsBeneathGroup,
  sortClusters,
  type ClusterNode,
} from './grouping';

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

describe('sortClusters', () => {
  function twoParentFixture(): {
    A: ClusterNode<string>;
    B: ClusterNode<string>;
    nodes: ClusterNode<string>[];
  } {
    // A's children are inserted out-of-order relative to their size (a2 before a1); B's
    // children are already in ascending-size order — proving a per-parent sort reorders A's
    // siblings without disturbing B's, which a global cross-parent sort (flattening both
    // parents' children into one list before sorting) would not preserve.
    const a1: ClusterNode<string> = { columnId: 'sub', value: 'a1', items: ['w'], children: [] };
    const a2: ClusterNode<string> = {
      columnId: 'sub',
      value: 'a2',
      items: ['x', 'y', 'z'],
      children: [],
    };
    const A: ClusterNode<string> = {
      columnId: 'top',
      value: 'A',
      items: [...a2.items, ...a1.items],
      children: [a2, a1],
    };
    const b1: ClusterNode<string> = { columnId: 'sub', value: 'b1', items: ['p'], children: [] };
    const b2: ClusterNode<string> = {
      columnId: 'sub',
      value: 'b2',
      items: ['q', 'r', 's'],
      children: [],
    };
    const B: ClusterNode<string> = {
      columnId: 'top',
      value: 'B',
      items: [...b1.items, ...b2.items],
      children: [b1, b2],
    };
    return { A, B, nodes: [A, B] };
  }

  it("reorders each parent's own children by rows.length, never mixing one parent's siblings with another's", () => {
    const { nodes } = twoParentFixture();
    const groupOrder = (a: GroupSummary<string>, b: GroupSummary<string>): number =>
      a.rows.length - b.rows.length;

    const result = sortClusters(nodes, groupOrder, (items) => items, { done: false });

    expect(result.map((node) => node.value)).toEqual(['A', 'B']);
    expect(result[0].children.map((node) => node.value)).toEqual(['a1', 'a2']); // reordered
    expect(result[1].children.map((node) => node.value)).toEqual(['b1', 'b2']); // unchanged
  });

  it('groupOrder omitted (undefined) returns the nodes array unchanged, by reference, at every level', () => {
    const { nodes, A } = twoParentFixture();

    const result = sortClusters(nodes, undefined, (items) => items, { done: false });

    expect(result).toBe(nodes);
    expect(result[0]).toBe(A);
    expect(result[0].children).toBe(A.children);
  });

  it('a throwing groupOrder falls back to the pre-sort order for every affected level and reports exactly once per call, not once per comparison', () => {
    const reportSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { nodes } = twoParentFixture();
      const throwingGroupOrder = (): number => {
        throw new Error('boom');
      };

      const result = sortClusters(nodes, throwingGroupOrder, (items) => items, { done: false });

      // Top level and both parents' children each hit the throw independently, yet all fall
      // back to their pre-sort (insertion) order.
      expect(result.map((node) => node.value)).toEqual(['A', 'B']);
      expect(result[0].children.map((node) => node.value)).toEqual(['a2', 'a1']);
      expect(result[1].children.map((node) => node.value)).toEqual(['b1', 'b2']);

      expect(reportSpy).toHaveBeenCalledTimes(1);
    } finally {
      reportSpy.mockRestore();
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

  it('expandedRows omitting a depth-0 header id omits every descendant beneath it, at every depth, while the header itself still renders', () => {
    const seed = toSeedRenderRows(orders);
    // Everything under EU is a member; nothing under US is — isolates the omitted subtree.
    const expandedRows = new Set<RowId>([
      'group:>region:string:EU',
      'group:>region:string:EU>category:string:Electronics',
      'group:>region:string:EU>category:string:Books',
    ]);

    const result = buildGroupRenderRows(seed, ['region', 'category'], columns, undefined, expandedRows);

    const usHeader = result.find((row) => row.id === 'group:>region:string:US')!;
    expect(usHeader.depth).toBe(0);
    expect(result.some((row) => row.id === 'group:>region:string:US>category:string:Electronics')).toBe(false);
    expect(result.some((row) => row.id === 'group:>region:string:US>category:string:Books')).toBe(false);
    expect(result.filter((row) => row.kind === 'row' && row.data?.region === 'US')).toEqual([]);
    // EU's subtree, whose id and both children's ids are all members, renders in full.
    expect(result.some((row) => row.id === 'group:>region:string:EU>category:string:Electronics')).toBe(true);
    expect(result.filter((row) => row.kind === 'row' && row.data?.region === 'EU')).toHaveLength(2);
  });

  it('expandedRows including a header but omitting one of its children only omits that grandchild subtree — gating is per-node, not whole-subtree', () => {
    const seed = toSeedRenderRows(orders);
    // US is a member, and so is its Electronics child — but its Books child is not.
    const expandedRows = new Set<RowId>([
      'group:>region:string:US',
      'group:>region:string:US>category:string:Electronics',
    ]);

    const result = buildGroupRenderRows(seed, ['region', 'category'], columns, undefined, expandedRows);

    // Both of US's own children (headers) render — US itself is expanded.
    expect(result.some((row) => row.id === 'group:>region:string:US>category:string:Electronics')).toBe(true);
    expect(result.some((row) => row.id === 'group:>region:string:US>category:string:Books')).toBe(true);
    // Electronics is expanded, so its leaves render.
    expect(result.filter((row) => row.kind === 'row' && row.data?.category === 'Electronics' && row.data?.region === 'US')).toHaveLength(2);
    // Books is not expanded, so its own leaf is omitted even though its parent (US) is.
    expect(result.some((row) => row.kind === 'row' && row.data?.category === 'Books' && row.data?.region === 'US')).toBe(false);
  });

  it('expandedRows omitted (undefined) behaves identically to unconditional expansion — the regression case for no withExpansion() composed', () => {
    const seed = toSeedRenderRows(orders);

    const withoutArg = buildGroupRenderRows(seed, ['region', 'category'], columns);
    const withExplicitUndefined = buildGroupRenderRows(seed, ['region', 'category'], columns, undefined, undefined);

    expect(withoutArg).toEqual(withExplicitUndefined);
    // Every header and every leaf is present — nothing is gated.
    expect(withoutArg.filter((row) => row.kind === 'group')).toHaveLength(6); // 2 regions + 4 region>category headers
    expect(withoutArg.filter((row) => row.kind === 'row')).toHaveLength(5);
  });

  it('an empty expandedRows set renders every header but omits every descendant — distinct from undefined (no expansion feature at all)', () => {
    const seed = toSeedRenderRows(orders);

    const result = buildGroupRenderRows(seed, ['region', 'category'], columns, undefined, new Set());

    // Only the two depth-0 headers render; nothing beneath them (no nested headers, no leaves).
    expect(result).toHaveLength(2);
    expect(result.every((row) => row.kind === 'group' && row.depth === 0)).toBe(true);
  });
});

describe('rowsBeneathGroup', () => {
  // Type-enforced, not runtime-asserted: `rowsBeneathGroup` takes `TRow[]` (the pipeline's raw
  // rows) and never accepts `expandedRows` or `renderRows()` output — there is no collapse-
  // related parameter to even pass, which is the whole point of D17's rewrite.

  it("a depth-0 group id returns every leaf under all of its sub-clusters", () => {
    const result = rowsBeneathGroup(orders, ['region', 'category'], columns, 'group:>region:string:US');

    expect(result.map((row) => row.id).sort()).toEqual([1, 3, 4]);
  });

  it("a depth-1 (nested) group id returns only its own sub-cluster's leaves, never a sibling sub-cluster's", () => {
    const result = rowsBeneathGroup(
      orders,
      ['region', 'category'],
      columns,
      'group:>region:string:US>category:string:Electronics'
    );

    expect(result.map((row) => row.id).sort()).toEqual([1, 4]);
    expect(result.map((row) => row.id)).not.toContain(3);
  });

  it('an id matching no cluster returns [], no throw', () => {
    expect(() =>
      rowsBeneathGroup(orders, ['region', 'category'], columns, 'group:nope')
    ).not.toThrow();
    expect(rowsBeneathGroup(orders, ['region', 'category'], columns, 'group:nope')).toEqual([]);
  });

  it('a malformed/non-group id returns [], no throw', () => {
    expect(rowsBeneathGroup(orders, ['region', 'category'], columns, 1)).toEqual([]);
    expect(rowsBeneathGroup(orders, ['region', 'category'], columns, 'not-a-group-id')).toEqual([]);
  });
});
