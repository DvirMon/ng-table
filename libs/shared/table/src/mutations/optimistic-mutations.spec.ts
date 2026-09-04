import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { pendingIds, type EditingState, type RowRestorePoint } from '../api/features/editing-state';
import { createTable } from '../api/create-table';
import { withRowEdit } from '../api/features/with-row-edit';
import {
  captureEdit,
  discardEdit,
  patchEdit,
  releaseEdit,
  removeEdit,
  revertEdit,
  swapRowId,
} from './optimistic-mutations';
import { patchRow } from './row-mutations';
import { beginEdit, createRow, endEdit } from './row-edit-mutations';
import type { ColumnDef, RowId } from '../api/types';
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
  open: number[] = []
): EditingState<Person> {
  return { snapshots: new Map(snapshots), open: new Set(open) };
}

function restorePoint(row: Person, at: number, detached = false): RowRestorePoint<Person> {
  return { row, at, detached };
}

describe('captureEdit', () => {
  it('re-reads data() when row is omitted', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const refreshed = rows.map((r) => (r.id === 2 ? { id: 2, name: 'Bea-refreshed' } : r));
    const result = captureEdit<Person>(2)(opened, ctx(refreshed));
    expect(result.snapshots.get(2)).toEqual(restorePoint({ id: 2, name: 'Bea-refreshed' }, 1));
  });

  it('sets an explicit restore point when row is provided', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const result = captureEdit<Person>(2, { id: 2, name: 'Server value' })(opened, ctx());
    expect(result.snapshots.get(2)).toEqual(restorePoint({ id: 2, name: 'Server value' }, 1));
  });

  it('no-ops when neither an explicit row nor a data lookup finds the row', () => {
    const before = state();
    const result = captureEdit<Person>(99)(before, ctx());
    expect(result).toBe(before);
    expect(result.snapshots.has(99)).toBe(false);
  });

  it('overwrites, unlike beginEdit which keeps the oldest restore point (D31.1/D40)', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const moved = ctx(rows.map((r) => (r.id === 2 ? { id: 2, name: 'moved-on' } : r)));

    expect(beginEdit<Person>(2)(opened, moved).snapshots.get(2)).toEqual(
      restorePoint({ id: 2, name: 'Bea' }, 1)
    );
    expect(captureEdit<Person>(2)(opened, moved).snapshots.get(2)).toEqual(
      restorePoint({ id: 2, name: 'moved-on' }, 1)
    );
  });

  it('captures on a row that is not open — the live-table entry point (D39/D40)', () => {
    const result = captureEdit<Person>(2)(state(), ctx());

    expect(result.open.size).toBe(0);
    expect(result.snapshots.get(2)).toEqual(restorePoint({ id: 2, name: 'Bea' }, 1));
    // With nothing open, every restore point is in flight.
    expect(pendingIds(result).has(2)).toBe(true);
  });

  it('moves a pending rows restore point forward — D34s open-only guard is gone (D40)', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const pending = endEdit<Person>(2)(opened, ctx());
    const moved = rows.map((r) => (r.id === 2 ? { id: 2, name: 'moved-on' } : r));

    const result = captureEdit<Person>(2)(pending, ctx(moved));

    expect(result.snapshots.get(2)).toEqual(restorePoint({ id: 2, name: 'moved-on' }, 1));
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
    const data = [
      { id: 1, name: 'Ada' },
      { id: 2, name: 'Bea-typing' },
      { id: 3, name: 'Cid' },
    ];
    const result = revertEdit<Person>(2)(opened, {
      data,
      trackBy,
      writeData: (next) => (written = next),
      indexById: indexById(data),
    });

    expect(written?.find((r) => r.id === 2)).toEqual({ id: 2, name: 'Bea' });
    expect(result.open.has(2)).toBe(false);
    expect(result.snapshots.has(2)).toBe(false);
  });

  it('re-inserts a deleted row at its captured index and closes it (Change 2)', () => {
    const snapshotState = state([[2, restorePoint({ id: 2, name: 'Bea' }, 1, true)]]);
    const dataWithoutRow = rows.filter((r) => r.id !== 2);
    let written: Person[] | undefined;

    const result = revertEdit<Person>(2)(snapshotState, {
      data: dataWithoutRow,
      trackBy,
      writeData: (next) => (written = next),
      indexById: indexById(dataWithoutRow),
    });

    expect(written?.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(written?.find((r) => r.id === 2)).toEqual({ id: 2, name: 'Bea' });
    expect(result.open.has(2)).toBe(false);
    expect(result.snapshots.has(2)).toBe(false);
  });

  it('replaces a present row in place, ignoring the snapshots at', () => {
    // `at` deliberately wrong (0) — a present row is replaced in place, not moved.
    const snapshotState = state([[2, restorePoint({ id: 2, name: 'Bea' }, 0)]]);
    const data = rows.map((r) => (r.id === 2 ? { id: 2, name: 'Bea-typing' } : r));
    let written: Person[] | undefined;

    revertEdit<Person>(2)(snapshotState, {
      data,
      trackBy,
      writeData: (next) => (written = next),
      indexById: indexById(data),
    });

    expect(written?.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(written?.find((r) => r.id === 2)).toEqual({ id: 2, name: 'Bea' });
  });

  it("an inserted row's snapshot resets rather than removes on plain revertEdit (D36)", () => {
    const opened = beginEdit<Person>(99, { insert: { id: 99, name: '' } })(state(), ctx());
    let written: Person[] | undefined;
    const dataWithNewRow = [...rows, { id: 99, name: 'typed' }];

    const result = revertEdit<Person>(99)(opened, {
      data: dataWithNewRow,
      trackBy,
      writeData: (next) => (written = next),
      indexById: indexById(dataWithNewRow),
    });

    expect(written?.find((r) => r.id === 99)).toEqual({ id: 99, name: '' });
    expect(result.open.has(99)).toBe(false);
  });

  it('uses a row override but the snapshots at when the row was removed', () => {
    const snapshotState = state([[2, restorePoint({ id: 2, name: 'Bea' }, 1, true)]]);
    const dataWithoutRow = rows.filter((r) => r.id !== 2);
    let written: Person[] | undefined;

    revertEdit<Person>(2, { id: 2, name: 'server-truth' })(snapshotState, {
      data: dataWithoutRow,
      trackBy,
      writeData: (next) => (written = next),
      indexById: indexById(dataWithoutRow),
    });

    expect(written?.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(written?.find((r) => r.id === 2)).toEqual({ id: 2, name: 'server-truth' });
  });

  it('writes the explicit row when one is provided, in place of the stored snapshot', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    let written: Person[] | undefined;

    revertEdit<Person>(2, { id: 2, name: 'server-truth' })(opened, {
      data: [...rows],
      trackBy,
      writeData: (next) => (written = next),
      indexById: indexById(rows),
    });

    expect(written?.find((r) => r.id === 2)).toEqual({ id: 2, name: 'server-truth' });
  });

  it('rolls back a pending row when the optimistic save failed (D31)', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const saved = endEdit<Person>(2)(opened, ctx());
    let written: Person[] | undefined;
    const data = [
      { id: 1, name: 'Ada' },
      { id: 2, name: 'optimistic' },
      { id: 3, name: 'Cid' },
    ];

    const result = revertEdit<Person>(2)(saved, {
      data,
      trackBy,
      writeData: (next) => (written = next),
      indexById: indexById(data),
    });

    expect(written?.find((r) => r.id === 2)).toEqual({ id: 2, name: 'Bea' });
    expect(pendingIds(result).has(2)).toBe(false);
  });

  it('is a no-op when the id holds no restore point', () => {
    const current = state();
    const result = revertEdit<Person>(999)(current, ctx());
    expect(result).toBe(current);
  });

  it('clamps a stale at on re-insert rather than throwing (D27)', () => {
    // Captured when the array had 3 rows and this row was last (at: 2); the array has since
    // shrunk, so `at` is now out of range and must clamp, not throw.
    const snapshotState = state([[3, restorePoint({ id: 3, name: 'Cid' }, 2, true)]]);
    const shrunkData = [{ id: 1, name: 'Ada' }];
    let written: Person[] | undefined;

    expect(() =>
      revertEdit<Person>(3)(snapshotState, {
        data: shrunkData,
        trackBy,
        writeData: (next) => (written = next),
        indexById: indexById(shrunkData),
      })
    ).not.toThrow();

    expect(written?.map((r) => r.id)).toEqual([1, 3]);
  });
});

describe('discardEdit', () => {
  it('no-ops when no restore point is held (OQ-C)', () => {
    const before = state();
    let written: Person[] | undefined;

    const result = discardEdit<Person>(2)(before, {
      data: rows,
      trackBy,
      writeData: (next) => (written = next),
      indexById: indexById(rows),
    });

    expect(result).toBe(before);
    expect(written).toBeUndefined();
  });

  it('removes the row and drops the snapshot/open when one is held', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    let written: Person[] | undefined;

    const result = discardEdit<Person>(2)(opened, {
      data: rows,
      trackBy,
      writeData: (next) => (written = next),
      indexById: indexById(rows),
    });

    expect(written?.map((r) => r.id)).toEqual([1, 3]);
    expect(result.snapshots.has(2)).toBe(false);
    expect(result.open.has(2)).toBe(false);
  });
});

describe('removeEdit', () => {
  it('is a no-op when the id is not present in data', () => {
    const before = state();
    let written: Person[] | undefined;

    const result = removeEdit<Person>(999)(before, {
      data: rows,
      trackBy,
      writeData: (next) => (written = next),
      indexById: indexById(rows),
    });

    expect(result).toBe(before);
    expect(written).toBeUndefined();
  });

  it('captures a detached restore point and removes the row when none is held', () => {
    const before = state();
    let written: Person[] | undefined;

    const result = removeEdit<Person>(2)(before, {
      data: rows,
      trackBy,
      writeData: (next) => (written = next),
      indexById: indexById(rows),
    });

    expect(written?.map((r) => r.id)).toEqual([1, 3]);
    expect(result.snapshots.get(2)).toEqual(restorePoint({ id: 2, name: 'Bea' }, 1, true));
    expect(result.open.has(2)).toBe(false);
  });

  it('on an already-open row, keeps the pre-edit row/at but flips detached true', () => {
    const opened = beginEdit<Person>(2)(state(), ctx()); // { row: Bea, at: 1, detached: false }
    let written: Person[] | undefined;

    const result = removeEdit<Person>(2)(opened, {
      data: rows,
      trackBy,
      writeData: (next) => (written = next),
      indexById: indexById(rows),
    });

    expect(written?.map((r) => r.id)).toEqual([1, 3]);
    expect(result.snapshots.get(2)).toEqual(restorePoint({ id: 2, name: 'Bea' }, 1, true));
    expect(result.open.has(2)).toBe(false);
  });
});

describe('patchEdit', () => {
  it('is a no-op when the id is not present in data', () => {
    const before = state();
    let written: Person[] | undefined;

    const result = patchEdit<Person>(999, { name: 'X' })(before, {
      data: rows,
      trackBy,
      writeData: (next) => (written = next),
      indexById: indexById(rows),
    });

    expect(result).toBe(before);
    expect(written).toBeUndefined();
  });

  it("default ('if-absent'): two successive patches then revert roll back to before the first", () => {
    let data = rows;
    let current = state();

    function patch(partial: Partial<Person>) {
      let written: Person[] | undefined;
      current = patchEdit<Person>(2, partial)(current, {
        data,
        trackBy,
        writeData: (next) => (written = next),
        indexById: indexById(data),
      });
      data = written ?? data;
    }

    patch({ name: 'first' });
    patch({ name: 'second' });

    expect(current.snapshots.get(2)).toEqual(restorePoint({ id: 2, name: 'Bea' }, 1));

    let reverted: Person[] | undefined;
    revertEdit<Person>(2)(current, {
      data,
      trackBy,
      writeData: (next) => (reverted = next),
      indexById: indexById(data),
    });

    expect(reverted?.find((r) => r.id === 2)).toEqual({ id: 2, name: 'Bea' });
  });

  it("{ capture: 'always' }: two successive patches then revert roll back only to before the latest", () => {
    let data = rows;
    let current = state();

    function patch(partial: Partial<Person>) {
      let written: Person[] | undefined;
      current = patchEdit<Person>(2, partial, { capture: 'always' })(current, {
        data,
        trackBy,
        writeData: (next) => (written = next),
        indexById: indexById(data),
      });
      data = written ?? data;
    }

    patch({ name: 'first' });
    patch({ name: 'second' });

    expect(current.snapshots.get(2)).toEqual(restorePoint({ id: 2, name: 'first' }, 1));

    let reverted: Person[] | undefined;
    revertEdit<Person>(2)(current, {
      data,
      trackBy,
      writeData: (next) => (reverted = next),
      indexById: indexById(data),
    });

    expect(reverted?.find((r) => r.id === 2)).toEqual({ id: 2, name: 'first' });
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

describe('swapRowId', () => {
  it("re-keys an open entry: 'from' gone, 'to' present, same membership otherwise", () => {
    const opened = beginEdit<Person>(2)(state(), ctx());
    const withThird = beginEdit<Person>(3)(opened, ctx());

    const result = swapRowId<Person>(2, 99)(withThird, ctx());

    expect(result.open.has(2)).toBe(false);
    expect(result.open.has(99)).toBe(true);
    expect(result.open.has(3)).toBe(true);
    expect(result.open.size).toBe(2);
  });

  it('re-keys a snapshots entry, preserving the restore point unchanged except the key', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());

    const result = swapRowId<Person>(2, 99)(opened, ctx());

    expect(result.snapshots.has(2)).toBe(false);
    expect(result.snapshots.get(99)).toEqual(restorePoint({ id: 2, name: 'Bea' }, 1));
  });

  it('re-keys both open and snapshots in one call when the row holds both under from', () => {
    const opened = beginEdit<Person>(2)(state(), ctx());

    const result = swapRowId<Person>(2, 99)(opened, ctx());

    expect(result.open.has(99)).toBe(true);
    expect(result.snapshots.has(99)).toBe(true);
  });

  it('no-ops when from holds neither open nor a snapshot', () => {
    const before = state();
    const result = swapRowId<Person>(999, 1000)(before, ctx());
    expect(result).toBe(before);
  });

  describe('composed with withRowEdit (real store, real ADR-0006 reconciliation effect)', () => {
    function makeColumns(): ColumnDef<Person>[] {
      return [{ id: 'name', accessor: (row) => row.name, visible: true, order: 0, label: 'name' }];
    }

    function makeStore() {
      return TestBed.runInInjectionContext(() =>
        createTable(signal<Person[]>([...rows]), () => ({
          trackBy: 'id' as const,
          columns: makeColumns(),
          features: [withRowEdit<Person>()],
        }))
      );
    }

    it(
      'the ordering invariant: patchRow then swapRowId, synchronously, survives the ' +
        'ADR-0006 reconciliation effect flush — the row stays open under the new id',
      () => {
        const store = makeStore();
        const tempId = 100;
        const draft: Person = { id: tempId, name: 'new person' };

        store.editing.update(createRow<Person>(tempId, draft));
        expect(store.editing().has(tempId)).toBe(true);

        const saved: Person = { id: 200, name: 'new person' };
        store.value.update(patchRow<Person>(tempId, saved));
        store.editing.update(swapRowId<Person>(tempId, saved.id));

        TestBed.tick(); // flushes the ADR-0006 effect — must not prune `saved.id`

        expect(store.editing().has(saved.id)).toBe(true);
        expect(store.editing().has(tempId)).toBe(false);
        expect(store.pending().has(saved.id)).toBe(false); // still open, not pending
      }
    );

    it('optimistic-create end-to-end: create, swap on confirm, still editable, then revert', () => {
      const store = makeStore();
      const tempId = 101;
      const draft: Person = { id: tempId, name: 'draft person' };

      store.editing.update(createRow<Person>(tempId, draft));

      const saved: Person = { id: 201, name: 'draft person' };
      store.value.update(patchRow<Person>(tempId, saved));
      store.editing.update(swapRowId<Person>(tempId, saved.id));
      TestBed.tick();

      expect(store.editing().has(saved.id)).toBe(true);

      store.editing.update(revertEdit<Person>(saved.id));

      expect(store.editing().has(saved.id)).toBe(false);
      expect(store.pending().has(saved.id)).toBe(false);
    });
  });
});
