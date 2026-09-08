import { diffRemovedIds, pruneByIds, resolveIndex } from './rows';

describe('diffRemovedIds', () => {
  it('returns ids present in previous but not current', () => {
    const previous = new Set(['r1', 'r2', 'r3']);
    const current = new Set(['r1', 'r3']);

    expect(diffRemovedIds(previous, current)).toEqual(['r2']);
  });

  it('returns an empty array when nothing left', () => {
    const previous = new Set(['r1', 'r2']);
    const current = new Set(['r1', 'r2']);

    expect(diffRemovedIds(previous, current)).toEqual([]);
  });

  it('returns every id when current is empty', () => {
    const previous = new Set(['r1', 'r2']);
    const current = new Set<string>();

    expect(diffRemovedIds(previous, current)).toEqual(['r1', 'r2']);
  });
});

describe('pruneByIds — Map overload', () => {
  it('drops entries whose id is in removedIds', () => {
    const map = new Map([
      ['r1', 'a'],
      ['r2', 'b'],
      ['r3', 'c'],
    ]);

    const next = pruneByIds(map, ['r2']);

    expect([...next.keys()]).toEqual(['r1', 'r3']);
  });

  it('returns the same reference when no removedIds are present', () => {
    const map = new Map([['r1', 'a']]);

    expect(pruneByIds(map, ['r9'])).toBe(map);
  });

  it('returns the same reference when removedIds is empty', () => {
    const map = new Map([['r1', 'a']]);

    expect(pruneByIds(map, [])).toBe(map);
  });

  it('keeps an entry that keep() returns true for', () => {
    const map = new Map([
      ['r1', 'a'],
      ['r2', 'ABSENT'],
    ]);

    const next = pruneByIds(map, ['r1', 'r2'], (value) => value === 'ABSENT');

    expect([...next.keys()]).toEqual(['r2']);
  });
});

describe('resolveIndex', () => {
  const trackBy = (row: { id: number }) => row.id;

  it('is an O(1) hit when indexById is fresh', () => {
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const indexById = new Map(rows.map((r, i) => [r.id, i]));

    expect(resolveIndex(rows, 2, { trackBy, indexById })).toBe(1);
  });

  it('falls back to a linear scan when indexById is stale', () => {
    // Simulates a chained writeData inside one updater: `indexById` still reflects the array
    // as it was before a row was inserted at the front, so the guard (`trackBy(rows[at]) ===
    // id`) fails and the fallback takes over.
    const staleIndexById = new Map([
      [1, 0],
      [2, 1],
      [3, 2],
    ]);
    const rowsAfterInsert = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }];

    expect(resolveIndex(rowsAfterInsert, 2, { trackBy, indexById: staleIndexById })).toBe(2);
  });

  it('returns -1 when the id is not present', () => {
    const rows = [{ id: 1 }, { id: 2 }];
    const indexById = new Map(rows.map((r, i) => [r.id, i]));

    expect(resolveIndex(rows, 999, { trackBy, indexById })).toBe(-1);
  });
});

describe('pruneByIds — Set overload', () => {
  it('drops ids in removedIds', () => {
    const set = new Set(['r1', 'r2', 'r3']);

    const next = pruneByIds(set, ['r2']);

    expect([...next]).toEqual(['r1', 'r3']);
  });

  it('returns the same reference when no removedIds are present', () => {
    const set = new Set(['r1']);

    expect(pruneByIds(set, ['r9'])).toBe(set);
  });

  it('returns the same reference when removedIds is empty', () => {
    const set = new Set(['r1']);

    expect(pruneByIds(set, [])).toBe(set);
  });

  it('keeps an id that keep() returns true for', () => {
    const set = new Set(['r1', 'r2']);

    const next = pruneByIds(set, ['r1', 'r2'], (id) => id === 'r2');

    expect([...next]).toEqual(['r2']);
  });
});
