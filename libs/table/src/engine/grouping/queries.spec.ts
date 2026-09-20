import { collectGroupIds, rowsBeneathGroup } from './queries';

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

describe('rowsBeneathGroup', () => {
  // Type-enforced, not runtime-asserted: `rowsBeneathGroup` takes `TRow[]` (the pipeline's raw
  // rows) and never accepts `expandedRows` or `renderRows()` output — there is no collapse-
  // related parameter to even pass, which is the whole point of D17's rewrite.

  it("a depth-0 group id returns every leaf under all of its sub-clusters", () => {
    const result = rowsBeneathGroup(orders, ['region', 'category'], 'group:>region:string:US');

    expect(result.map((row) => row.id).sort()).toEqual([1, 3, 4]);
  });

  it("a depth-1 (nested) group id returns only its own sub-cluster's leaves, never a sibling sub-cluster's", () => {
    const result = rowsBeneathGroup(
      orders,
      ['region', 'category'],
      'group:>region:string:US>category:string:Electronics'
    );

    expect(result.map((row) => row.id).sort()).toEqual([1, 4]);
    expect(result.map((row) => row.id)).not.toContain(3);
  });

  it('an id matching no cluster returns [], no throw', () => {
    expect(() =>
      rowsBeneathGroup(orders, ['region', 'category'], 'group:nope')
    ).not.toThrow();
    expect(rowsBeneathGroup(orders, ['region', 'category'], 'group:nope')).toEqual([]);
  });

  it('a malformed/non-group id returns [], no throw', () => {
    expect(rowsBeneathGroup(orders, ['region', 'category'], 1)).toEqual([]);
    expect(rowsBeneathGroup(orders, ['region', 'category'], 'not-a-group-id')).toEqual([]);
  });
});

describe('collectGroupIds — stability across a row reorder', () => {
  // The fact `grouping-collapsible/`'s sort toggles rest on: a group id is built from the
  // cluster's own value (`buildGroupPath`), never from its position, so re-sorting the rows
  // underneath cannot make an id drift. That is what lets `expandedRows` survive a sort —
  // withExpansion never hears about the sort, it just keeps matching the same ids.
  const resorted: Order[] = [...orders].reverse();

  it('the same ids come back after the rows are reordered', () => {
    const before = collectGroupIds(orders, ['region', 'category']);
    const after = collectGroupIds(resorted, ['region', 'category']);

    expect(after.length).toBe(before.length);
    expect([...after].sort()).toEqual([...before].sort());
  });

  it('a collapsed id still resolves to its rows after the reorder', () => {
    const collapsed = 'group:>region:string:US';

    expect(rowsBeneathGroup(resorted, ['region', 'category'], collapsed).map((row) => row.id).sort())
      .toEqual([1, 3, 4]);
  });
});
