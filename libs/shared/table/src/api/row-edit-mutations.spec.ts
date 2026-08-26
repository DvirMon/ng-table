import { ABSENT, pendingIds } from './features/with-row-edit';
import {
  addNewRow,
  beginEdit,
  clearEditing,
  endEdit,
  rebaseEdit,
  revertEdit,
  settleEdit,
  type EditingState,
} from './row-edit-mutations';
import { addRow, removeRow } from './row-mutations';
import { createMockTableStoreWithEditing, mockRows, mockTrackBy, type MockRow } from '../table.mock';

type Person = MockRow;

const trackBy = mockTrackBy;
const rows: Person[] = mockRows;

function ctx(data: Person[] = rows) {
  return { data, trackBy, writeData: () => undefined };
}

function state(
  snapshots: [number, Person | typeof ABSENT][] = [],
  open: number[] = []
): EditingState<Person> {
  return { snapshots: new Map(snapshots), open: new Set(open) };
}

/** Every updater must preserve it — `pendingIds` derives from it (D31.5). */
function openIsSubsetOfSnapshots(result: EditingState<Person>): boolean {
  return [...result.open].every((id) => result.snapshots.has(id));
}

describe('addNewRow', () => {
  let written: Person[] | undefined;

  function writingCtx(data: Person[] = rows) {
    written = undefined;
    return { data, trackBy, writeData: (next: Person[]) => void (written = next) };
  }

  it('writes the row into data and opens it in one updater (D35)', () => {
    const result = addNewRow<Person>({ id: 99, name: '' }, { at: 0 })(state(), writingCtx());

    expect(written?.[0]).toEqual({ id: 99, name: '' });
    expect(result.open.has(99)).toBe(true);
    expect(openIsSubsetOfSnapshots(result)).toBe(true);
  });

  it('captures the row itself as its restore point, not ABSENT (D36)', () => {
    const result = addNewRow<Person>({ id: 99, name: '' })(state(), writingCtx());

    expect(result.snapshots.get(99)).toEqual({ id: 99, name: '' });
  });

  it('honours `at` the way addRow does (D27)', () => {
    addNewRow<Person>({ id: 99, name: '' }, { at: 1 })(state(), writingCtx());

    expect(written?.map((row) => row.id)).toEqual([1, 99, 2, 3]);
  });

  it('no-ops for an id already in data — patchRow owns that case (D35)', () => {
    const before = state([[2, { id: 2, name: 'Bea' }]], [2]);
    const result = addNewRow<Person>({ id: 2, name: 'duplicate' })(before, writingCtx());

    expect(written).toBeUndefined();
    expect(result).toBe(before);
  });
});

describe('beginEdit', () => {
  it('captures the row currently in data as its restore point', () => {
    const result = beginEdit<Person>(2)(state(), ctx());
    expect(result.snapshots.get(2)).toEqual({ id: 2, name: 'Bea' });
    expect(result.open.has(2)).toBe(true);
  });

  it('captures ABSENT for an id not yet in data (D28 blank-row flow)', () => {
    const result = beginEdit<Person>(99)(state(), ctx());
    expect(result.snapshots.get(99)).toBe(ABSENT);
  });

  it('does not re-capture over an already-open row (D31.1)', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const result = beginEdit<Person>(2)(
      opened,
      ctx([{ id: 2, name: 'Bea-typing' }, ...rows.slice(1)])
    );
    expect(result.snapshots.get(2)).toEqual({ id: 2, name: 'Bea' });
  });

  it('re-opens a pending row, keeping the restore point from the first beginEdit (D31.1)', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const saved = endEdit<Person>(2, { keepSnapshot: true })(opened, ctx());

    const result = beginEdit<Person>(2)(
      saved,
      ctx([{ id: 2, name: 'optimistic' }, ...rows.slice(1)])
    );

    expect(result.snapshots.get(2)).toEqual({ id: 2, name: 'Bea' });
    expect(result.open.has(2)).toBe(true);
    expect(pendingIds(result).has(2)).toBe(false);
  });

  it('keeps open a subset of snapshots', () => {
    const result = beginEdit<Person>(2)(beginEdit<Person>(1)(state(), ctx()), ctx());
    expect(openIsSubsetOfSnapshots(result)).toBe(true);
  });
});

describe('endEdit', () => {
  it('closes the row and spends its restore point', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const result = endEdit<Person>(2)(opened, ctx());
    expect(result.open.has(2)).toBe(false);
    expect(result.snapshots.has(2)).toBe(false);
    expect(pendingIds(result).has(2)).toBe(false);
  });

  it('{ keepSnapshot: true } closes the row but holds the restore point, making it pending (D31)', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const result = endEdit<Person>(2, { keepSnapshot: true })(opened, ctx());

    expect(result.open.has(2)).toBe(false);
    expect(result.snapshots.get(2)).toEqual({ id: 2, name: 'Bea' });
    expect(pendingIds(result).has(2)).toBe(true);
  });

  it('is a no-op when the id is not open', () => {
    const current = state();
    const result = endEdit<Person>(999)(current, ctx());
    expect(result).toBe(current);
  });
});

describe('clearEditing', () => {
  it('closes every open row', () => {
    const opened = beginEdit<Person>(2)(beginEdit<Person>(1)(state(), ctx()), ctx());
    const result = clearEditing<Person>()(opened, ctx());
    expect(result.open.size).toBe(0);
  });

  it('drops the closed rows restore points, so none of them becomes pending', () => {
    const opened = beginEdit<Person>(2)(beginEdit<Person>(1)(state(), ctx()), ctx());
    const result = clearEditing<Person>()(opened, ctx());
    expect(pendingIds(result).size).toBe(0);
    expect(result.snapshots.size).toBe(0);
  });

  it('leaves an already-pending row alone — it is not open (D31.3)', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const saved = endEdit<Person>(2, { keepSnapshot: true })(opened, ctx());

    const result = clearEditing<Person>()(saved, ctx());

    expect(result.snapshots.get(2)).toEqual({ id: 2, name: 'Bea' });
    expect(pendingIds(result).has(2)).toBe(true);
  });

  it('is a no-op when nothing is open', () => {
    const current = state();
    const result = clearEditing<Person>()(current, ctx());
    expect(result).toBe(current);
  });
});

describe('revertEdit', () => {
  it('restores the snapshot into data and closes the row', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    let written: Person[] | undefined;
    const result = revertEdit<Person>(2)(opened, {
      data: [{ id: 1, name: 'Ada' }, { id: 2, name: 'Bea-typing' }, { id: 3, name: 'Cid' }],
      trackBy,
      writeData: (next) => (written = next),
    });

    expect(written?.find((r) => r.id === 2)).toEqual({ id: 2, name: 'Bea' });
    expect(result.open.has(2)).toBe(false);
    expect(result.snapshots.has(2)).toBe(false);
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
    expect(result.open.has(99)).toBe(false);
  });

  it('addNewRow\'s snapshot resets rather than removes on plain revertEdit (D36)', () => {
    const opened = addNewRow<Person>({ id: 99, name: '' })(state(), ctx());
    let written: Person[] | undefined;
    const dataWithNewRow = [...rows, { id: 99, name: 'typed' }];

    const result = revertEdit<Person>(99)(opened, {
      data: dataWithNewRow,
      trackBy,
      writeData: (next) => (written = next),
    });

    expect(written?.find((r) => r.id === 99)).toEqual({ id: 99, name: '' });
    expect(result.open.has(99)).toBe(false);
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
    expect(pendingIds(result).has(2)).toBe(false);
  });

  it('is a no-op when the id holds no restore point', () => {
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
    expect(result.snapshots.get(2)).toEqual({ id: 2, name: 'Bea-refreshed' });
  });

  it('sets an explicit restore point when row is provided', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const result = rebaseEdit<Person>(2, { id: 2, name: 'Server value' })(opened, ctx());
    expect(result.snapshots.get(2)).toEqual({ id: 2, name: 'Server value' });
  });

  it('is a no-op for a pending row — settleEdit owns that restore point (D31.3)', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const saved = endEdit<Person>(2, { keepSnapshot: true })(opened, ctx());

    const result = rebaseEdit<Person>(2)(saved, ctx([{ id: 2, name: 'moved-on' }, ...rows.slice(1)]));

    expect(result).toBe(saved);
    expect(result.snapshots.get(2)).toEqual({ id: 2, name: 'Bea' });
  });

  it('is a no-op when the id is not being edited', () => {
    const current = state();
    const result = rebaseEdit<Person>(999)(current, ctx());
    expect(result).toBe(current);
  });
});

describe('settleEdit', () => {
  it('settles a pending row once the save is confirmed (D31)', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const saved = endEdit<Person>(2, { keepSnapshot: true })(opened, ctx());

    const result = settleEdit<Person>(2)(saved, ctx());

    expect(result.snapshots.size).toBe(0);
    expect(result.open.size).toBe(0);
    expect(pendingIds(result).size).toBe(0);
  });

  it('is a no-op for a row that is still open - closing one is the job of endEdit', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const result = settleEdit<Person>(2)(opened, ctx());
    expect(result).toBe(opened);
    expect(result.open.has(2)).toBe(true);
  });

  it('is a no-op for an id holding no restore point', () => {
    const current = state();
    const result = settleEdit<Person>(999)(current, ctx());
    expect(result).toBe(current);
  });
});

describe('table.editing.update', () => {
  it('writes through the editing signal', () => {
    const fakeTable = createMockTableStoreWithEditing([...rows], trackBy);

    fakeTable.editing.update(beginEdit<Person>(2));

    expect(fakeTable.editing().has(2)).toBe(true);
    expect(fakeTable.pending().has(2)).toBe(false);
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
    expect(fakeTable.pending().has(2)).toBe(true);

    fakeTable.editing.update(revertEdit<Person>(2));

    expect(fakeTable.value().find((r) => r.id === 2)).toEqual({ id: 2, name: 'Bea' });
    expect(fakeTable.pending().size).toBe(0);
  });

  it('addNewRow adds and opens in one write; discarding on Cancel is composed explicitly (D36)', () => {
    const fakeTable = createMockTableStoreWithEditing<Person>([], trackBy);

    fakeTable.editing.update(addNewRow<Person>({ id: 99, name: '' }, { at: 0 }));

    expect(fakeTable.value()).toEqual([{ id: 99, name: '' }]);
    expect(fakeTable.editing().has(99)).toBe(true);

    // Discard is composed, not a `revertEdit` option — same shape Save composes with `patchRow`.
    fakeTable.value.update(removeRow<Person>(99));
    fakeTable.editing.update(endEdit<Person>(99));

    expect(fakeTable.value()).toEqual([]);
    expect(fakeTable.editing().has(99)).toBe(false);
  });

  it('addNewRow + plain revertEdit resets the row instead of removing it (D36)', () => {
    const fakeTable = createMockTableStoreWithEditing<Person>([], trackBy);

    fakeTable.editing.update(addNewRow<Person>({ id: 99, name: '' }, { at: 0 }));
    fakeTable.value.update((data) => data.map((r) => (r.id === 99 ? { ...r, name: 'typed' } : r)));

    fakeTable.editing.update(revertEdit<Person>(99));

    expect(fakeTable.value()).toEqual([{ id: 99, name: '' }]);
    expect(fakeTable.editing().has(99)).toBe(false);
  });

  it('the optimistic-save round trip: close-with-snapshot, succeed, settle (D31)', () => {
    const fakeTable = createMockTableStoreWithEditing([...rows], trackBy);

    fakeTable.editing.update(beginEdit<Person>(2));
    fakeTable.value.update((data) => data.map((r) => (r.id === 2 ? { ...r, name: 'typed' } : r)));
    fakeTable.editing.update(endEdit<Person>(2, { keepSnapshot: true }));
    fakeTable.editing.update(settleEdit<Person>(2));

    expect(fakeTable.pending().size).toBe(0);
    expect(fakeTable.editing().size).toBe(0);
    expect(fakeTable.value().find((r) => r.id === 2)).toEqual({ id: 2, name: 'typed' });
  });
});
