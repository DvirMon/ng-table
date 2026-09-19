import type { ClusterSummary, GroupSummary, GroupWhen } from '../../api/types';
import { admitClusters, buildClusters, sortClusters, type ClusterNode } from './clusters';
import { clusterRows } from './pipeline';

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

    const result = sortClusters(
      nodes,
      new Map([
        ['top', groupOrder],
        ['sub', groupOrder],
      ]),
      (items) => items,
      { done: false }
    );

    expect(result.map((node) => node.value)).toEqual(['A', 'B']);
    expect(result[0].children.map((node) => node.value)).toEqual(['a1', 'a2']); // reordered
    expect(result[1].children.map((node) => node.value)).toEqual(['b1', 'b2']); // unchanged
  });

  it('two different columns order independently — top descending by key, sub descending by rows.length, with no cross-talk', () => {
    const { nodes } = twoParentFixture();
    const topByKeyDescending = (a: GroupSummary<string>, b: GroupSummary<string>): number =>
      String(b.key).localeCompare(String(a.key));
    const subByLengthDescending = (a: GroupSummary<string>, b: GroupSummary<string>): number =>
      b.rows.length - a.rows.length;

    const result = sortClusters(
      nodes,
      new Map([
        ['top', topByKeyDescending],
        ['sub', subByLengthDescending],
      ]),
      (items) => items,
      { done: false }
    );

    // 'top' reorders by its own rule (descending by key: 'B' before 'A') while 'sub' reorders
    // each parent's own children by a genuinely different rule (descending by rows.length) —
    // neither comparator leaks into the other column's node lists.
    expect(result.map((node) => node.value)).toEqual(['B', 'A']); // reordered: B before A
    expect(result[0].children.map((node) => node.value)).toEqual(['b2', 'b1']); // reordered: b2 (3 rows) before b1 (1 row)
    expect(result[1].children.map((node) => node.value)).toEqual(['a2', 'a1']); // reordered: a2 (3 rows) before a1 (1 row)
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

      const result = sortClusters(
        nodes,
        new Map([
          ['top', throwingGroupOrder],
          ['sub', throwingGroupOrder],
        ]),
        (items) => items,
        { done: false }
      );

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

describe('admission-aware ordering (sortClusters, per-column)', () => {
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

    const result = clusterRows(orders, ['region'], {
      when,
      groupOrderByColumn: new Map([['region', dissolvedFirst]]),
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

    const result = clusterRows(localOrders, ['region', 'category'], {
      when: dissolveEverything,
    });

    // Re-clustering by category would group the two Books rows together ([1, 3, 2]). Flat
    // bucket order (no re-cluster once dissolved) keeps original insertion order instead.
    expect(result.map((row) => row.id)).toEqual([1, 2, 3]);
  });
});
