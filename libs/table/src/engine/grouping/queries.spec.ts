import { rowsBeneathGroup } from './queries';

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
