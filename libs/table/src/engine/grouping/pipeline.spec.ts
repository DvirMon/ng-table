import type { ColumnDef } from '../../api/types';
import type { RenderNode } from '../render-stages';
import { orderColumns as columns, orders } from './grouping.mock';
import { clusterRows } from './pipeline';
import { buildGroupRenderRows } from './render';

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

  it('groups everything into one cluster when a level names a field no row carries (D7 — no column-existence guard)', () => {
    const result = clusterRows(orders, ['nope'], columns);

    // A single phantom cluster keyed by `undefined`, in original insertion order.
    expect(result.map((row) => row.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it('an unknown-field level still nests: it wraps the rest in one outer no-op cluster', () => {
    const result = clusterRows(orders, ['nope', 'region'], columns);

    expect(result.map((row) => row.region)).toEqual(['US', 'US', 'US', 'EU', 'EU']);
  });
});

describe('the two-walks gate — clusterRows and buildGroupRenderRows agree (Step 6, AC #3, ADR-0024)', () => {
  interface Sale {
    id: number;
    amount: number;
  }

  const salesColumns: ColumnDef<Sale>[] = [
    {
      id: 'tier',
      accessor: (row) => (row.amount > 100 ? 'high' : 'low'),
      visible: true,
      order: 0,
      label: 'tier',
    },
  ];

  const sales: Sale[] = [
    { id: 1, amount: 50 },
    { id: 2, amount: 150 },
    { id: 3, amount: 80 },
    { id: 4, amount: 200 },
    { id: 5, amount: 30 },
  ];

  function toSeedRenderRows(rows: Sale[]): RenderNode<Sale>[] {
    return rows.map((row) => ({ id: row.id, kind: 'row' as const, data: row, children: [] }));
  }

  /** Depth-first leaf-row ids from a render tree — the render walk's own partition order. */
  function collectLeafIds(nodes: readonly RenderNode<Sale>[]): number[] {
    return nodes.flatMap((node) =>
      node.kind === 'row' && node.data ? [node.data.id] : collectLeafIds(node.children)
    );
  }

  /** Depth-first `kind: 'group'` headers, at every nesting level. */
  function collectHeaders(nodes: readonly RenderNode<Sale>[]): RenderNode<Sale>[] {
    return nodes.flatMap((node) =>
      node.kind === 'group' ? [node, ...collectHeaders(node.children)] : []
    );
  }

  it('put rows in the same partition order for a derived-accessor column — neither side hardcodes the other', () => {
    const pipelineResult = clusterRows(sales, ['tier'], salesColumns);

    const seed = toSeedRenderRows(sales);
    const renderResult = buildGroupRenderRows(seed, ['tier'], salesColumns);
    const renderLeafIds = collectLeafIds(renderResult);

    // Neither side is compared to a hand-written literal — each is derived from its own walk,
    // and the two walks are compared directly against each other.
    expect(pipelineResult.map((row) => row.id)).toEqual(renderLeafIds);
  });

  it("every render header's groupKey.value matches the cluster the pipeline put those rows in", () => {
    const pipelineResult = clusterRows(sales, ['tier'], salesColumns);

    const seed = toSeedRenderRows(sales);
    const renderResult = buildGroupRenderRows(seed, ['tier'], salesColumns);
    const headers = collectHeaders(renderResult);

    expect(headers).toHaveLength(2);
    for (const header of headers) {
      const leafIds = header.children
        .map((child) => (child.kind === 'row' ? child.data?.id : undefined))
        .filter((id): id is number => id !== undefined);
      const clusterSegment = pipelineResult.filter((row) => leafIds.includes(row.id));

      expect(clusterSegment.length).toBe(leafIds.length);
      for (const row of clusterSegment) {
        // The real accessor decides the expected value — no hardcoded 'high'/'low' literal.
        expect(salesColumns[0].accessor(row)).toBe(header.groupKey?.value);
      }
    }
  });
});
