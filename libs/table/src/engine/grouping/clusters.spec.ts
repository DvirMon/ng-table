import { createColumns } from '../../api/create-columns';
import type {
  ClusterSummary,
  ColumnBuilder,
  ColumnDef,
  GroupSummary,
  GroupWhen,
} from '../../api/types';
import { noData } from '../../table.mock';
import { resolveColumnDefs } from '../columns';
import { buildValueOfContext } from '../resolvers';
import {
  admitClusters,
  buildClusterNodes,
  buildClusters,
  readGroupValue,
  sortClusters,
  type ClusterNode,
} from './clusters';
import { orderColumns, orders, type Order } from './grouping.mock';
import { clusterRows } from './pipeline';

// `admitClusters` grew a required resolver guard (`columns`/`knownIds`/`label`) once `when`
// started receiving a `ctx: ValueOfContext<TRow>` (Step 6/7) — every direct call below must now
// pass them. Centralized here so a future signature change updates one place, not eight.
const orderColumnsGetter = (): ColumnDef<Order>[] => orderColumns;
const orderKnownIds = new Set(orderColumns.map((column) => column.id));

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

describe('buildClusters / buildClusterNodes — non-primitive group-value report', () => {
  interface MetaRow {
    id: number;
    meta: { tag: string };
  }
  interface TwoLevelRow {
    id: number;
    alpha: { x: number };
    beta: { y: number };
  }
  interface ArrayRow {
    id: number;
    tags: number[];
  }
  interface NullableRow {
    id: number;
    value: unknown;
  }
  interface DateRow {
    id: number;
    createdAt: Date;
  }

  it('fires once for an object-valued grouping field, naming the field and groupKey', () => {
    const reportSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const rows: MetaRow[] = [
        { id: 1, meta: { tag: 'a' } },
        { id: 2, meta: { tag: 'b' } },
      ];

      buildClusters<MetaRow>(rows, ['meta'], (row, columnId) => row[columnId as keyof MetaRow]);

      expect(reportSpy).toHaveBeenCalledTimes(1);
      const message = reportSpy.mock.calls[0][0] as string;
      expect(message).toContain('meta');
      expect(message).toContain('groupKey');
    } finally {
      reportSpy.mockRestore();
    }
  });

  it('logs exactly once across many rows sharing one object-valued field', () => {
    const reportSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const rows: MetaRow[] = Array.from({ length: 50 }, (_, index) => ({
        id: index,
        meta: { tag: `t${index}` },
      }));

      buildClusters<MetaRow>(rows, ['meta'], (row, columnId) => row[columnId as keyof MetaRow]);

      expect(reportSpy).toHaveBeenCalledTimes(1);
    } finally {
      reportSpy.mockRestore();
    }
  });

  it('two object-valued levels each log once, independently', () => {
    const reportSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const rows: TwoLevelRow[] = [
        { id: 1, alpha: { x: 1 }, beta: { y: 1 } },
        { id: 2, alpha: { x: 2 }, beta: { y: 2 } },
      ];

      buildClusters<TwoLevelRow>(rows, ['alpha', 'beta'], (row, columnId) =>
        row[columnId as keyof TwoLevelRow]
      );

      expect(reportSpy).toHaveBeenCalledTimes(2);
      const messages = reportSpy.mock.calls.map((call) => call[0] as string);
      expect(messages[0]).toContain('alpha');
      expect(messages[1]).toContain('beta');
    } finally {
      reportSpy.mockRestore();
    }
  });

  it('fires for an array-valued field', () => {
    const reportSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const rows: ArrayRow[] = [
        { id: 1, tags: [1, 2] },
        { id: 2, tags: [3, 4] },
      ];

      buildClusters<ArrayRow>(rows, ['tags'], (row, columnId) => row[columnId as keyof ArrayRow]);

      expect(reportSpy).toHaveBeenCalledTimes(1);
      const message = reportSpy.mock.calls[0][0] as string;
      expect(message).toContain('tags');
    } finally {
      reportSpy.mockRestore();
    }
  });

  it('stays quiet when a declared groupKey reduces the field to a primitive, driven through buildClusterNodes', () => {
    const reportSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const rows: MetaRow[] = [
        { id: 1, meta: { tag: 'a' } },
        { id: 2, meta: { tag: 'b' } },
      ];
      const columns: ColumnDef<MetaRow>[] = [
        { id: 'meta', accessor: (row) => row.meta, visible: true, order: 0, label: 'meta' },
      ];
      const extractValueByColumn = new Map<string, (fieldValue: unknown) => unknown>([
        ['meta', (fieldValue) => (fieldValue as { tag: string }).tag],
      ]);

      buildClusterNodes<MetaRow>(rows, ['meta'], columns, { extractValueByColumn });

      expect(reportSpy).not.toHaveBeenCalled();
    } finally {
      reportSpy.mockRestore();
    }
  });

  it('stays quiet for null and undefined field values', () => {
    const reportSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const rows: NullableRow[] = [
        { id: 1, value: null },
        { id: 2, value: undefined },
      ];
      const columns: ColumnDef<NullableRow>[] = [
        { id: 'value', accessor: (row) => row.value, visible: true, order: 0, label: 'value' },
      ];

      buildClusterNodes<NullableRow>(rows, ['value'], columns);

      expect(reportSpy).not.toHaveBeenCalled();
    } finally {
      reportSpy.mockRestore();
    }
  });

  it('stays quiet for Date field values', () => {
    const reportSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const rows: DateRow[] = [
        { id: 1, createdAt: new Date('2024-01-01') },
        { id: 2, createdAt: new Date('2024-01-02') },
      ];
      const columns: ColumnDef<DateRow>[] = [
        { id: 'createdAt', accessor: (row) => row.createdAt, visible: true, order: 0, label: 'createdAt' },
      ];

      buildClusterNodes<DateRow>(rows, ['createdAt'], columns);

      expect(reportSpy).not.toHaveBeenCalled();
    } finally {
      reportSpy.mockRestore();
    }
  });

  it('clustering itself is unchanged for an object-valued field — distinct objects still land in one node', () => {
    const reportSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const rows: MetaRow[] = [
        { id: 1, meta: { tag: 'a' } },
        { id: 2, meta: { tag: 'b' } },
        { id: 3, meta: { tag: 'c' } },
      ];

      const nodes = buildClusters<MetaRow>(
        rows,
        ['meta'],
        (row, columnId) => row[columnId as keyof MetaRow]
      );

      expect(nodes).toHaveLength(1);
      expect(nodes[0].columnId).toBe('meta');
      expect(nodes[0].value).toBe(rows[0].meta);
      expect(nodes[0].items).toEqual(rows);
      expect(nodes[0].children).toEqual([]);
      expect(nodes[0].admitted).toBe(true);
    } finally {
      reportSpy.mockRestore();
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

    const result = admitClusters(
      nodes,
      undefined,
      (items) => items,
      new Set(),
      undefined,
      orderColumnsGetter,
      orderKnownIds,
      'withGrouping'
    );

    expect(result).toBe(nodes);
    expect(result[0].children).toBe(nodes[0].children);
  });

  it('marks a rejected node rather than removing it — columnId/value/items survive, the sibling array keeps its length', () => {
    const nodes = buildClusters<Order>(orders, ['region'], (row, columnId) =>
      row[columnId as keyof Order]
    );
    const when = (c: ClusterSummary<Order>): boolean => c.key !== 'EU';

    const result = admitClusters(
      nodes,
      when,
      (items) => items,
      new Set(),
      undefined,
      orderColumnsGetter,
      orderKnownIds,
      'withGrouping'
    );

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

    admitClusters(
      nodes,
      rejectEverything,
      (items) => items,
      new Set(),
      undefined,
      orderColumnsGetter,
      orderKnownIds,
      'withGrouping'
    );

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

      const result = admitClusters(
        nodes,
        throwingWhen,
        (items) => items,
        new Set(),
        undefined,
        orderColumnsGetter,
        orderKnownIds,
        'withGrouping'
      );

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

    const result = admitClusters(
      nodes,
      undefined,
      (items) => items,
      new Set(),
      columnWhen,
      orderColumnsGetter,
      orderKnownIds,
      'withGrouping'
    );

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

    const result = admitClusters(
      nodes,
      when,
      (items) => items,
      new Set(),
      columnWhen,
      orderColumnsGetter,
      orderKnownIds,
      'withGrouping'
    );

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

      const result = admitClusters(
        nodes,
        when,
        (items) => items,
        new Set(),
        columnWhen,
        orderColumnsGetter,
        orderKnownIds,
        'withGrouping'
      );

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

    const result = admitClusters(
      nodes,
      undefined,
      (items) => items,
      new Set(),
      columnWhen,
      orderColumnsGetter,
      orderKnownIds,
      'withGrouping'
    );

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

    const result = clusterRows(orders, ['region'], orderColumns, {
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

    const result = clusterRows(localOrders, ['region', 'category'], orderColumns, {
      when: dissolveEverything,
    });

    // Re-clustering by category would group the two Books rows together ([1, 3, 2]). Flat
    // bucket order (no re-cluster once dissolved) keeps original insertion order instead.
    expect(result.map((row) => row.id)).toEqual([1, 2, 3]);
  });
});

describe('buildClusterNodes — derived-accessor column (Step 6, AC #1)', () => {
  interface Sale {
    id: number;
    amount: number;
  }

  function tierColumn(col: ColumnBuilder<Sale>) {
    return col('tier', { accessor: (row) => (row.amount > 100 ? 'high' : 'low') });
  }

  it('groups by a derived accessor into distinct clusters, not one undefined cluster', () => {
    const rows: Sale[] = [
      { id: 1, amount: 50 },
      { id: 2, amount: 150 },
      { id: 3, amount: 80 },
      { id: 4, amount: 200 },
    ];

    const nodes = buildClusterNodes<Sale>(
      rows,
      ['tier'],
      resolveColumnDefs(
        [...createColumns(noData<Sale>(), (col) => [tierColumn(col)]).columns],
        'clusters.spec'
      )
    );

    expect(nodes.map((node) => node.value).sort()).toEqual(['high', 'low']);
    expect(nodes.some((node) => node.value === undefined)).toBe(false);
    const high = nodes.find((node) => node.value === 'high')!;
    expect(high.items.map((row) => row.id).sort()).toEqual([2, 4]);
  });
});

describe('buildClusterNodes — a carrier column is groupable (Step 6, AC #2, G54)', () => {
  interface RowWithMeta {
    id: number;
    meta: { region: string };
  }

  it('partitions by an accessor whose id matches no row field, regardless of visible', () => {
    const rows: RowWithMeta[] = [
      { id: 1, meta: { region: 'US' } },
      { id: 2, meta: { region: 'EU' } },
      { id: 3, meta: { region: 'US' } },
    ];
    const columns: ColumnDef<RowWithMeta>[] = [
      {
        id: 'region',
        accessor: (row) => row.meta.region,
        visible: false,
        order: 0,
        label: 'region',
      },
    ];

    const nodes = buildClusterNodes<RowWithMeta>(rows, ['region'], columns);

    expect(nodes.map((node) => node.value).sort()).toEqual(['EU', 'US']);
    const us = nodes.find((node) => node.value === 'US')!;
    expect(us.items.map((row) => row.id).sort()).toEqual([1, 3]);
    const eu = nodes.find((node) => node.value === 'EU')!;
    expect(eu.items.map((row) => row.id)).toEqual([2]);
  });
});

describe('groupKey receives the accessor output (Step 6, AC #8, G68)', () => {
  it("a plain column's extractor receives the raw field value — the default accessor is (row) => row[id]", () => {
    interface Row {
      id: number;
      region: string;
    }
    const rows: Row[] = [{ id: 1, region: 'US' }];
    const captured: unknown[] = [];
    const columns: ColumnDef<Row>[] = [
      { id: 'region', accessor: (row) => row.region, visible: true, order: 0, label: 'region' },
    ];
    const extractValueByColumn = new Map<string, (fieldValue: unknown) => unknown>([
      [
        'region',
        (value) => {
          captured.push(value);
          return value;
        },
      ],
    ]);

    buildClusterNodes<Row>(rows, ['region'], columns, { extractValueByColumn });

    expect(captured).toEqual(['US']);
  });

  it("a derived column's extractor receives the accessor's output, never row[columnId] — which does not exist for a derived column", () => {
    interface Sale {
      id: number;
      amount: number;
    }
    const rows: Sale[] = [{ id: 1, amount: 150 }];
    const captured: unknown[] = [];
    const columns: ColumnDef<Sale>[] = [
      {
        id: 'tier',
        accessor: (row) => (row.amount > 100 ? 'high' : 'low'),
        visible: true,
        order: 0,
        label: 'tier',
      },
    ];
    const extractValueByColumn = new Map<string, (fieldValue: unknown) => unknown>([
      [
        'tier',
        (value) => {
          captured.push(value);
          return value;
        },
      ],
    ]);

    const nodes = buildClusterNodes<Sale>(rows, ['tier'], columns, { extractValueByColumn });

    // Capturing the extractor's own argument, not just the resulting key — 'tier' does not
    // exist on Sale, so a wrongly-wired read of row['tier'] would hand the extractor
    // `undefined`, and an assertion on the cluster key alone could still pass by accident.
    expect(captured).toEqual(['high']);
    expect(nodes[0].value).toBe('high');
  });
});

describe('a throwing accessor degrades and dedupes through readGroupValue (Step 6, ADR-0014)', () => {
  it('clusters everything under one undefined cluster and reports once across the whole walk, not once per row', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      interface Row {
        id: number;
      }
      const rows: Row[] = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const columns: ColumnDef<Row>[] = [
        {
          id: 'region',
          accessor: () => {
            throw new Error('boom');
          },
          visible: true,
          order: 0,
          label: 'region',
        },
      ];

      const nodes = buildClusterNodes<Row>(rows, ['region'], columns);

      expect(nodes).toHaveLength(1);
      expect(nodes[0].value).toBeUndefined();
      expect(nodes[0].items.map((row) => row.id).sort()).toEqual([1, 2, 3]);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('readGroupValue itself degrades to undefined for a throwing accessor and dedupes via the shared reportedColumns set', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      interface Row {
        id: number;
      }
      const column: ColumnDef<Row> = {
        id: 'region',
        accessor: () => {
          throw new Error('boom');
        },
        visible: true,
        order: 0,
        label: 'region',
      };
      const columnById = new Map([['region', column]]);
      const reported = new Set<string>();

      expect(readGroupValue({ id: 1 }, 'region', columnById, reported)).toBeUndefined();
      expect(readGroupValue({ id: 2 }, 'region', columnById, reported)).toBeUndefined();
      expect(readGroupValue({ id: 3 }, 'region', columnById, reported)).toBeUndefined();

      expect(errorSpy).toHaveBeenCalledTimes(1);
    } finally {
      errorSpy.mockRestore();
    }
  });
});

// `admitClusters`'s own `when`/`columnWhen` evaluation (`evaluateGroupWhen`) wraps every
// predicate call in a try/catch for ADR-0014's runtime-degrade path — so a `when` that calls
// `ctx.valueOf()` with an unknown id, run through `admitClusters`, is swallowed into the same
// "admit + report" fallback as any other throwing predicate, never observable as a raw throw.
// `buildValueOfContext`'s own construction-class throw (Issue #117 Step 6) is therefore only
// directly observable by calling the resulting `ctx.valueOf()` itself, as below — this is
// `engine/resolvers.ts`'s own behavior exercised through grouping's own call site
// (`buildValueOfContext`, imported by `clusters.ts`), not a fourth spec file for resolvers.ts.
describe('ctx.valueOf resolver guard (Issue #117 Step 7, via engine/resolvers.ts)', () => {
  it('an unknown column id thrown from ctx.valueOf names both withGrouping and the id', () => {
    const ctx = buildValueOfContext<Order>(orderColumnsGetter, orderKnownIds, 'withGrouping');

    expect(() => ctx.valueOf({ id: 'nope' }, orders[0])).toThrow(/\[withGrouping\].*"nope"/);
  });

  it('a declared column id resolves the accessor value, not a throw', () => {
    const ctx = buildValueOfContext<Order>(orderColumnsGetter, orderKnownIds, 'withGrouping');

    expect(ctx.valueOf({ id: 'region' }, orders[0])).toBe('US');
  });
});
