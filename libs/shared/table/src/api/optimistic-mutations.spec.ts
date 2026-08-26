import { ABSENT, pendingIds, type EditingState } from './features/editing-state';
import { captureEdit, releaseEdit, revertEdit } from './optimistic-mutations';
import { beginEdit, endEdit } from './row-edit-mutations';
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

describe('captureEdit', () => {
  it('re-reads data() when row is omitted', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const result = captureEdit<Person>(2)(
      opened,
      ctx([{ id: 2, name: 'Bea-refreshed' }, ...rows.slice(1)])
    );
    expect(result.snapshots.get(2)).toEqual({ id: 2, name: 'Bea-refreshed' });
  });

  it('sets an explicit restore point when row is provided', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const result = captureEdit<Person>(2, { id: 2, name: 'Server value' })(opened, ctx());
    expect(result.snapshots.get(2)).toEqual({ id: 2, name: 'Server value' });
  });

  it('captures ABSENT when the id is no longer in data', () => {
    const result = captureEdit<Person>(99)(state(), ctx());
    expect(result.snapshots.get(99)).toBe(ABSENT);
  });

  it('overwrites, unlike beginEdit which keeps the oldest restore point (D31.1/D40)', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const moved = ctx([{ id: 2, name: 'moved-on' }, ...rows.slice(1)]);

    expect(beginEdit<Person>(2)(opened, moved).snapshots.get(2)).toEqual({ id: 2, name: 'Bea' });
    expect(captureEdit<Person>(2)(opened, moved).snapshots.get(2)).toEqual({
      id: 2,
      name: 'moved-on',
    });
  });

  it('captures on a row that is not open — the live-table entry point (D39/D40)', () => {
    const result = captureEdit<Person>(2)(state(), ctx());

    expect(result.open.size).toBe(0);
    expect(result.snapshots.get(2)).toEqual({ id: 2, name: 'Bea' });
    // With nothing open, every restore point is in flight.
    expect(pendingIds(result).has(2)).toBe(true);
  });

  it('moves a pending rows restore point forward — D34s open-only guard is gone (D40)', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const pending = endEdit<Person>(2)(opened, ctx());

    const result = captureEdit<Person>(2)(pending, ctx([{ id: 2, name: 'moved-on' }, ...rows.slice(1)]));

    expect(result.snapshots.get(2)).toEqual({ id: 2, name: 'moved-on' });
  });
});

describe('releaseEdit', () => {
  it('releases a pending row once the save is confirmed (D31/D41)', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const saved = endEdit<Person>(2)(opened, ctx());

    const result = releaseEdit<Person>(2)(saved, ctx());

    expect(result.snapshots.size).toBe(0);
    expect(result.open.size).toBe(0);
    expect(pendingIds(result).size).toBe(0);
  });

  it('releases a live-table restore point, which was never open (D39)', () => {
    const captured = captureEdit<Person>(2)(state(), ctx());

    const result = releaseEdit<Person>(2)(captured, ctx());

    expect(result.snapshots.size).toBe(0);
    expect(pendingIds(result).size).toBe(0);
  });

  it('is a no-op for a row that is still open - closing one is the job of endEdit', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const result = releaseEdit<Person>(2)(opened, ctx());
    expect(result).toBe(opened);
    expect(result.open.has(2)).toBe(true);
  });

  it('is a no-op for an id holding no restore point', () => {
    const current = state();
    const result = releaseEdit<Person>(999)(current, ctx());
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

  it("an inserted row's snapshot resets rather than removes on plain revertEdit (D36)", () => {
    const opened = beginEdit<Person>(99, { insert: { id: 99, name: '' } })(state(), ctx());
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

  it('writes the explicit row when one is provided, in place of the stored snapshot', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    let written: Person[] | undefined;

    revertEdit<Person>(2, { id: 2, name: 'server-truth' })(opened, {
      data: [...rows],
      trackBy,
      writeData: (next) => (written = next),
    });

    expect(written?.find((r) => r.id === 2)).toEqual({ id: 2, name: 'server-truth' });
  });

  it('rolls back a pending row when the optimistic save failed (D31)', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const saved = endEdit<Person>(2)(opened, ctx());
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

describe('the live-table round trip (D39)', () => {
  it('capture, write, revert — no row is ever open', () => {
    const fakeTable = createMockTableStoreWithEditing([...rows], trackBy);

    // focus
    fakeTable.editing.update(captureEdit<Person>(2));
    // blur: the write lands optimistically
    fakeTable.value.update((data) => data.map((r) => (r.id === 2 ? { ...r, name: 'typed' } : r)));

    expect(fakeTable.editing().size).toBe(0);
    expect(fakeTable.pending().has(2)).toBe(true);

    // the server rejects it
    fakeTable.editing.update(revertEdit<Person>(2));

    expect(fakeTable.value().find((r) => r.id === 2)).toEqual({ id: 2, name: 'Bea' });
    expect(fakeTable.pending().size).toBe(0);
  });

  it('capture, write, release — the confirmed value stands', () => {
    const fakeTable = createMockTableStoreWithEditing([...rows], trackBy);

    fakeTable.editing.update(captureEdit<Person>(2));
    fakeTable.value.update((data) => data.map((r) => (r.id === 2 ? { ...r, name: 'typed' } : r)));
    fakeTable.editing.update(releaseEdit<Person>(2));

    expect(fakeTable.pending().size).toBe(0);
    expect(fakeTable.value().find((r) => r.id === 2)).toEqual({ id: 2, name: 'typed' });
  });
});

describe('the gated optimistic-save round trip (D31)', () => {
  it('close-with-snapshot, fail, roll back', () => {
    const fakeTable = createMockTableStoreWithEditing([...rows], trackBy);

    fakeTable.editing.update(beginEdit<Person>(2));
    fakeTable.value.update((data) => data.map((r) => (r.id === 2 ? { ...r, name: 'typed' } : r)));
    fakeTable.editing.update(endEdit<Person>(2));

    expect(fakeTable.editing().size).toBe(0);
    expect(fakeTable.pending().has(2)).toBe(true);

    fakeTable.editing.update(revertEdit<Person>(2));

    expect(fakeTable.value().find((r) => r.id === 2)).toEqual({ id: 2, name: 'Bea' });
    expect(fakeTable.pending().size).toBe(0);
  });

  it('close-with-snapshot, succeed, release', () => {
    const fakeTable = createMockTableStoreWithEditing([...rows], trackBy);

    fakeTable.editing.update(beginEdit<Person>(2));
    fakeTable.value.update((data) => data.map((r) => (r.id === 2 ? { ...r, name: 'typed' } : r)));
    fakeTable.editing.update(endEdit<Person>(2));
    fakeTable.editing.update(releaseEdit<Person>(2));

    expect(fakeTable.pending().size).toBe(0);
    expect(fakeTable.editing().size).toBe(0);
    expect(fakeTable.value().find((r) => r.id === 2)).toEqual({ id: 2, name: 'typed' });
  });
});
