import { computed, signal, type Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expectTypeOf } from 'vitest';
import { sortNulls } from '../../columns-schema/rules';
import type { ColumnSchema, ColumnsSchemaFn } from '../../columns-schema/types';
import { noData } from '../../table.mock';
import { createColumns } from '../create-columns';
import { createTable } from '../create-table';
import { withComputed } from './with-computed';
import { withSorting, type SortingMembers } from './with-sorting';
import type { ColumnDecl, ColumnDef, ColumnSet, SortRule, TableStore } from '../types';

interface Row {
  id: string;
  name: string;
  age: number;
  joined: Date;
  status: string;
}

/** Declares this file's four sortable columns. `overrides` may set `sortFn`/`enableSorting` —
 * fields `col()`'s `opts` doesn't type — spread onto the declaration afterward; the engine
 * resolves them from the plain object regardless of what `col()` itself typed.
 *
 * @remarks
 * Widened `TId` (plain `string`, not a literal union) — nothing in this file reads `path.<id>`
 * off these columns (unlike `makeNullableColumns()` below, which stays unannotated for exactly
 * that reason), so `TableStore<Row>`'s default `ColumnValueMap` costs nothing here.
 */
function makeColumns(
  overrides: Partial<Record<string, Partial<ColumnDef<Row>>>> = {}
): ColumnSet<Row, readonly ColumnDecl<Row, string, unknown>[]> {
  return createColumns(noData<Row>(), (col) => [
    { ...col('name'), ...overrides['name'] },
    { ...col('age'), ...overrides['age'] },
    { ...col('joined'), ...overrides['joined'] },
    { ...col('status'), ...overrides['status'] },
  ]);
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

    // `id`s match `NullableRow`'s own field names, so the builder's default
    // `(row) => row[id]` accessor already reproduces the old explicit ones — no `accessor`
    // opt needed.
    function makeNullableColumns(
      data: () => readonly NullableRow[] | undefined,
      schema?: ColumnsSchemaFn<NullableRow, 'age' | 'joined' | 'note'> | ColumnSchema<NullableRow>
    ) {
      return createColumns(data, (col) => [col('age'), col('joined'), col('note')], schema);
    }

    it('sorts a nullable Date column without throwing', () => {
      const rows: NullableRow[] = [
        { id: 'r1', age: 1, joined: new Date('2024-01-01'), note: 'a' },
        { id: 'r2', age: 2, joined: null, note: 'b' },
        { id: 'r3', age: 3, joined: new Date('2022-01-01'), note: 'c' },
      ];
      const data = signal<NullableRow[]>(rows);
      const store = inContext(() =>
        createTable(data, { trackBy: 'id', columns: makeNullableColumns(data) }, withSorting())
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
      const data = signal<NullableRow[]>(rows);
      const store = inContext(() =>
        createTable(data, { trackBy: 'id', columns: makeNullableColumns(data) }, withSorting())
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
      const data = signal<NullableRow[]>(rows);
      const store = inContext(() =>
        createTable(data, { trackBy: 'id', columns: makeNullableColumns(data) }, withSorting())
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
      const data = signal<NullableRow[]>(rows);
      const store = inContext(() =>
        createTable(data, { trackBy: 'id', columns: makeNullableColumns(data) }, withSorting())
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

      const defaultData = signal<NullableRow[]>(rows);
      const defaultStore = inContext(() =>
        createTable(
          defaultData,
          { trackBy: 'id', columns: makeNullableColumns(defaultData) },
          withSorting()
        )
      );
      defaultStore.toggleSort('note');
      // '' sorts before 'apple' and 'banana' as a normal string.
      expect(defaultStore.rows().map((row) => row.id)).toEqual(['r2', 'r3', 'r1']);

      const optedInData = signal<NullableRow[]>(rows);
      const optedInStore = inContext(() =>
        createTable(
          optedInData,
          {
            trackBy: 'id',
            columns: makeNullableColumns(optedInData, (path) => {
              sortNulls(path.note, { order: 'last', emptyString: 'is-empty' });
            }),
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
      const data = signal<NullableRow[]>(rows);
      const store = inContext(() =>
        createTable(
          data,
          {
            trackBy: 'id',
            columns: createColumns(data, (col) => [
              {
                ...col('age'),
                sortFn: (a: NullableRow, b: NullableRow) =>
                  (a.age as number) - (b.age as number),
              },
              col('joined'),
              col('note'),
            ]),
          },
          withSorting()
        )
      );

      expect(() => store.toggleSort('age')).not.toThrow();
      expect(store.rows().map((row) => row.id)).toEqual(['r3', 'r1', 'r2']);
    });

    it('a multi-column sort falls through when the higher-priority column is all empty', () => {
      const rows: NullableRow[] = [
        { id: 'r1', age: 3, joined: null, note: null },
        { id: 'r2', age: 1, joined: null, note: null },
        { id: 'r3', age: 2, joined: null, note: null },
      ];
      const data = signal<NullableRow[]>(rows);
      const store = inContext(() =>
        createTable(
          data,
          { trackBy: 'id', columns: makeNullableColumns(data) },
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

  describe('runtime error handling (ADR-0014)', () => {
    it('a throwing accessor sorts that row as empty, without throwing', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const rows = makeRows();
        const store = inContext(() =>
          createTable(
            signal<Row[]>(rows),
            {
              trackBy: 'id',
              columns: makeColumns({
                name: {
                  accessor: (row) => {
                    if (row.id === 'r2') {
                      throw new Error('boom');
                    }
                    return row.name;
                  },
                },
              }),
            },
            withSorting()
          )
        );

        expect(() => store.toggleSort('name')).not.toThrow();
        // r2 (Ann) throws -> treated as empty -> placed last under the default
        // nulls: 'last'. The remaining rows sort ascending by name: Bob, Charlie.
        expect(store.rows().map((row) => row.id)).toEqual(['r3', 'r1', 'r2']);
      } finally {
        errorSpy.mockRestore();
      }
    });

    it('the accessor error reports once per column across many rows', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const store = inContext(() =>
          createTable(
            signal<Row[]>(makeRows()),
            {
              trackBy: 'id',
              columns: makeColumns({
                name: {
                  accessor: () => {
                    throw new Error('boom');
                  },
                },
              }),
            },
            withSorting()
          )
        );

        store.toggleSort('name');
        store.rows();

        expect(errorSpy).toHaveBeenCalledTimes(1);
      } finally {
        errorSpy.mockRestore();
      }
    });

    it('a throwing sortFn does not propagate; the affected pair falls back to input order', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const rows = makeRows();
        const store = inContext(() =>
          createTable(
            signal<Row[]>(rows),
            {
              trackBy: 'id',
              columns: makeColumns({
                name: {
                  sortFn: () => {
                    throw new Error('boom');
                  },
                },
              }),
            },
            withSorting()
          )
        );

        expect(() => store.toggleSort('name')).not.toThrow();
        expect(store.rows().map((row) => row.id)).toEqual(rows.map((row) => row.id));
      } finally {
        errorSpy.mockRestore();
      }
    });

    it('the sortFn error reports once per column even across many comparisons', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const store = inContext(() =>
          createTable(
            signal<Row[]>(makeRows()),
            {
              trackBy: 'id',
              columns: makeColumns({
                name: {
                  sortFn: () => {
                    throw new Error('boom');
                  },
                },
              }),
            },
            withSorting()
          )
        );

        store.toggleSort('name');
        store.rows();

        expect(errorSpy).toHaveBeenCalledTimes(1);
      } finally {
        errorSpy.mockRestore();
      }
    });

    it('accessor and comparator errors report independently across two columns in one multi-sort', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const store = inContext(() =>
          createTable(
            signal<Row[]>(makeRows()),
            {
              trackBy: 'id',
              columns: makeColumns({
                name: {
                  accessor: () => {
                    throw new Error('boom-accessor');
                  },
                },
                age: {
                  sortFn: () => {
                    throw new Error('boom-comparator');
                  },
                },
              }),
            },
            withSorting({ multi: true })
          )
        );

        store.toggleSort('name');
        store.toggleSort('age');
        store.rows();

        expect(errorSpy).toHaveBeenCalledTimes(2);
        const messages = errorSpy.mock.calls.map((call) => String(call[0]));
        expect(messages.some((message) => message.includes('"name"'))).toBe(true);
        expect(messages.some((message) => message.includes('"age"'))).toBe(true);
      } finally {
        errorSpy.mockRestore();
      }
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
