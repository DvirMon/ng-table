import {
  pendingIds,
  type EditingState,
  type PendingOp,
  type RowRestorePoint,
} from '../api/features/editing/state';
import { beginEdit, clearEdit, createRow, endEdit } from './row-edit-mutations';
import { releaseEdit, revertEdit } from './optimistic-mutations';
import { removeRow } from './row-mutations';
import type { RowId } from '../api/types';
import { createMockTableStoreWithEditing, mockRows, mockTrackBy, type MockRow } from '../table.mock';

type Person = MockRow;

const trackBy = mockTrackBy;
const rows: Person[] = mockRows;

function indexById(data: Person[] = rows): ReadonlyMap<RowId, number> {
  const map = new Map<RowId, number>();
  data.forEach((row, i) => map.set(trackBy(row), i));
  return map;
}

function ctx(data: Person[] = rows) {
  return { data, trackBy, writeData: () => undefined, indexById: indexById(data) };
}

function state(
  snapshots: [number, RowRestorePoint<Person>][] = [],
  open: number[] = [],
  unconfirmed: number[] = []
): EditingState<Person> {
  return { snapshots: new Map(snapshots), open: new Set(open), unconfirmed: new Set(unconfirmed) };
}

function restorePoint(row: Person, at: number, op: PendingOp = 'update'): RowRestorePoint<Person> {
  return { row, at, op };
}

/** Every updater must preserve it — `pendingIds` derives from it (D31.5). */
function openIsSubsetOfSnapshots(result: EditingState<Person>): boolean {
  return [...result.open].every((id) => result.snapshots.has(id));
}

describe('beginEdit', () => {
  it('captures the row currently in data as its restore point', () => {
    const result = beginEdit<Person>(2)(state(), ctx());
    expect(result.snapshots.get(2)).toEqual(restorePoint({ id: 2, name: 'Bea' }, 1));
    expect(result.open.has(2)).toBe(true);
    expect(result.unconfirmed.has(2)).toBe(false); // an update, not a create
  });

  it('opens an id not in data without `{ insert }`, but sets no snapshot (misuse case)', () => {
    const result = beginEdit<Person>(99)(state(), ctx());
    expect(result.open.has(99)).toBe(true);
    expect(result.snapshots.has(99)).toBe(false);
  });

  it('does not re-capture over an already-open row (D31.1)', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const result = beginEdit<Person>(2)(
      opened,
      ctx([{ id: 2, name: 'Bea-typing' }, ...rows.slice(1)])
    );
    expect(result.snapshots.get(2)).toEqual(restorePoint({ id: 2, name: 'Bea' }, 1));
  });

  it('re-opens a pending row, keeping the restore point from the first beginEdit (D31.1)', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const saved = endEdit<Person>(2)(opened, ctx());

    const result = beginEdit<Person>(2)(
      saved,
      ctx([{ id: 2, name: 'optimistic' }, ...rows.slice(1)])
    );

    expect(result.snapshots.get(2)).toEqual(restorePoint({ id: 2, name: 'Bea' }, 1));
    expect(result.open.has(2)).toBe(true);
    expect(pendingIds(result).has(2)).toBe(false);
  });

  it('keeps open a subset of snapshots', () => {
    const result = beginEdit<Person>(2)(beginEdit<Person>(1)(state(), ctx()), ctx());
    expect(openIsSubsetOfSnapshots(result)).toBe(true);
  });
});

describe('beginEdit({ insert })', () => {
  let written: Person[] | undefined;

  function writingCtx(data: Person[] = rows) {
    written = undefined;
    return { data, trackBy, writeData: (next: Person[]) => void (written = next), indexById: indexById(data) };
  }

  it('writes the row into data and opens it in one updater (D35/D42)', () => {
    const result = beginEdit<Person>(99, { insert: { id: 99, name: '' }, at: 0 })(
      state(),
      writingCtx()
    );

    expect(written?.[0]).toEqual({ id: 99, name: '' });
    expect(result.open.has(99)).toBe(true);
    expect(openIsSubsetOfSnapshots(result)).toBe(true);
  });

  it('captures the row itself as its restore point (D36)', () => {
    const result = beginEdit<Person>(99, { insert: { id: 99, name: '' } })(state(), writingCtx());

    // Appended (no `at`) to the 3-row fixture — lands at index 3.
    expect(result.snapshots.get(99)).toEqual(restorePoint({ id: 99, name: '' }, 3, 'create'));
  });

  it('marks the inserted id unconfirmed (D54)', () => {
    const result = beginEdit<Person>(99, { insert: { id: 99, name: '' } })(state(), writingCtx());
    expect(result.unconfirmed.has(99)).toBe(true);
  });

  it('honours `at` the way insertRow does (D27)', () => {
    beginEdit<Person>(99, { insert: { id: 99, name: '' }, at: 1 })(state(), writingCtx());

    expect(written?.map((row) => row.id)).toEqual([1, 99, 2, 3]);
  });

  it('no-ops for an id already in data — patchRow owns that case (D35)', () => {
    const before = state([[2, restorePoint({ id: 2, name: 'Bea' }, 1)]], []);
    const result = beginEdit<Person>(2, { insert: { id: 2, name: 'duplicate' } })(
      before,
      writingCtx()
    );

    expect(written).toBeUndefined();
    expect(result).toBe(before);
  });
});

describe('createRow (array form, D32)', () => {
  let written: Person[] | undefined;

  function writingCtx(data: Person[] = rows) {
    written = undefined;
    return { data, trackBy, writeData: (next: Person[]) => void (written = next), indexById: indexById(data) };
  }

  it('opens every entry in one write — one data splice, one { snapshots, open }', () => {
    const result = createRow<Person>(
      [
        { id: 98, row: { id: 98, name: '' } },
        { id: 99, row: { id: 99, name: '' } },
      ],
      { at: 0 },
    )(state(), writingCtx());

    expect(written?.map((r) => r.id)).toEqual([98, 99, 1, 2, 3]);
    expect(result.open.has(98)).toBe(true);
    expect(result.open.has(99)).toBe(true);
    expect(result.snapshots.get(98)).toEqual(restorePoint({ id: 98, name: '' }, 0, 'create'));
    expect(result.snapshots.get(99)).toEqual(restorePoint({ id: 99, name: '' }, 1, 'create'));
    expect(result.unconfirmed.has(98)).toBe(true);
    expect(result.unconfirmed.has(99)).toBe(true);
  });

  it('skips an entry whose id already exists in data, still writes the rest (no-op per entry)', () => {
    const result = createRow<Person>(
      [
        { id: 2, row: { id: 2, name: 'dup' } },
        { id: 99, row: { id: 99, name: '' } },
      ],
      { at: 0 },
    )(state(), writingCtx());

    expect(written?.map((r) => r.id)).toEqual([99, 1, 2, 3]);
    expect(result.open.has(2)).toBe(false);
    expect(result.open.has(99)).toBe(true);
  });

  it('is a no-op (no write at all) when every entry collides', () => {
    const before = state();
    const result = createRow<Person>([{ id: 2, row: { id: 2, name: 'dup' } }])(before, writingCtx());

    expect(written).toBeUndefined();
    expect(result).toBe(before);
  });
});

describe('endEdit', () => {
  it('closes the row but holds the restore point, making it pending (D31/D41)', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const result = endEdit<Person>(2)(opened, ctx());

    expect(result.open.has(2)).toBe(false);
    expect(result.snapshots.get(2)).toEqual(restorePoint({ id: 2, name: 'Bea' }, 1));
    expect(pendingIds(result).has(2)).toBe(true);
  });

  it('paired with releaseEdit, ends the row with nothing left to roll back (D41)', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const closed = endEdit<Person>(2)(opened, ctx());
    const result = releaseEdit<Person>(2)(closed, ctx());

    expect(result.open.has(2)).toBe(false);
    expect(result.snapshots.has(2)).toBe(false);
    expect(pendingIds(result).has(2)).toBe(false);
  });

  it('is a no-op when the id is not open', () => {
    const current = state();
    const result = endEdit<Person>(999)(current, ctx());
    expect(result).toBe(current);
  });
});

// D44 note: `clearEdit()` cannot be spelled as a bulk `endEdit()` + `releaseEdit()` because
// neither has a bulk form — both take a required id (D41). The hazard is closed by the API shape,
// so there is no runtime behavior left to regression-test here.
describe('clearEdit', () => {
  it('closes every open row', () => {
    const opened = beginEdit<Person>(2)(beginEdit<Person>(1)(state(), ctx()), ctx());
    const result = clearEdit<Person>()(opened, ctx());
    expect(result.open.size).toBe(0);
  });

  it('drops the closed rows restore points, so none of them becomes pending', () => {
    const opened = beginEdit<Person>(2)(beginEdit<Person>(1)(state(), ctx()), ctx());
    const result = clearEdit<Person>()(opened, ctx());
    expect(pendingIds(result).size).toBe(0);
    expect(result.snapshots.size).toBe(0);
  });

  it('leaves an already-pending row alone — it is not open (D31.3)', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const saved = endEdit<Person>(2)(opened, ctx());

    const result = clearEdit<Person>()(saved, ctx());

    expect(result.snapshots.get(2)).toEqual(restorePoint({ id: 2, name: 'Bea' }, 1));
    expect(pendingIds(result).has(2)).toBe(true);
  });

  it('is a no-op when nothing is open', () => {
    const current = state();
    const result = clearEdit<Person>()(current, ctx());
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

  it('beginEdit({ insert }) adds and opens in one write; discarding on Cancel is composed explicitly (D36/D42)', () => {
    const fakeTable = createMockTableStoreWithEditing<Person>([], trackBy);

    fakeTable.editing.update(beginEdit<Person>(99, { insert: { id: 99, name: '' }, at: 0 }));

    expect(fakeTable.value()).toEqual([{ id: 99, name: '' }]);
    expect(fakeTable.editing().has(99)).toBe(true);

    // Discard is composed, not a `revertEdit` option — same shape Save composes with `patchRow`.
    fakeTable.value.update(removeRow<Person>(99));
    fakeTable.editing.update(endEdit<Person>(99));
    fakeTable.editing.update(releaseEdit<Person>(99));

    expect(fakeTable.value()).toEqual([]);
    expect(fakeTable.editing().has(99)).toBe(false);
    expect(fakeTable.pending().has(99)).toBe(false);
  });

  it('beginEdit({ insert }) + plain revertEdit resets the row instead of removing it (D36)', () => {
    const fakeTable = createMockTableStoreWithEditing<Person>([], trackBy);

    fakeTable.editing.update(beginEdit<Person>(99, { insert: { id: 99, name: '' }, at: 0 }));
    fakeTable.value.update((data) => data.map((r) => (r.id === 99 ? { ...r, name: 'typed' } : r)));

    fakeTable.editing.update(revertEdit<Person>(99));

    expect(fakeTable.value()).toEqual([{ id: 99, name: '' }]);
    expect(fakeTable.editing().has(99)).toBe(false);
  });
});
