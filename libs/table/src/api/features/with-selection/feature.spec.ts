import { computed, signal, type Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expectTypeOf } from 'vitest';
import { removeRow } from '../../../mutations/row-mutations';
import { mockRows, mockTrackBy, noData, type MockRow } from '../../../table.mock';
import { createColumns } from '../../create-columns';
import { createTable } from '../../create-table';
import { withComputed } from '../with-computed';
import { withSelection, type SelectionChange, type SelectionMembers } from './feature';
import { withSorting } from '../with-sorting';
import type { ColumnDecl, ColumnSet, RowId, TableStore } from '../../types';

// Widened `TId` (plain `string`) — no `path.<id>` usage in this file.
function makeColumns(): ColumnSet<MockRow, readonly ColumnDecl<MockRow, string, unknown>[]> {
  return createColumns(noData<MockRow>(), (col) => [col('name')]);
}

/** Runs a `createTable()` build inside an Angular injection context. */
function inContext<T>(build: () => T): T {
  return TestBed.runInInjectionContext(build);
}

describe('withSelection', () => {
  it('toggle(id) adds, toggling again removes, and repeated toggles alternate', () => {
    const store = inContext(() =>
      createTable(
        signal<MockRow[]>(mockRows),
        { trackBy: mockTrackBy, columns: makeColumns() },
        withSelection(),
      ),
    );

    expect(store.selectedRows().has(1)).toBe(false);

    store.toggle(1);
    expect(store.selectedRows().has(1)).toBe(true);

    store.toggle(1);
    expect(store.selectedRows().has(1)).toBe(false);

    store.toggle(1);
    store.toggle(1);
    expect(store.selectedRows().has(1)).toBe(false);
  });

  it('select(ids)/deselect(ids) apply in one write; duplicate ids within a call collapse', () => {
    const store = inContext(() =>
      createTable(
        signal<MockRow[]>(mockRows),
        { trackBy: mockTrackBy, columns: makeColumns() },
        withSelection(),
      ),
    );

    store.select([1, 2, 1]);
    expect([...store.selectedRows()].sort()).toEqual([1, 2]);

    store.deselect([1, 3]);
    expect([...store.selectedRows()].sort()).toEqual([2]);
  });

  it('clearSelection() empties the set', () => {
    const store = inContext(() =>
      createTable(
        signal<MockRow[]>(mockRows),
        { trackBy: mockTrackBy, columns: makeColumns() },
        withSelection(),
      ),
    );

    store.select([1, 2]);
    store.clearSelection();
    expect(store.selectedRows().size).toBe(0);
  });

  it('with enableMultiRowSelection: false, toggling a second row replaces the first without throwing', () => {
    const store = inContext(() =>
      createTable(
        signal<MockRow[]>(mockRows),
        { trackBy: mockTrackBy, columns: makeColumns() },
        withSelection({ enableMultiRowSelection: false }),
      ),
    );

    store.toggle(1);
    expect([...store.selectedRows()]).toEqual([1]);

    store.toggle(2);
    expect([...store.selectedRows()]).toEqual([2]);
  });

  it('with enableMultiRowSelection: false, select([id]) replaces a differing previous selection without throwing', () => {
    const store = inContext(() =>
      createTable(
        signal<MockRow[]>(mockRows),
        { trackBy: mockTrackBy, columns: makeColumns() },
        withSelection({ enableMultiRowSelection: false }),
      ),
    );

    store.select([1]);
    expect([...store.selectedRows()]).toEqual([1]);

    store.select([2]);
    expect([...store.selectedRows()]).toEqual([2]);
  });

  it('with enableMultiRowSelection: false, select([a, b]) still throws — the call co-selects two ids itself', () => {
    const store = inContext(() =>
      createTable(
        signal<MockRow[]>(mockRows),
        { trackBy: mockTrackBy, columns: makeColumns() },
        withSelection({ enableMultiRowSelection: false }),
      ),
    );

    expect(() => store.select([1, 2])).toThrow();
  });

  it('with a per-row predicate, co-selection is forbidden only for the rows it names', () => {
    const store = inContext(() =>
      createTable(
        signal<MockRow[]>(mockRows),
        { trackBy: mockTrackBy, columns: makeColumns() },
        // Row 1 forbids co-selection; rows 2 and 3 allow it.
        withSelection({ enableMultiRowSelection: (row) => row.id !== 1 }),
      ),
    );

    store.select([2, 3]);
    expect([...store.selectedRows()].sort()).toEqual([2, 3]);

    store.toggle(1);
    expect([...store.selectedRows()]).toEqual([1]);
  });

  it('enableRowSelection blocks toggle() from adding a non-selectable row', () => {
    const store = inContext(() =>
      createTable(
        signal<MockRow[]>(mockRows),
        { trackBy: mockTrackBy, columns: makeColumns() },
        withSelection({ enableRowSelection: (row) => row.id !== 1 }),
      ),
    );

    store.toggle(1);
    expect(store.selectedRows().size).toBe(0);
  });

  it('enableRowSelection drops only the non-selectable ids from a select(ids) mixed array', () => {
    const store = inContext(() =>
      createTable(
        signal<MockRow[]>(mockRows),
        { trackBy: mockTrackBy, columns: makeColumns() },
        withSelection({ enableRowSelection: (row) => row.id !== 1 }),
      ),
    );

    store.select([1, 2]);
    expect([...store.selectedRows()]).toEqual([2]);
  });

  it('deselect() of an already-selected row is ungated even after the row becomes non-selectable', () => {
    const selectableIds = new Set([1, 2, 3]);
    const store = inContext(() =>
      createTable(
        signal<MockRow[]>(mockRows),
        { trackBy: mockTrackBy, columns: makeColumns() },
        withSelection({ enableRowSelection: (row) => selectableIds.has(row.id) }),
      ),
    );

    store.toggle(1);
    expect(store.selectedRows().has(1)).toBe(true);

    selectableIds.delete(1); // row 1 becomes non-selectable while selected

    store.deselect([1]);
    expect(store.selectedRows().has(1)).toBe(false);
  });

  it('enableRowSelection gates the initialSelection seed', () => {
    const store = inContext(() =>
      createTable(
        signal<MockRow[]>(mockRows),
        { trackBy: mockTrackBy, columns: makeColumns() },
        withSelection({
          initialSelection: [1, 2],
          enableRowSelection: (row) => row.id !== 1,
        }),
      ),
    );

    expect([...store.selectedRows()]).toEqual([2]);
  });

  it('enableRowSelection stays permissive for an id that resolves to no row (D8)', () => {
    const store = inContext(() =>
      createTable(
        signal<MockRow[]>(mockRows),
        { trackBy: mockTrackBy, columns: makeColumns() },
        withSelection({ enableRowSelection: () => false }),
      ),
    );

    store.toggle(999);
    expect(store.selectedRows().has(999)).toBe(true);
  });

  it('a write fully blocked by enableRowSelection emits no selectionChanged', () => {
    const store = inContext(() =>
      createTable(
        signal<MockRow[]>(mockRows),
        { trackBy: mockTrackBy, columns: makeColumns() },
        withSelection({ enableRowSelection: (row) => row.id !== 1 }),
      ),
    );

    const emissions: SelectionChange[] = [];
    store.selectionChanged.subscribe((change) => emissions.push(change));

    store.select([1]);
    expect(emissions).toEqual([]);
  });

  it('an id absent from the seeded row data still toggles/selects', () => {
    const store = inContext(() =>
      createTable(
        signal<MockRow[]>(mockRows),
        { trackBy: mockTrackBy, columns: makeColumns() },
        withSelection(),
      ),
    );

    store.toggle(999);
    expect(store.selectedRows().has(999)).toBe(true);
  });

  it('selectionStateOf(ids) returns none/some/all for the given id set, unaffected by ids outside it', () => {
    const store = inContext(() =>
      createTable(
        signal<MockRow[]>(mockRows),
        { trackBy: mockTrackBy, columns: makeColumns() },
        withSelection(),
      ),
    );

    expect(store.selectionStateOf([1, 2])).toBe('none');

    store.select([1]);
    expect(store.selectionStateOf([1, 2])).toBe('some');

    store.select([2]);
    expect(store.selectionStateOf([1, 2])).toBe('all');

    // A third, unrelated selected id must not affect the result for [1, 2].
    store.select([3]);
    expect(store.selectionStateOf([1, 2])).toBe('all');
  });

  it('isSelectable(id) mirrors enableRowSelection, permissive for an unresolvable id (D8, D61)', () => {
    const store = inContext(() =>
      createTable(
        signal<MockRow[]>(mockRows),
        { trackBy: mockTrackBy, columns: makeColumns() },
        withSelection({ enableRowSelection: (row) => row.id !== 1 }),
      ),
    );

    expect(store.isSelectable(1)).toBe(false);
    expect(store.isSelectable(2)).toBe(true);
    expect(store.isSelectable(999)).toBe(true);
  });

  it('D61: selectionStateOf(ids) matches select(ids) when the caller pre-filters with isSelectable', () => {
    const store = inContext(() =>
      createTable(
        signal<MockRow[]>(mockRows),
        { trackBy: mockTrackBy, columns: makeColumns() },
        withSelection({ enableRowSelection: (row) => row.id !== 1 }),
      ),
    );

    const ids = [1, 2, 3];
    const selectableIds = ids.filter(store.isSelectable);
    store.select(selectableIds);

    expect(store.selectionStateOf(selectableIds)).toBe('all');
  });

  it('every write verb emits exactly one selectionChanged delta with correct added/removed', () => {
    const store = inContext(() =>
      createTable(
        signal<MockRow[]>(mockRows),
        { trackBy: mockTrackBy, columns: makeColumns() },
        withSelection(),
      ),
    );

    const emissions: SelectionChange[] = [];
    store.selectionChanged.subscribe((change) => emissions.push(change));

    store.toggle(1);
    store.select([2, 3]);
    store.deselect([1]);
    store.clearSelection();

    expect(emissions).toEqual([
      { added: [1], removed: [] },
      { added: [2, 3], removed: [] },
      { added: [], removed: [1] },
      { added: [], removed: [2, 3] },
    ]);
  });

  it('a no-op write emits nothing; emitEvent: false changes state but emits nothing', () => {
    const store = inContext(() =>
      createTable(
        signal<MockRow[]>(mockRows),
        { trackBy: mockTrackBy, columns: makeColumns() },
        withSelection(),
      ),
    );

    const emissions: SelectionChange[] = [];
    store.selectionChanged.subscribe((change) => emissions.push(change));

    store.deselect([1]); // nothing selected yet — no-op
    store.select([]); // no-op
    store.clearSelection(); // already empty — no-op
    expect(emissions).toEqual([]);

    store.select([1], { emitEvent: false });
    expect(store.selectedRows().has(1)).toBe(true);
    expect(emissions).toEqual([]);
  });

  it('initialSelection seeds selectedRows and emits nothing, including to a subscriber attached right after construction', () => {
    const store = inContext(() =>
      createTable(
        signal<MockRow[]>(mockRows),
        { trackBy: mockTrackBy, columns: makeColumns() },
        withSelection({ initialSelection: [1, 2] }),
      ),
    );

    const emissions: SelectionChange[] = [];
    store.selectionChanged.subscribe((change) => emissions.push(change));

    expect([...store.selectedRows()].sort()).toEqual([1, 2]);
    expect(emissions).toEqual([]);
  });

  it('removing a selected row from data prunes its id from selectedRows and emits nothing', () => {
    const data = signal([...mockRows]);
    const store = inContext(() =>
      createTable(data, { trackBy: mockTrackBy, columns: makeColumns() }, withSelection()),
    );

    store.select([1, 2]);

    const emissions: SelectionChange[] = [];
    store.selectionChanged.subscribe((change) => emissions.push(change));

    data.update((rows) => rows.filter((row) => row.id !== 1));
    TestBed.tick();

    expect(store.selectedRows().has(1)).toBe(false);
    expect(store.selectedRows().has(2)).toBe(true);
    expect(emissions).toEqual([]);
  });

  it('removing a selected row via table.value.update(removeRow(...)) prunes its id and emits nothing', () => {
    const store = inContext(() =>
      createTable(
        signal([...mockRows]),
        { trackBy: mockTrackBy, columns: makeColumns() },
        withSelection(),
      ),
    );

    store.select([1, 2]);

    const emissions: SelectionChange[] = [];
    store.selectionChanged.subscribe((change) => emissions.push(change));

    store.value.update(removeRow(1));
    TestBed.tick();

    expect(store.selectedRows().has(1)).toBe(false);
    expect(store.selectedRows().has(2)).toBe(true);
    expect(emissions).toEqual([]);
  });

  it('selection is unaffected by sorting or by a data write that reorders without removing', () => {
    const data = signal([...mockRows]);
    const store = inContext(() =>
      createTable(
        data,
        { trackBy: mockTrackBy, columns: makeColumns() },
        withSelection(),
        withSorting(),
      ),
    );

    store.select([1, 2]);

    store.toggleSort('name');
    TestBed.tick();
    expect([...store.selectedRows()].sort()).toEqual([1, 2]);

    data.update((rows) => [...rows].reverse());
    TestBed.tick();
    expect([...store.selectedRows()].sort()).toEqual([1, 2]);
  });

  it('selectionChanged completes when the table is destroyed', () => {
    const store = inContext(() =>
      createTable(
        signal<MockRow[]>(mockRows),
        { trackBy: mockTrackBy, columns: makeColumns() },
        withSelection(),
      ),
    );

    let completed = false;
    store.selectionChanged.subscribe({ complete: () => (completed = true) });
    expect(completed).toBe(false);

    TestBed.resetTestingModule();

    expect(completed).toBe(true);
  });

  // Issue #39 acceptance: "the `hiddenSelected` example from the spec compiles and evaluates
  // correctly." The example is a count difference (selectedRows().size - rows().length), not a
  // set difference — asserted below is what it actually computes, not a literal "hidden" count.
  it('hiddenSelected (spec headline case): withComputed derives off withSelection, types and runtime', () => {
    const store = inContext(() =>
      createTable(
        signal([...mockRows]),
        { trackBy: mockTrackBy, columns: makeColumns() },
        withSelection(
          {
            enableMultiRowSelection: (row) => {
              expectTypeOf(row).toEqualTypeOf<MockRow>();
              return row.id !== 2;
            },
          },
          withComputed((s) => {
            expectTypeOf(s.selectedRows).toEqualTypeOf<Signal<ReadonlySet<RowId>>>();
            expectTypeOf(s.value).toEqualTypeOf<Signal<MockRow[]>>();
            return {
              hiddenSelected: computed(() => s.selectedRows().size - s.rows().length),
            };
          }),
        ),
      ),
    );

    expectTypeOf(store.hiddenSelected).toEqualTypeOf<Signal<number>>();

    expect(store.hiddenSelected()).toBe(-3);

    store.select([1]);
    expect(store.hiddenSelected()).toBe(-2);
  });

  // -------------------------------------------------------------------------------------
  // Type-level assertions. The vitest executor does NOT typecheck `expectTypeOf` — inert at
  // runtime, only enforced by `tsc -p libs/table/tsconfig.spec.json --noEmit`.
  // -------------------------------------------------------------------------------------
  describe('types', () => {
    it('withSelection() alone contributes exactly SelectionMembers, never widened to any', () => {
      const store = inContext(() =>
        createTable(
          signal<MockRow[]>(mockRows),
          { trackBy: mockTrackBy, columns: makeColumns() },
          withSelection(),
        ),
      );

      expectTypeOf<keyof typeof store>().toEqualTypeOf<
        keyof TableStore<MockRow> | keyof SelectionMembers
      >();
      expectTypeOf(store).not.toBeAny();
    });

    it('derive-first withSelection(withComputed(...)) compiles and contributes its member', () => {
      const store = inContext(() =>
        createTable(
          signal<MockRow[]>(mockRows),
          { trackBy: mockTrackBy, columns: makeColumns() },
          withSelection(withComputed((s) => ({ count: computed(() => s.selectedRows().size) }))),
        ),
      );

      expectTypeOf(store.count).toEqualTypeOf<Signal<number>>();
      expectTypeOf(store).toHaveProperty('selectedRows');
    });
  });
});
