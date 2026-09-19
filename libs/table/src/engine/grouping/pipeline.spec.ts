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

describe('clusterRows', () => {
  it('clusters by 1 level: same-key rows land contiguous, first-occurrence order preserved', () => {
    const result = clusterRows(orders, ['region']);

    expect(result.map((row) => row.region)).toEqual(['US', 'US', 'US', 'EU', 'EU']);
  });

  it('preserves original relative order within each cluster', () => {
    const result = clusterRows(orders, ['region']);

    expect(result.map((row) => row.id)).toEqual([1, 3, 4, 2, 5]);
  });

  it('clusters by 2 levels: leaf clusters are contiguous at every depth', () => {
    const result = clusterRows(orders, ['region', 'category']);

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
    const result = clusterRows(orders, []);

    expect(result).toBe(orders);
  });

  it('groups everything into one cluster when a level names a field no row carries (D7 — no column-existence guard)', () => {
    const result = clusterRows(orders, ['nope']);

    // A single phantom cluster keyed by `undefined`, in original insertion order.
    expect(result.map((row) => row.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it('an unknown-field level still nests: it wraps the rest in one outer no-op cluster', () => {
    const result = clusterRows(orders, ['nope', 'region']);

    expect(result.map((row) => row.region)).toEqual(['US', 'US', 'US', 'EU', 'EU']);
  });
});
