import type { ClusterSummary, ColumnDef, GroupSummary, GroupWhen, RenderRow } from '../api/types';
import {
  admitClusters,
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
    const a1: ClusterNode<string> = {
      columnId: 'sub',
      value: 'a1',
      items: ['w'],
      children: [],
      admitted: true,
    };
    const a2: ClusterNode<string> = {
      columnId: 'sub',
      value: 'a2',
      items: ['x', 'y', 'z'],
      children: [],
      admitted: true,
    };
    const A: ClusterNode<string> = {
      columnId: 'top',
      value: 'A',
      items: [...a2.items, ...a1.items],
      children: [a2, a1],
      admitted: true,
    };
    const b1: ClusterNode<string> = {
      columnId: 'sub',
      value: 'b1',
      items: ['p'],
      children: [],
      admitted: true,
    };
    const b2: ClusterNode<string> = {
      columnId: 'sub',
      value: 'b2',
      items: ['q', 'r', 's'],
      children: [],
      admitted: true,
    };
    const B: ClusterNode<string> = {
      columnId: 'top',
      value: 'B',
      items: [...b1.items, ...b2.items],
      children: [b1, b2],
      admitted: true,
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

describe('admitClusters (#85 table-wide admission)', () => {
  it('returns its input by reference at every level when no predicate is supplied — the no-op guarantee', () => {
    const nodes = buildClusters<Order>(orders, ['region', 'category'], (row, columnId) =>
      row[columnId as keyof Order]
    );

    const result = admitClusters(nodes, undefined, (items) => items, new Set());

    expect(result).toBe(nodes);
    expect(result[0].children).toBe(nodes[0].children);
  });

  it('marks a rejected node rather than removing it — columnId/value/items survive, the sibling array keeps its length', () => {
    const nodes = buildClusters<Order>(orders, ['region'], (row, columnId) =>
      row[columnId as keyof Order]
    );
    const when = (c: ClusterSummary<Order>): boolean => c.key !== 'EU';

    const result = admitClusters(nodes, when, (items) => items, new Set());

    expect(result).toHaveLength(nodes.length);
    const originalEu = nodes.find((node) => node.value === 'EU')!;
    const eu = result.find((node) => node.value === 'EU')!;
    expect(eu.admitted).toBe(false);
    expect(eu.columnId).toBe('region');
    expect(eu.value).toBe('EU');
    expect(eu.items).toEqual(originalEu.items);
  });

  it('never judges descendants of a rejected node — a predicate rejecting every top-level cluster is never called for the deeper level', () => {
    const nodes = buildClusters<Order>(orders, ['region', 'category'], (row, columnId) =>
      row[columnId as keyof Order]
    );
    const seenColumnIds: string[] = [];
    const rejectEverything = (c: ClusterSummary<Order>): boolean => {
      seenColumnIds.push(c.columnId);
      return false;
    };

    admitClusters(nodes, rejectEverything, (items) => items, new Set());

    // US and EU are each judged once at 'region' — since both are rejected, 'category' (the
    // deeper level nested under each) is never reached.
    expect(seenColumnIds).toEqual(['region', 'region']);
    expect(seenColumnIds).not.toContain('category');
  });

  it('a throwing when admits the cluster and reports once per column, not once per cluster', () => {
    const reportSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const nodes = buildClusters<Order>(orders, ['region', 'category'], (row, columnId) =>
        row[columnId as keyof Order]
      );
      const throwingWhen = (): boolean => {
        throw new Error('boom');
      };

      const result = admitClusters(nodes, throwingWhen, (items) => items, new Set());

      // Every node at every level (2 region clusters + 4 category clusters) hit the throw
      // independently, yet all are admitted.
      expect(result.every((node) => node.admitted)).toBe(true);
      expect(result.flatMap((node) => node.children).every((node) => node.admitted)).toBe(true);

      // One report per distinct column ('region', 'category'), not one per cluster.
      expect(reportSpy).toHaveBeenCalledTimes(2);
    } finally {
      reportSpy.mockRestore();
    }
  });
});

describe('admitClusters (#86 per-column admission)', () => {
  it('per-column when narrows an otherwise-admitted cluster to dissolved', () => {
    const nodes = buildClusters<Order>(orders, ['region'], (row, columnId) =>
      row[columnId as keyof Order]
    );
    const columnWhen = new Map<string, GroupWhen<Order>>([
      ['region', (c: ClusterSummary<Order>) => c.key !== 'EU'],
    ]);

    const result = admitClusters(nodes, undefined, (items) => items, new Set(), columnWhen);

    const us = result.find((node) => node.value === 'US')!;
    const eu = result.find((node) => node.value === 'EU')!;
    expect(us.admitted).toBe(true);
    expect(eu.admitted).toBe(false);
  });

  it('admits only when both the table-wide and per-column predicates pass', () => {
    const nodes = buildClusters<Order>(orders, ['region'], (row, columnId) =>
      row[columnId as keyof Order]
    );
    const when = (): boolean => true;
    const columnWhen = new Map<string, GroupWhen<Order>>([
      ['region', (c: ClusterSummary<Order>) => c.key !== 'EU'],
    ]);

    const result = admitClusters(nodes, when, (items) => items, new Set(), columnWhen);

    const us = result.find((node) => node.value === 'US')!;
    const eu = result.find((node) => node.value === 'EU')!;
    expect(us.admitted).toBe(true); // table-wide true AND column true
    expect(eu.admitted).toBe(false); // table-wide true AND column false -> dissolved
  });

  it('a throwing per-column predicate admits that vote, but a false table-wide result still dissolves the cluster (AND)', () => {
    const reportSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const nodes = buildClusters<Order>(orders, ['region'], (row, columnId) =>
        row[columnId as keyof Order]
      );
      const when = (): boolean => false;
      const throwingColumnWhen: GroupWhen<Order> = () => {
        throw new Error('boom');
      };
      const columnWhen = new Map<string, GroupWhen<Order>>([['region', throwingColumnWhen]]);

      const result = admitClusters(nodes, when, (items) => items, new Set(), columnWhen);

      // The per-column vote defaults to admit (true) on throw, but AND'd with the table-wide
      // `false` the cluster is still dissolved overall.
      expect(result.every((node) => node.admitted === false)).toBe(true);
      // One report for the one column the throwing predicate targets, not one per cluster.
      expect(reportSpy).toHaveBeenCalledTimes(1);
    } finally {
      reportSpy.mockRestore();
    }
  });

  it('a columnWhen entry for a columnId that never appears in nodes is inert (no-op on an inactive level)', () => {
    const nodes = buildClusters<Order>(orders, ['region'], (row, columnId) =>
      row[columnId as keyof Order]
    );
    // 'category' names no active level here (the only level clustered is 'region').
    const columnWhen = new Map<string, GroupWhen<Order>>([['category', () => false]]);

    const result = admitClusters(nodes, undefined, (items) => items, new Set(), columnWhen);

    expect(result.every((node) => node.admitted)).toBe(true);
    expect(result.map((node) => node.value)).toEqual(nodes.map((node) => node.value));
  });
});

describe('admission-aware ordering (sortClusters with no groupOrder)', () => {
  function admissionNode(value: string, admitted: boolean): ClusterNode<string> {
    return { columnId: 'top', value, items: [value], children: [], admitted };
  }

  it('stable-partitions admitted siblings first, then dissolved siblings, each in first-occurrence order', () => {
    const nodes = [
      admissionNode('a', true),
      admissionNode('b', false),
      admissionNode('c', true),
      admissionNode('d', false),
    ];

    const result = sortClusters(nodes, undefined, (items) => items, { done: false });

    expect(result.map((node) => node.value)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('returns the same array reference when no sibling is dissolved', () => {
    const nodes = [admissionNode('a', true), admissionNode('b', true)];

    const result = sortClusters(nodes, undefined, (items) => items, { done: false });

    expect(result).toBe(nodes);
  });

  it('a comparator that sorts dissolved-first puts those nodes and their leaves first (dissolution is post-ordering)', () => {
    const when = (c: ClusterSummary<Order>): boolean => c.key !== 'EU'; // dissolve EU
    const dissolvedFirst = (a: GroupSummary<Order>, b: GroupSummary<Order>): number =>
      Number(a.admitted) - Number(b.admitted);

    const result = clusterRows(orders, ['region'], columns, {
      when,
      groupOrder: dissolvedFirst,
    });

    // EU (dissolved) leaves come first, then US (admitted) leaves — reversed from insertion
    // order, proving the comparator runs after admission has already been decided.
    expect(result.map((row) => row.region)).toEqual(['EU', 'EU', 'US', 'US', 'US']);
  });

  it('a dissolved node stops descending — its leaves stay in bucket order, never re-clustered by the deeper level (Q1)', () => {
    const localOrders: Order[] = [
      { id: 1, region: 'EU', category: 'Books' },
      { id: 2, region: 'EU', category: 'Electronics' },
      { id: 3, region: 'EU', category: 'Books' },
    ];
    const dissolveEverything = (): boolean => false;

    const result = clusterRows(localOrders, ['region', 'category'], columns, {
      when: dissolveEverything,
    });

    // Re-clustering by category would group the two Books rows together ([1, 3, 2]). Flat
    // bucket order (no re-cluster once dissolved) keeps original insertion order instead.
    expect(result.map((row) => row.id)).toEqual([1, 2, 3]);
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
