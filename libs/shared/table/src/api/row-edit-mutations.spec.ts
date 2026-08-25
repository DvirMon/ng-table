import { ABSENT } from './features/with-row-edit';
import {
  beginEdit,
  clearEditing,
  endEdit,
  rebaseEdit,
  revertEdit,
  settleEdit,
  type EditingState,
} from './row-edit-mutations';
import { addRow } from './row-mutations';
import { createMockTableStoreWithEditing, mockRows, mockTrackBy, type MockRow } from '../table.mock';

type Person = MockRow;

const trackBy = mockTrackBy;
const rows: Person[] = mockRows;

function ctx(data: Person[] = rows) {
  return { data, trackBy, writeData: () => undefined };
}

function state(
  editing: [number, Person | typeof ABSENT][] = [],
  pending: [number, Person | typeof ABSENT][] = []
): EditingState<Person> {
  return { editing: new Map(editing), pending: new Map(pending) };
}

describe('beginEdit', () => {
  it('captures the row currently in data', () => {
    const result = beginEdit<Person>(2)(state(), ctx());
    expect(result.editing.get(2)).toEqual({ id: 2, name: 'Bea' });
  });

  it('captures ABSENT for an id not yet in data (D28 blank-row flow)', () => {
    const result = beginEdit<Person>(99)(state(), ctx());
    expect(result.editing.get(99)).toBe(ABSENT);
  });

  it('does not re-capture over an already-open row (D31.1)', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const result = beginEdit<Person>(2)(
      opened,
      ctx([{ id: 2, name: 'Bea-typing' }, ...rows.slice(1)])
    );
    expect(result.editing.get(2)).toEqual({ id: 2, name: 'Bea' });
  });

  it('re-opens a pending row, carrying the snapshot from the first beginEdit (D31.1)', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const saved = endEdit<Person>(2, { keepSnapshot: true })(opened, ctx());

    const result = beginEdit<Person>(2)(saved, ctx([{ id: 2, name: 'optimistic' }, ...rows.slice(1)]));

    expect(result.editing.get(2)).toEqual({ id: 2, name: 'Bea' });
    expect(result.pending.has(2)).toBe(false);
  });
});

describe('endEdit', () => {
  it('drops the entry without touching data', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const result = endEdit<Person>(2)(opened, ctx());
    expect(result.editing.has(2)).toBe(false);
    expect(result.pending.has(2)).toBe(false);
  });

  it('{ keepSnapshot: true } moves the entry to pending (D31)', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const result = endEdit<Person>(2, { keepSnapshot: true })(opened, ctx());

    expect(result.editing.has(2)).toBe(false);
    expect(result.pending.get(2)).toEqual({ id: 2, name: 'Bea' });
  });

  it('is a no-op when the id is not being edited', () => {
    const current = state();
    const result = endEdit<Person>(999)(current, ctx());
    expect(result).toBe(current);
  });
});

describe('clearEditing', () => {
  it('empties the editing map regardless of prior state', () => {
    const opened = beginEdit<Person>(2)(beginEdit<Person>(1)(state(), ctx()), ctx());
    const result = clearEditing<Person>()(opened, ctx());
    expect(result.editing.size).toBe(0);
  });

  it('leaves pending entries alone — they are already closed', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const saved = endEdit<Person>(2, { keepSnapshot: true })(opened, ctx());

    const result = clearEditing<Person>()(saved, ctx());

    expect(result.pending.get(2)).toEqual({ id: 2, name: 'Bea' });
  });
});

describe('revertEdit', () => {
  it('restores the snapshot into data and drops the entry', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    let written: Person[] | undefined;
    const result = revertEdit<Person>(2)(opened, {
      data: [{ id: 1, name: 'Ada' }, { id: 2, name: 'Bea-typing' }, { id: 3, name: 'Cid' }],
      trackBy,
      writeData: (next) => (written = next),
    });

    expect(written?.find((r) => r.id === 2)).toEqual({ id: 2, name: 'Bea' });
    expect(result.editing.has(2)).toBe(false);
  });

  it('removes the row when the snapshot is ABSENT (add-cancel)', () => {
    const opened = beginEdit<Person>(99)(state(), ctx());
    let written: Person[] | undefined;
    const dataWithNewRow = [...rows, { id: 99, name: '' }];
    const result = revertEdit<Person>(99)(opened, {
      data: dataWithNewRow,
      trackBy,
      writeData: (next) => (written = next),
    });

    expect(written?.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(result.editing.has(99)).toBe(false);
  });

  it('rolls back a pending row when the optimistic save failed (D31)', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const saved = endEdit<Person>(2, { keepSnapshot: true })(opened, ctx());
    let written: Person[] | undefined;

    const result = revertEdit<Person>(2)(saved, {
      data: [{ id: 1, name: 'Ada' }, { id: 2, name: 'optimistic' }, { id: 3, name: 'Cid' }],
      trackBy,
      writeData: (next) => (written = next),
    });

    expect(written?.find((r) => r.id === 2)).toEqual({ id: 2, name: 'Bea' });
    expect(result.pending.has(2)).toBe(false);
  });

  it('is a no-op when the id is in neither map', () => {
    const current = state();
    const result = revertEdit<Person>(999)(current, ctx());
    expect(result).toBe(current);
  });
});

describe('rebaseEdit', () => {
  it('re-reads data() when row is omitted', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const result = rebaseEdit<Person>(2)(
      opened,
      ctx([{ id: 2, name: 'Bea-refreshed' }, ...rows.slice(1)])
    );
    expect(result.editing.get(2)).toEqual({ id: 2, name: 'Bea-refreshed' });
  });

  it('sets an explicit restore point when row is provided', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const result = rebaseEdit<Person>(2, { id: 2, name: 'Server value' })(opened, ctx());
    expect(result.editing.get(2)).toEqual({ id: 2, name: 'Server value' });
  });

  it('is a no-op when the id is not being edited', () => {
    const current = state();
    const result = rebaseEdit<Person>(999)(current, ctx());
    expect(result).toBe(current);
  });
});

describe('settleEdit', () => {
  it('settles a pending entry once the save is confirmed (D31)', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const saved = endEdit<Person>(2, { keepSnapshot: true })(opened, ctx());

    const result = settleEdit<Person>(2)(saved, ctx());

    expect(result.pending.size).toBe(0);
    expect(result.editing.size).toBe(0);
  });

  it('is a no-op for a row that is still open - closing one is the job of endEdit', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const result = settleEdit<Person>(2)(opened, ctx());
    expect(result).toBe(opened);
    expect(result.editing.has(2)).toBe(true);
  });
});

describe('table.editing.update', () => {
  it('writes through the editing signal', () => {
    const fakeTable = createMockTableStoreWithEditing([...rows], trackBy);

    fakeTable.editing.update(beginEdit<Person>(2));

    expect(fakeTable.editing().get(2)).toEqual({ id: 2, name: 'Bea' });
  });

  it('the canonical D28 blank-row sequence round-trips through revertEdit back to an empty table', () => {
    const fakeTable = createMockTableStoreWithEditing<Person>([], trackBy);
    const id = 99;

    fakeTable.editing.update(beginEdit<Person>(id));
    fakeTable.value.update(addRow<Person>({ id, name: '' }, { at: 0 }));
    expect(fakeTable.value()).toEqual([{ id, name: '' }]);

    fakeTable.editing.update(revertEdit<Person>(id));

    expect(fakeTable.value()).toEqual([]);
    expect(fakeTable.editing().has(id)).toBe(false);
  });

  it('the optimistic-save round trip: close-with-snapshot, fail, roll back (D31)', () => {
    const fakeTable = createMockTableStoreWithEditing([...rows], trackBy);

    fakeTable.editing.update(beginEdit<Person>(2));
    fakeTable.value.update((data) => data.map((r) => (r.id === 2 ? { ...r, name: 'typed' } : r)));
    fakeTable.editing.update(endEdit<Person>(2, { keepSnapshot: true }));

    expect(fakeTable.editing().size).toBe(0);
    expect(fakeTable.pending().get(2)).toEqual({ id: 2, name: 'Bea' });

    fakeTable.editing.update(revertEdit<Person>(2));

    expect(fakeTable.value().find((r) => r.id === 2)).toEqual({ id: 2, name: 'Bea' });
    expect(fakeTable.pending().size).toBe(0);
  });
});
