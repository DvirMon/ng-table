import { ABSENT } from './features/with-row-edit';
import {
  beginEdit,
  clearEditing,
  endEdit,
  revertEdit,
  setSnapshot,
  updateEditing,
} from './row-edit-mutations';
import { addRow, updateRows } from './row-mutations';
import { createMockTableStoreWithEditing, mockRows, mockTrackBy, type MockRow } from '../table.mock';

type Person = MockRow;

const trackBy = mockTrackBy;
const rows: Person[] = mockRows;

function ctx(data: Person[] = rows) {
  return { data, trackBy, writeData: () => undefined };
}

describe('beginEdit', () => {
  it('captures the row currently in data', () => {
    const result = beginEdit<Person>(2)(new Map(), ctx());
    expect(result.get(2)).toEqual({ id: 2, name: 'Bea' });
  });

  it('captures ABSENT for an id not yet in data (D28 blank-row flow)', () => {
    const result = beginEdit<Person>(99)(new Map(), ctx());
    expect(result.get(99)).toBe(ABSENT);
  });

  it('re-opening an already-open row re-captures its current value', () => {
    const opened = beginEdit<Person>(2)(new Map(), ctx());
    const result = beginEdit<Person>(2)(opened, ctx([{ id: 2, name: 'Bea2' }, ...rows.slice(1)]));
    expect(result.get(2)).toEqual({ id: 2, name: 'Bea2' });
  });
});

describe('endEdit', () => {
  it('drops the entry without touching data', () => {
    const opened = beginEdit<Person>(2)(new Map(), ctx());
    const result = endEdit<Person>(2)(opened, ctx());
    expect(result.has(2)).toBe(false);
  });

  it('is a no-op when the id is not being edited', () => {
    const editing = new Map();
    const result = endEdit<Person>(999)(editing, ctx());
    expect(result).toBe(editing);
  });
});

describe('clearEditing', () => {
  it('empties the Map regardless of prior state', () => {
    const opened = beginEdit<Person>(2)(beginEdit<Person>(1)(new Map(), ctx()), ctx());
    const result = clearEditing<Person>()(opened, ctx());
    expect(result.size).toBe(0);
  });
});

describe('revertEdit', () => {
  it('restores the snapshot into data and drops the entry', () => {
    const opened = beginEdit<Person>(2)(new Map(), ctx());
    let written: Person[] | undefined;
    const result = revertEdit<Person>(2)(opened, {
      data: [{ id: 1, name: 'Ada' }, { id: 2, name: 'Bea-typing' }, { id: 3, name: 'Cid' }],
      trackBy,
      writeData: (next) => (written = next),
    });

    expect(written?.find((r) => r.id === 2)).toEqual({ id: 2, name: 'Bea' });
    expect(result.has(2)).toBe(false);
  });

  it('removes the row when the snapshot is ABSENT (add-cancel)', () => {
    const opened = beginEdit<Person>(99)(new Map(), ctx());
    let written: Person[] | undefined;
    const dataWithNewRow = [...rows, { id: 99, name: '' }];
    const result = revertEdit<Person>(99)(opened, {
      data: dataWithNewRow,
      trackBy,
      writeData: (next) => (written = next),
    });

    expect(written?.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(result.has(99)).toBe(false);
  });

  it('is a no-op when the id is not being edited', () => {
    const editing = new Map();
    const result = revertEdit<Person>(999)(editing, ctx());
    expect(result).toBe(editing);
  });
});

describe('setSnapshot', () => {
  it('re-reads data() when row is omitted', () => {
    const opened = beginEdit<Person>(2)(new Map(), ctx());
    const result = setSnapshot<Person>(2)(opened, ctx([{ id: 2, name: 'Bea-refreshed' }, ...rows.slice(1)]));
    expect(result.get(2)).toEqual({ id: 2, name: 'Bea-refreshed' });
  });

  it('sets an explicit restore point when row is provided', () => {
    const opened = beginEdit<Person>(2)(new Map(), ctx());
    const result = setSnapshot<Person>(2, { id: 2, name: 'Server value' })(opened, ctx());
    expect(result.get(2)).toEqual({ id: 2, name: 'Server value' });
  });

  it('is a no-op when the id is not being edited', () => {
    const editing = new Map();
    const result = setSnapshot<Person>(999)(editing, ctx());
    expect(result).toBe(editing);
  });
});

describe('updateEditing', () => {
  it('writes through the editing signal', () => {
    const fakeTable = createMockTableStoreWithEditing([...rows], trackBy);

    updateEditing(fakeTable, beginEdit<Person>(2));

    expect(fakeTable.editing().get(2)).toEqual({ id: 2, name: 'Bea' });
  });

  it('the canonical D28 blank-row sequence round-trips through revertEdit back to an empty table', () => {
    const fakeTable = createMockTableStoreWithEditing<Person>([], trackBy);
    const id = 99;

    updateEditing(fakeTable, beginEdit<Person>(id));
    updateRows(fakeTable, addRow<Person>({ id, name: '' }, { at: 0 }));
    expect(fakeTable.data()).toEqual([{ id, name: '' }]);

    updateEditing(fakeTable, revertEdit<Person>(id));

    expect(fakeTable.data()).toEqual([]);
    expect(fakeTable.editing().has(id)).toBe(false);
  });
});
