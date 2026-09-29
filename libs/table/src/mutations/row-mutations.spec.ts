import { expectTypeOf } from 'vitest';
import { insertRow, patchRow, removeRow } from './row-mutations';
import type { RowId, RowUpdater } from '../api/types';
import { createMockTableStoreWithData, mockRows, mockTrackBy, type MockRow } from '../table.mock';

type Person = MockRow;

const trackBy = mockTrackBy;

const rows: Person[] = mockRows;

function indexById(data: Person[] = rows): ReadonlyMap<RowId, number> {
  const map = new Map<RowId, number>();
  data.forEach((row, i) => map.set(trackBy(row), i));
  return map;
}

const ctx = { trackBy, indexById: indexById(rows) };

describe('insertRow', () => {
  it('appends when at is omitted', () => {
    const result = insertRow<Person>({ id: 4, name: 'Dee' })(rows, ctx);
    expect(result.map((r) => r.id)).toEqual([1, 2, 3, 4]);
  });

  it('inserts at 0 (prepend)', () => {
    const result = insertRow<Person>({ id: 0, name: 'Zed' }, { at: 0 })(rows, ctx);
    expect(result.map((r) => r.id)).toEqual([0, 1, 2, 3]);
  });

  it('inserts at a mid-range index, matching Array.prototype.splice', () => {
    const result = insertRow<Person>({ id: 9, name: 'Mid' }, { at: 1 })(rows, ctx);
    expect(result.map((r) => r.id)).toEqual([1, 9, 2, 3]);
  });

  it('at: -1 inserts before the last row (D27)', () => {
    // Verbatim D27 example: [1,2,3] -> [1,2,X,3]
    const abc = [1, 2, 3];
    const numTrackBy = (n: number) => n;
    const numCtx = { trackBy: numTrackBy, indexById: new Map(abc.map((n, i) => [n, i])) };
    const result = insertRow<number>(0, { at: -1 })(abc, numCtx);
    expect(result).toEqual([1, 2, 0, 3]);
  });

  it('clamps at beyond array length to append, without throwing', () => {
    expect(() => insertRow<Person>({ id: 9, name: 'X' }, { at: 100 })(rows, ctx)).not.toThrow();
    const result = insertRow<Person>({ id: 9, name: 'X' }, { at: 100 })(rows, ctx);
    expect(result.map((r) => r.id)).toEqual([1, 2, 3, 9]);
  });

  it('clamps at below -length to prepend, without throwing', () => {
    expect(() => insertRow<Person>({ id: 9, name: 'X' }, { at: -100 })(rows, ctx)).not.toThrow();
    const result = insertRow<Person>({ id: 9, name: 'X' }, { at: -100 })(rows, ctx);
    expect(result.map((r) => r.id)).toEqual([9, 1, 2, 3]);
  });

  it('array form (D32) inserts every row as one contiguous block, in array order', () => {
    const result = insertRow<Person>(
      [{ id: 8, name: 'Ann' }, { id: 9, name: 'Bo' }],
      { at: 1 },
    )(rows, ctx);
    expect(result.map((r) => r.id)).toEqual([1, 8, 9, 2, 3]);
  });

  it('array form appends when at is omitted, same as the single-row form', () => {
    const result = insertRow<Person>([{ id: 8, name: 'Ann' }, { id: 9, name: 'Bo' }])(rows, ctx);
    expect(result.map((r) => r.id)).toEqual([1, 2, 3, 8, 9]);
  });

  it('array form with an empty array is a no-op', () => {
    const result = insertRow<Person>([])(rows, ctx);
    expect(result).toEqual(rows);
  });
});

describe('removeRow', () => {
  it('removes the row whose trackBy result matches the given id', () => {
    const result = removeRow<Person>(2)(rows, ctx);
    expect(result.map((r) => r.id)).toEqual([1, 3]);
  });

  it('is a no-op (returns an equivalent array) when the id is not present', () => {
    const result = removeRow<Person>(999)(rows, ctx);
    expect(result).toEqual(rows);
  });

  // Seam K (#167 step 3, D32) — the array overload cascade-deletes in one write. Its own
  // fixture (letters, not `Person`/`mockRows`) matches the plan's exact ids.
  describe('array form (D32)', () => {
    interface Letter {
      id: string;
    }
    const letterTrackBy = (row: Letter): RowId => row.id;
    const letters: Letter[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    function letterCtx(data: Letter[] = letters): {
      trackBy: (row: Letter) => RowId;
      indexById: ReadonlyMap<RowId, number>;
    } {
      const map = new Map<RowId, number>();
      data.forEach((row, i) => map.set(letterTrackBy(row), i));
      return { trackBy: letterTrackBy, indexById: map };
    }

    it('removeRow(ids) removes every listed id in one write and skips ids not in the rows', () => {
      const result = removeRow<Letter>(['b', 'nope', 'd'])(letters, letterCtx());
      expect(result.map((r) => r.id)).toEqual(['a', 'c']);

      const noop = removeRow<Letter>([])(letters, letterCtx());
      expect(noop).toEqual(letters);

      // The single-id form is untouched by the array overload.
      const single = removeRow<Letter>('b')(letters, letterCtx());
      expect(single.map((r) => r.id)).toEqual(['a', 'c', 'd']);
    });
  });

  // -------------------------------------------------------------------------------------
  // Type-level assertions (#167 step 3). The vitest executor does NOT typecheck
  // `expectTypeOf` — it is inert at runtime. Only enforced by
  // `nx run shared-table:typecheck-spec`.
  // -------------------------------------------------------------------------------------
  describe('types', () => {
    it('both overloads resolve to RowUpdater<TRow>', () => {
      expectTypeOf(removeRow<Person>('a')).toEqualTypeOf<RowUpdater<Person>>();
      expectTypeOf(removeRow<Person>(['a'])).toEqualTypeOf<RowUpdater<Person>>();
    });
  });
});

describe('patchRow', () => {
  it('shallow-merges partial into the row matching the id; other rows are unchanged', () => {
    const result = patchRow<Person>(2, { name: 'Bea2' })(rows, ctx);
    expect(result[1]).toEqual({ id: 2, name: 'Bea2' });
    // Unchanged rows keep the same reference — no unnecessary copying.
    expect(result[0]).toBe(rows[0]);
    expect(result[2]).toBe(rows[2]);
  });

  it('is a no-op when the id is not present', () => {
    const result = patchRow<Person>(999, { name: 'Nope' })(rows, ctx);
    expect(result).toEqual(rows);
    result.forEach((row, i) => expect(row).toBe(rows[i]));
  });
});

describe('table.value.update', () => {
  it('writes through to the signal', () => {
    const fakeTable = createMockTableStoreWithData([...rows], trackBy);

    fakeTable.value.update(insertRow<Person>({ id: 4, name: 'Dee' }));

    expect(fakeTable.value().map((r) => r.id)).toEqual([1, 2, 3, 4]);
  });
});
