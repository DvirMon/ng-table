import { computed, signal, type Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expectTypeOf } from 'vitest';
import { applySortNulls } from '../../schema/column-rules';
import { createTable } from '../create-table';
import { withComputed } from './with-computed';
import { withSorting, type SortingMembers } from './with-sorting';
import type { ColumnDef, SortRule, TableStore } from '../types';

interface Row {
  id: string;
  name: string;
  age: number;
  joined: Date;
  status: string;
}

function makeColumns(
  overrides: Partial<Record<string, Partial<ColumnDef<Row>>>> = {}
): ColumnDef<Row>[] {
  return [
    {
      id: 'name',
      accessor: (row) => row.name,
      visible: true,
      order: 0,
      label: 'name',
      ...overrides['name'],
    },
    {
      id: 'age',
      accessor: (row) => row.age,
      visible: true,
      order: 1,
      label: 'age',
      ...overrides['age'],
    },
    {
      id: 'joined',
      accessor: (row) => row.joined,
      visible: true,
      order: 2,
      label: 'joined',
      ...overrides['joined'],
    },
    {
      id: 'status',
      accessor: (row) => row.status,
      visible: true,
      order: 3,
      label: 'status',
      ...overrides['status'],
    },
  ];
}

function makeRows(): Row[] {
  return [
    { id: 'r1', name: 'Charlie', age: 40, joined: new Date('2024-03-01'), status: 'active' },
    { id: 'r2', name: 'Ann', age: 25, joined: new Date('2022-01-15'), status: 'inactive' },
    { id: 'r3', name: 'Bob', age: 30, joined: new Date('2023-06-10'), status: 'active' },
  ];
}

/** Runs `build` inside an Angular injection context — `createTable()` requires one unless
 *  `config.injector` is passed. */
function inContext<T>(build: () => T): T {
  return TestBed.runInInjectionContext(build);
}

describe('withSorting', () => {
  it('exposes an empty sorting array by default', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>([]), { trackBy: 'id', columns: makeColumns() }, withSorting())
    );

    expect(store.sorting()).toEqual([]);
  });

  it('toggleSort() cycles a column ascending -> descending -> unsorted', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>([]), { trackBy: 'id', columns: makeColumns() }, withSorting())
    );

    store.toggleSort('name');
    expect(store.sorting()).toEqual([{ columnId: 'name', direction: 'asc' }]);

    store.toggleSort('name');
    expect(store.sorting()).toEqual([{ columnId: 'name', direction: 'desc' }]);

    store.toggleSort('name');
    expect(store.sorting()).toEqual([]);
  });

  it('toggleSort() replaces the sort when a different column is clicked (default: single-column)', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>([]), { trackBy: 'id', columns: makeColumns() }, withSorting())
    );

    store.toggleSort('status');
    expect(store.sorting()).toEqual([{ columnId: 'status', direction: 'asc' }]);

    store.toggleSort('name');
    expect(store.sorting()).toEqual([{ columnId: 'name', direction: 'asc' }]);

    // Re-clicking the same (sole) column still cycles asc -> desc -> unsorted.
    store.toggleSort('name');
    expect(store.sorting()).toEqual([{ columnId: 'name', direction: 'desc' }]);

    store.toggleSort('name');
    expect(store.sorting()).toEqual([]);
  });

  it('is additive across columns with multi: true, preserving click-order priority', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>([]),
        { trackBy: 'id', columns: makeColumns() },
        withSorting({ multi: true })
      )
    );

    store.toggleSort('status');
    store.toggleSort('name');

    expect(store.sorting()).toEqual([
      { columnId: 'status', direction: 'asc' },
      { columnId: 'name', direction: 'asc' },
    ]);

    // Re-toggling an already-active column updates it in place rather than
    // moving it to the end of the priority order.
    store.toggleSort('status');
    expect(store.sorting()).toEqual([
      { columnId: 'status', direction: 'desc' },
      { columnId: 'name', direction: 'asc' },
    ]);
  });

  it('enableSorting: false makes toggleSort() a no-op for that column', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>([]),
        { trackBy: 'id', columns: makeColumns({ status: { enableSorting: false } }) },
        withSorting()
      )
    );

    store.toggleSort('status');

    expect(store.sorting()).toEqual([]);
  });

  it('sortDirections() derives a columnId -> direction lookup from sorting()', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>([]),
        { trackBy: 'id', columns: makeColumns() },
        withSorting({ multi: true })
      )
    );

    expect(store.sortDirections()).toEqual(new Map());

    store.toggleSort('status');
    store.toggleSort('name');

    expect(store.sortDirections()).toEqual(
      new Map([
        ['status', 'asc'],
        ['name', 'asc'],
      ])
    );

    store.toggleSort('status');
    expect(store.sortDirections().get('status')).toBe('desc');
  });

  it('setSorting() and clearSorting() drive state programmatically', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>([]), { trackBy: 'id', columns: makeColumns() }, withSorting())
    );

    const rules: SortRule[] = [{ columnId: 'age', direction: 'desc' }];
    store.setSorting(rules);
    expect(store.sorting()).toEqual(rules);

    store.clearSorting();
    expect(store.sorting()).toEqual([]);
  });

  it('sorts rendered rows using a custom sortFn when supplied', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        {
          trackBy: 'id',
          columns: makeColumns({
            name: { sortFn: (a, b) => b.name.localeCompare(a.name) }, // reversed
          }),
        },
        withSorting()
      )
    );

    store.toggleSort('name');

    expect(store.rows().map((row) => row.name)).toEqual([
      'Charlie',
      'Bob',
      'Ann',
    ]);
  });

  it('falls back to numeric comparison for number columns', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withSorting()
      )
    );

    store.toggleSort('age');

    expect(store.rows().map((row) => row.age)).toEqual([25, 30, 40]);
  });

  it('falls back to Date comparison for Date columns', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withSorting()
      )
    );

    store.toggleSort('joined');

    expect(store.rows().map((row) => row.id)).toEqual(['r2', 'r3', 'r1']);
  });

  it('falls back to locale string comparison for string columns', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withSorting()
      )
    );

    store.toggleSort('name');

    expect(store.rows().map((row) => row.name)).toEqual([
      'Ann',
      'Bob',
      'Charlie',
    ]);
  });

  it('applies multi-column priority order to rendered rows with multi: true', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withSorting({ multi: true })
      )
    );

    // status asc (active, active, inactive) then name asc within status
    store.toggleSort('status');
    store.toggleSort('name');

    expect(store.rows().map((row) => row.id)).toEqual(['r3', 'r1', 'r2']);
  });

  it('replaces the rendered sort with the default single-column behavior', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withSorting()
      )
    );

    // status asc would be (active, active, inactive), but clicking name
    // afterward replaces the sort entirely rather than adding a tie-break.
    store.toggleSort('status');
    store.toggleSort('name');

    expect(store.rows().map((row) => row.name)).toEqual([
      'Ann',
      'Bob',
      'Charlie',
    ]);
  });

  describe('manual mode', () => {
    it('updates sorting and fires sortChanged but skips client-side sort processing', () => {
      const rawRows = makeRows();
      const store = inContext(() =>
        createTable(
          signal<Row[]>(rawRows),
          { trackBy: 'id', columns: makeColumns() },
          withSorting({ manual: true })
        )
      );

      const emitted: SortRule[][] = [];
      store.sortChanged.subscribe((rules) => emitted.push(rules));

      store.toggleSort('name');

      expect(store.sorting()).toEqual([{ columnId: 'name', direction: 'asc' }]);
      expect(emitted).toEqual([[{ columnId: 'name', direction: 'asc' }]]);
      // Rows are unchanged — manual mode assumes server-sorted data.
      expect(store.rows()).toEqual(rawRows);
    });
  });

  describe('null ordering', () => {
    interface NullableRow {
      id: string;
      age: number | undefined;
      joined: Date | null;
      note: string | null;
    }

    function makeNullableColumns(): ColumnDef<NullableRow>[] {
      return [
        { id: 'age', accessor: (row) => row.age, visible: true, order: 0, label: 'age' },
        { id: 'joined', accessor: (row) => row.joined, visible: true, order: 1, label: 'joined' },
        { id: 'note', accessor: (row) => row.note, visible: true, order: 2, label: 'note' },
      ];
    }

    it('sorts a nullable Date column without throwing', () => {
      const rows: NullableRow[] = [
        { id: 'r1', age: 1, joined: new Date('2024-01-01'), note: 'a' },
        { id: 'r2', age: 2, joined: null, note: 'b' },
        { id: 'r3', age: 3, joined: new Date('2022-01-01'), note: 'c' },
      ];
      const store = inContext(() =>
        createTable(
          signal<NullableRow[]>(rows),
          { trackBy: 'id', columns: makeNullableColumns() },
          withSorting()
        )
      );

      expect(() => store.toggleSort('joined')).not.toThrow();
      expect(store.rows().map((row) => row.id)).toEqual(['r3', 'r1', 'r2']);
    });

    it('keeps empties on the same end under asc and desc', () => {
      const rows: NullableRow[] = [
        { id: 'r1', age: 1, joined: null, note: 'a' },
        { id: 'r2', age: undefined, joined: null, note: 'b' },
        { id: 'r3', age: 3, joined: null, note: 'c' },
      ];
      const store = inContext(() =>
        createTable(
          signal<NullableRow[]>(rows),
          { trackBy: 'id', columns: makeNullableColumns() },
          withSorting()
        )
      );

      store.toggleSort('age'); // asc
      expect(store.rows().map((row) => row.id)).toEqual(['r1', 'r3', 'r2']);

      store.toggleSort('age'); // desc
      expect(store.rows().map((row) => row.id)).toEqual(['r3', 'r1', 'r2']);
    });

    it('does not let a number column\'s undefined value corrupt the whole ordering', () => {
      const rows: NullableRow[] = [
        { id: 'r1', age: 5, joined: null, note: 'a' },
        { id: 'r2', age: undefined, joined: null, note: 'b' },
        { id: 'r3', age: 1, joined: null, note: 'c' },
      ];
      const store = inContext(() =>
        createTable(
          signal<NullableRow[]>(rows),
          { trackBy: 'id', columns: makeNullableColumns() },
          withSorting()
        )
      );

      store.toggleSort('age');
      expect(store.rows().map((row) => row.id)).toEqual(['r3', 'r1', 'r2']);
    });

    it('does not sort a string column\'s null as the literal "null"', () => {
      const rows: NullableRow[] = [
        { id: 'r1', age: 1, joined: null, note: 'zebra' },
        { id: 'r2', age: 2, joined: null, note: null },
        { id: 'r3', age: 3, joined: null, note: 'apple' },
      ];
      const store = inContext(() =>
        createTable(
          signal<NullableRow[]>(rows),
          { trackBy: 'id', columns: makeNullableColumns() },
          withSorting()
        )
      );

      store.toggleSort('note');
      expect(store.rows().map((row) => row.id)).toEqual(['r3', 'r1', 'r2']);
    });

    it('sorts "" as a normal string by default, and as empty when the column opts in', () => {
      const rows: NullableRow[] = [
        { id: 'r1', age: 1, joined: null, note: 'banana' },
        { id: 'r2', age: 2, joined: null, note: '' },
        { id: 'r3', age: 3, joined: null, note: 'apple' },
      ];

      const defaultStore = inContext(() =>
        createTable(
          signal<NullableRow[]>(rows),
          { trackBy: 'id', columns: makeNullableColumns() },
          withSorting()
        )
      );
      defaultStore.toggleSort('note');
      // '' sorts before 'apple' and 'banana' as a normal string.
      expect(defaultStore.rows().map((row) => row.id)).toEqual(['r2', 'r3', 'r1']);

      const optedInStore = inContext(() =>
        createTable(
          signal<NullableRow[]>(rows),
          {
            trackBy: 'id',
            columns: makeNullableColumns(),
            columnsSchema: (path) => {
              applySortNulls(path.note, { order: 'last', emptyString: 'is-empty' });
            },
          },
          withSorting()
        )
      );
      TestBed.tick();
      optedInStore.toggleSort('note');
      expect(optedInStore.rows().map((row) => row.id)).toEqual(['r3', 'r1', 'r2']);
    });

    it('null-safety applies to a consumer-supplied sortFn too', () => {
      const rows: NullableRow[] = [
        { id: 'r1', age: 5, joined: null, note: 'a' },
        { id: 'r2', age: undefined, joined: null, note: 'b' },
        { id: 'r3', age: 1, joined: null, note: 'c' },
      ];
      const store = inContext(() =>
        createTable(
          signal<NullableRow[]>(rows),
          {
            trackBy: 'id',
            columns: [
              {
                id: 'age',
                accessor: (row) => row.age,
                visible: true,
                order: 0,
                label: 'age',
                sortFn: (a, b) => (a.age as number) - (b.age as number),
              },
              ...makeNullableColumns().slice(1),
            ],
          },
          withSorting()
        )
      );

      expect(() => store.toggleSort('age')).not.toThrow();
      expect(store.rows().map((row) => row.id)).toEqual(['r3', 'r1', 'r2']);
    });

    it('throws at resolve time when applySortNulls is registered twice on one column', () => {
      expect(() =>
        inContext(() =>
          createTable(signal<NullableRow[]>([]), {
            trackBy: 'id',
            columns: makeNullableColumns(),
            columnsSchema: (path) => {
              applySortNulls(path.note, { order: 'first' });
              applySortNulls(path.note, { order: 'last' });
            },
          })
        )
      ).toThrow(/Duplicate metadata\(\) registration/);
    });

    it('a multi-column sort falls through when the higher-priority column is all empty', () => {
      const rows: NullableRow[] = [
        { id: 'r1', age: 3, joined: null, note: null },
        { id: 'r2', age: 1, joined: null, note: null },
        { id: 'r3', age: 2, joined: null, note: null },
      ];
      const store = inContext(() =>
        createTable(
          signal<NullableRow[]>(rows),
          { trackBy: 'id', columns: makeNullableColumns() },
          withSorting({ multi: true })
        )
      );

      store.setSorting([
        { columnId: 'note', direction: 'asc' },
        { columnId: 'age', direction: 'asc' },
      ]);

      expect(store.rows().map((row) => row.id)).toEqual(['r2', 'r3', 'r1']);
    });
  });

  // -------------------------------------------------------------------------------------
  // Type-level assertions. The vitest executor does NOT typecheck `expectTypeOf` — inert at
  // runtime, only enforced by `tsc -p libs/table/tsconfig.spec.json --noEmit`.
  // -------------------------------------------------------------------------------------
  describe('types', () => {
    it('withSorting() alone contributes exactly SortingMembers, never widened to any', () => {
      const store = inContext(() =>
        createTable(signal<Row[]>([]), { trackBy: 'id', columns: makeColumns() }, withSorting())
      );

      expectTypeOf(store.sorting).toEqualTypeOf<Signal<SortRule[]>>();
      expectTypeOf<keyof typeof store>().toEqualTypeOf<
        keyof TableStore<Row> | keyof SortingMembers
      >();
      expectTypeOf(store).not.toBeAny();
    });

    it('withComputed() as a trailing derive block adds a typed member that recomputes off sorting()', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>([]),
          { trackBy: 'id', columns: makeColumns() },
          withSorting(
            { multi: true },
            withComputed((s) => {
              expectTypeOf(s.sorting).toEqualTypeOf<Signal<SortRule[]>>();
              expectTypeOf(s.columns).toEqualTypeOf<Signal<ColumnDef<Row>[]>>();
              return { ruleCount: computed(() => s.sorting().length) };
            })
          )
        )
      );

      expectTypeOf(store.ruleCount).toEqualTypeOf<Signal<number>>();

      expect(store.ruleCount()).toBe(0);

      store.toggleSort('name');
      expect(store.ruleCount()).toBe(1);

      store.clearSorting();
      expect(store.ruleCount()).toBe(0);
    });

    it('the derive-first form compiles: withSorting(withComputed(...))', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>([]),
          { trackBy: 'id', columns: makeColumns() },
          withSorting(withComputed((s) => ({ ruleCount: computed(() => s.sorting().length) })))
        )
      );

      expectTypeOf(store.ruleCount).toEqualTypeOf<Signal<number>>();
      expect(store.ruleCount()).toBe(0);
    });
  });
});
