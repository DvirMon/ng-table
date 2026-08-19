import { addRow, patchRow, removeRow, updateRows } from './row-mutations';
import { createMockTableStoreWithData, mockRows, mockTrackBy, type MockRow } from '../table.mock';

type Person = MockRow;

const trackBy = mockTrackBy;
const ctx = { trackBy };

const rows: Person[] = mockRows;

describe('addRow', () => {
  it('appends when at is omitted', () => {
    const result = addRow<Person>({ id: 4, name: 'Dee' })(rows, ctx);
    expect(result.map((r) => r.id)).toEqual([1, 2, 3, 4]);
  });

  it('inserts at 0 (prepend)', () => {
    const result = addRow<Person>({ id: 0, name: 'Zed' }, { at: 0 })(rows, ctx);
    expect(result.map((r) => r.id)).toEqual([0, 1, 2, 3]);
  });

  it('inserts at a mid-range index, matching Array.prototype.splice', () => {
    const result = addRow<Person>({ id: 9, name: 'Mid' }, { at: 1 })(rows, ctx);
    expect(result.map((r) => r.id)).toEqual([1, 9, 2, 3]);
  });

  it('at: -1 inserts before the last row (D27)', () => {
    // Verbatim D27 example: [1,2,3] -> [1,2,X,3]
    const abc = [1, 2, 3];
    const numCtx = { trackBy: (n: number) => n };
    const result = addRow<number>(0, { at: -1 })(abc, numCtx);
    expect(result).toEqual([1, 2, 0, 3]);
  });

  it('clamps at beyond array length to append, without throwing', () => {
    expect(() => addRow<Person>({ id: 9, name: 'X' }, { at: 100 })(rows, ctx)).not.toThrow();
    const result = addRow<Person>({ id: 9, name: 'X' }, { at: 100 })(rows, ctx);
    expect(result.map((r) => r.id)).toEqual([1, 2, 3, 9]);
  });

  it('clamps at below -length to prepend, without throwing', () => {
    expect(() => addRow<Person>({ id: 9, name: 'X' }, { at: -100 })(rows, ctx)).not.toThrow();
    const result = addRow<Person>({ id: 9, name: 'X' }, { at: -100 })(rows, ctx);
    expect(result.map((r) => r.id)).toEqual([9, 1, 2, 3]);
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

describe('updateRows', () => {
  it('writes through to the signal', () => {
    const fakeTable = createMockTableStoreWithData([...rows], trackBy);

    updateRows(fakeTable, addRow<Person>({ id: 4, name: 'Dee' }));

    expect(fakeTable.data().map((r) => r.id)).toEqual([1, 2, 3, 4]);
  });
});
