import { computed, signal, type Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expectTypeOf } from 'vitest';
import { buildValueOfContext } from '../../../engine/resolvers';
import { noData } from '../../../table.mock';
import { createColumns } from '../../create-columns';
import { createTable } from '../../create-table';
import { withComputed } from '../with-computed';
import { sortable, sortFn, sortingSchema, sortNulls } from './schema';
import { withSorting, type SortingMembers } from './feature';
import type { ColumnDecl, ColumnDef, ColumnSet, SortRule, TableStore } from '../../types';

interface Row {
  id: string;
  name: string;
  age: number;
  joined: Date;
  status: string;
}

/** Declares this file's four sortable columns. `overrides` may set `accessor` — the one
 * `ColumnDef` field `col()`'s `opts` doesn't need spelling out per column here — spread onto
 * the declaration afterward. `sortFn`/`enableSorting` no longer exist on `ColumnDef` (Step 3);
 * that behavior is declared through `withSorting({ schema })` instead — see `sortFn`/`sortable`
 * imported from `./schema` below.
 *
 * @remarks
 * Widened `TId` (plain `string`, not a literal union) — nothing in this file reads `path.<id>`
 * off these columns in a way that needs the literal union (the `schema` proxy accepts any
 * string key against a widened id space), so `TableStore<Row>`'s default `ColumnValueMap`
 * costs nothing here.
 */
function makeColumns(
  overrides: Partial<Record<string, Partial<ColumnDef<Row>>>> = {},
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

interface NullableRow {
  id: string;
  age: number | undefined;
  joined: Date | null;
  note: string | null;
}

// `id`s match `NullableRow`'s own field names, so the builder's default
// `(row) => row[id]` accessor already reproduces the old explicit ones — no `accessor`
// opt needed. No `schema` parameter — a nullable column's per-column sort rules (`sortNulls`,
// `sortFn`) are declared through `withSorting({ schema })` now, not through `createColumns()`'s
// own schema argument (Step 4 moved `sortNulls` off `columns-schema/rules.ts`). Hoisted to file
// scope so both `describe('null ordering', ...)` and `describe('schema', ...)` share it.
function makeNullableColumns(data: () => readonly NullableRow[] | undefined) {
  return createColumns(data, (col) => [col('age'), col('joined'), col('note')]);
}

/** Runs `build` inside an Angular injection context — `createTable()` requires one unless
 *  `config.injector` is passed. */
function inContext<T>(build: () => T): T {
  return TestBed.runInInjectionContext(build);
}

describe('withSorting', () => {
  it('exposes an empty sorting array by default', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>([]), { trackBy: 'id', columns: makeColumns() }, withSorting()),
    );

    expect(store.sorting()).toEqual([]);
  });

  it('toggleSort() cycles a column ascending -> descending -> unsorted', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>([]), { trackBy: 'id', columns: makeColumns() }, withSorting()),
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
      createTable(signal<Row[]>([]), { trackBy: 'id', columns: makeColumns() }, withSorting()),
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
        withSorting({ multi: true }),
      ),
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

  it('sortable({ enable: () => false }) makes toggleSort() a no-op for that column', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>([]),
        { trackBy: 'id', columns: makeColumns() },
        withSorting({ schema: (path) => sortable(path['status'], { enable: () => false }) }),
      ),
    );

    store.toggleSort('status');

    expect(store.sorting()).toEqual([]);
  });

  it('sortDirections() derives a columnId -> direction lookup from sorting()', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>([]),
        { trackBy: 'id', columns: makeColumns() },
        withSorting({ multi: true }),
      ),
    );

    expect(store.sortDirections()).toEqual(new Map());

    store.toggleSort('status');
    store.toggleSort('name');

    expect(store.sortDirections()).toEqual(
      new Map([
        ['status', 'asc'],
        ['name', 'asc'],
      ]),
    );

    store.toggleSort('status');
    expect(store.sortDirections().get('status')).toBe('desc');
  });

  it('setSorting() and clearSorting() drive state programmatically', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>([]), { trackBy: 'id', columns: makeColumns() }, withSorting()),
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
        { trackBy: 'id', columns: makeColumns() },
        withSorting({
          schema: (path) => sortFn(path['name'], (a, b) => b.name.localeCompare(a.name)), // reversed
        }),
      ),
    );

    store.toggleSort('name');

    expect(store.rows().map((row) => row.name)).toEqual(['Charlie', 'Bob', 'Ann']);
  });

  it('falls back to numeric comparison for number columns', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withSorting(),
      ),
    );

    store.toggleSort('age');

    expect(store.rows().map((row) => row.age)).toEqual([25, 30, 40]);
  });

  it('falls back to Date comparison for Date columns', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withSorting(),
      ),
    );

    store.toggleSort('joined');

    expect(store.rows().map((row) => row.id)).toEqual(['r2', 'r3', 'r1']);
  });

  it('falls back to locale string comparison for string columns', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withSorting(),
      ),
    );

    store.toggleSort('name');

    expect(store.rows().map((row) => row.name)).toEqual(['Ann', 'Bob', 'Charlie']);
  });

  it('applies multi-column priority order to rendered rows with multi: true', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withSorting({ multi: true }),
      ),
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
        withSorting(),
      ),
    );

    // status asc would be (active, active, inactive), but clicking name
    // afterward replaces the sort entirely rather than adding a tie-break.
    store.toggleSort('status');
    store.toggleSort('name');

    expect(store.rows().map((row) => row.name)).toEqual(['Ann', 'Bob', 'Charlie']);
  });

  describe('manual mode', () => {
    it('updates sorting and fires sortChanged but skips client-side sort processing', () => {
      const rawRows = makeRows();
      const store = inContext(() =>
        createTable(
          signal<Row[]>(rawRows),
          { trackBy: 'id', columns: makeColumns() },
          withSorting({ manual: true }),
        ),
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
    it('sorts a nullable Date column without throwing', () => {
      const rows: NullableRow[] = [
        { id: 'r1', age: 1, joined: new Date('2024-01-01'), note: 'a' },
        { id: 'r2', age: 2, joined: null, note: 'b' },
        { id: 'r3', age: 3, joined: new Date('2022-01-01'), note: 'c' },
      ];
      const data = signal<NullableRow[]>(rows);
      const store = inContext(() =>
        createTable(data, { trackBy: 'id', columns: makeNullableColumns(data) }, withSorting()),
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
        createTable(data, { trackBy: 'id', columns: makeNullableColumns(data) }, withSorting()),
      );

      store.toggleSort('age'); // asc
      expect(store.rows().map((row) => row.id)).toEqual(['r1', 'r3', 'r2']);

      store.toggleSort('age'); // desc
      expect(store.rows().map((row) => row.id)).toEqual(['r3', 'r1', 'r2']);
    });

    it("does not let a number column's undefined value corrupt the whole ordering", () => {
      const rows: NullableRow[] = [
        { id: 'r1', age: 5, joined: null, note: 'a' },
        { id: 'r2', age: undefined, joined: null, note: 'b' },
        { id: 'r3', age: 1, joined: null, note: 'c' },
      ];
      const data = signal<NullableRow[]>(rows);
      const store = inContext(() =>
        createTable(data, { trackBy: 'id', columns: makeNullableColumns(data) }, withSorting()),
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
        createTable(data, { trackBy: 'id', columns: makeNullableColumns(data) }, withSorting()),
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
          withSorting(),
        ),
      );
      defaultStore.toggleSort('note');
      // '' sorts before 'apple' and 'banana' as a normal string.
      expect(defaultStore.rows().map((row) => row.id)).toEqual(['r2', 'r3', 'r1']);

      const optedInData = signal<NullableRow[]>(rows);
      const optedInStore = inContext(() =>
        createTable(
          optedInData,
          { trackBy: 'id', columns: makeNullableColumns(optedInData) },
          withSorting({
            schema: (path) => sortNulls(path['note'], { order: 'last', emptyString: 'is-empty' }),
          }),
        ),
      );
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
          { trackBy: 'id', columns: makeNullableColumns(data) },
          withSorting({
            schema: (path) => sortFn(path['age'], (a, b) => (a.age as number) - (b.age as number)),
          }),
        ),
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
          withSorting({ multi: true }),
        ),
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
            withSorting(),
          ),
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
            withSorting(),
          ),
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
            { trackBy: 'id', columns: makeColumns() },
            withSorting({
              schema: (path) =>
                sortFn(path['name'], () => {
                  throw new Error('boom');
                }),
            }),
          ),
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
            { trackBy: 'id', columns: makeColumns() },
            withSorting({
              schema: (path) =>
                sortFn(path['name'], () => {
                  throw new Error('boom');
                }),
            }),
          ),
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
              }),
            },
            withSorting({
              multi: true,
              schema: (path) =>
                sortFn(path['age'], () => {
                  throw new Error('boom-comparator');
                }),
            }),
          ),
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

  describe('schema', () => {
    it('a sortFn, sortNulls, or sortable naming an undeclared column id throws at construction, naming withSorting — one construction-time check regardless of rule kind', () => {
      expect(() =>
        inContext(() =>
          createTable(
            signal<Row[]>([]),
            { trackBy: 'id', columns: makeColumns() },
            withSorting({ schema: (path) => sortFn(path['nope'], () => 0) }),
          ),
        ),
      ).toThrow(/\[withSorting\].*"nope"/);

      expect(() =>
        inContext(() =>
          createTable(
            signal<Row[]>([]),
            { trackBy: 'id', columns: makeColumns() },
            withSorting({ schema: (path) => sortNulls(path['nope'], { order: 'last' }) }),
          ),
        ),
      ).toThrow(/\[withSorting\].*"nope"/);

      expect(() =>
        inContext(() =>
          createTable(
            signal<Row[]>([]),
            { trackBy: 'id', columns: makeColumns() },
            withSorting({ schema: (path) => sortable(path['nope'], { enable: () => true }) }),
          ),
        ),
      ).toThrow(/\[withSorting\].*"nope"/);
    });

    it('two sortFn declarations on the same column throw', () => {
      expect(() =>
        inContext(() =>
          createTable(
            signal<Row[]>([]),
            { trackBy: 'id', columns: makeColumns() },
            withSorting({
              schema: (path) => {
                sortFn(path['name'], () => 0);
                sortFn(path['name'], () => 0);
              },
            }),
          ),
        ),
      ).toThrow(/\[withSorting\] sort-fn declared twice on column 'name'/);
    });

    it('sortFn and sortNulls on the same column compose without throwing', () => {
      expect(() =>
        inContext(() =>
          createTable(
            signal<Row[]>([]),
            { trackBy: 'id', columns: makeColumns() },
            withSorting({
              schema: (path) => {
                sortFn(path['name'], () => 0);
                sortNulls(path['name'], { order: 'first' });
              },
            }),
          ),
        ),
      ).not.toThrow();
    });

    it('sortable backed by a signal: toggling it off makes toggleSort a no-op, toggling it on restores sorting', () => {
      const enabled = signal(true);
      const store = inContext(() =>
        createTable(
          signal<Row[]>([]),
          { trackBy: 'id', columns: makeColumns() },
          withSorting({ schema: (path) => sortable(path['name'], { enable: () => enabled() }) }),
        ),
      );

      store.toggleSort('name');
      expect(store.sorting()).toEqual([{ columnId: 'name', direction: 'asc' }]);

      enabled.set(false);
      store.toggleSort('name'); // would cycle to 'desc' if it weren't gated
      expect(store.sorting()).toEqual([{ columnId: 'name', direction: 'asc' }]);

      enabled.set(true);
      store.toggleSort('name');
      expect(store.sorting()).toEqual([{ columnId: 'name', direction: 'desc' }]);
    });

    it('a column with no sortable rule is sortable by default', () => {
      const store = inContext(() =>
        createTable(signal<Row[]>([]), { trackBy: 'id', columns: makeColumns() }, withSorting()),
      );

      store.toggleSort('name');
      expect(store.sorting()).toEqual([{ columnId: 'name', direction: 'asc' }]);
    });

    it('a throwing enable degrades to sortable and reports once for that click', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const store = inContext(() =>
          createTable(
            signal<Row[]>([]),
            { trackBy: 'id', columns: makeColumns() },
            withSorting({
              schema: (path) =>
                sortable(path['name'], {
                  enable: () => {
                    throw new Error('boom');
                  },
                }),
            }),
          ),
        );

        store.toggleSort('name');

        expect(store.sorting()).toEqual([{ columnId: 'name', direction: 'asc' }]);
        expect(errorSpy).toHaveBeenCalledTimes(1);
      } finally {
        errorSpy.mockRestore();
      }
    });

    it('sortingSchema declares one rule on two columns; both share its comparator and null placement', () => {
      const rows: NullableRow[] = [
        { id: 'r1', age: 1, joined: new Date('2024-01-01'), note: 'z' },
        { id: 'r2', age: undefined, joined: new Date('2023-01-01'), note: null },
        { id: 'r3', age: 5, joined: new Date('2022-01-01'), note: 'a' },
      ];
      const byAgeNullsFirst = sortingSchema<NullableRow>((column) => {
        sortFn(column, (a, b) => (a.age ?? 0) - (b.age ?? 0));
        sortNulls(column, { order: 'first' });
      });
      const data = signal<NullableRow[]>(rows);
      const store = inContext(() =>
        createTable(
          data,
          { trackBy: 'id', columns: makeNullableColumns(data) },
          withSorting({
            schema: (path) => {
              byAgeNullsFirst(path['age']);
              byAgeNullsFirst(path['note']);
            },
          }),
        ),
      );

      store.toggleSort('age');
      expect(store.rows().map((row) => row.id)).toEqual(['r2', 'r1', 'r3']);

      // Sorting by 'note' produces the SAME order as 'age' — proving the shared rule's
      // age-based comparator (not a note-based, alphabetical one) governs both columns, and
      // 'note's own empty row (r2) still lands first via the shared null-placement opt.
      store.toggleSort('note');
      expect(store.rows().map((row) => row.id)).toEqual(['r2', 'r1', 'r3']);
    });
  });

  // Issue #117: a sortFn comparator now optionally receives a third `ctx: ValueOfContext<TRow>`
  // param, resolving any declared column's accessor value for a given row — its own column or a
  // different one. `ctx.valueOf` naming an undeclared id is covered by a dedicated describe
  // block below instead of through a full store: `guardCompare` (`with-sorting/feature.ts`)
  // wraps every comparator call in a try/catch (ADR-0014 degrade to `0`), so a throw from inside
  // a comparator run through `store.rows()` is never observable as a raw throw — only calling
  // `ctx.valueOf` directly can prove the underlying guard fires.
  describe('ctx.valueOf (Issue #117 Step 7)', () => {
    it('a sortFn comparator reading ctx.valueOf(path.age, a)/(path.age, b) for its own column sorts by the resolved value', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withSorting({
            schema: (path) =>
              sortFn(path['age'], (a, b, ctx) => {
                const aAge = ctx.valueOf(path['age'], a) as number;
                const bAge = ctx.valueOf(path['age'], b) as number;
                return aAge - bAge;
              }),
          }),
        ),
      );

      store.toggleSort('age');

      expect(store.rows().map((row) => row.age)).toEqual([25, 30, 40]);
    });

    it("a sortFn declared on one column but reading ctx.valueOf for a different column sorts by that other column's resolved value", () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withSorting({
            schema: (path) =>
              sortFn(path['name'], (a, b, ctx) => {
                const aAge = ctx.valueOf(path['age'], a) as number;
                const bAge = ctx.valueOf(path['age'], b) as number;
                return aAge - bAge;
              }),
          }),
        ),
      );

      store.toggleSort('name');

      // makeRows(): Charlie/40, Ann/25, Bob/30 — ordered here by age asc via ctx.valueOf(path.age,
      // ...), not by name, proving the comparator resolved a different column than the one it
      // was declared on.
      expect(store.rows().map((row) => row.name)).toEqual(['Ann', 'Bob', 'Charlie']);
    });

    it('a 2-argument sortFn comparator (no ctx param) on a numeric column still sorts correctly — existing-shape regression', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withSorting({
            schema: (path) => sortFn(path['age'], (a, b) => b.age - a.age), // reversed
          }),
        ),
      );

      store.toggleSort('age');

      expect(store.rows().map((row) => row.age)).toEqual([40, 30, 25]);
    });
  });

  describe('ctx.valueOf resolver guard (Issue #117 Step 7, via engine/resolvers.ts)', () => {
    it('an unknown column id thrown from ctx.valueOf names both withSorting and the id', () => {
      const columns: ColumnDef<Row>[] = [
        { id: 'name', accessor: (row) => row.name, visible: true, order: 0, label: 'Name' },
      ];
      const ctx = buildValueOfContext<Row>(() => columns, new Set(['name']), 'withSorting');

      expect(() => ctx.valueOf({ id: 'nope' }, makeRows()[0])).toThrow(/\[withSorting\].*"nope"/);
    });

    it('a declared column id resolves the accessor value, not a throw', () => {
      const columns: ColumnDef<Row>[] = [
        { id: 'name', accessor: (row) => row.name, visible: true, order: 0, label: 'Name' },
      ];
      const ctx = buildValueOfContext<Row>(() => columns, new Set(['name']), 'withSorting');

      expect(ctx.valueOf({ id: 'name' }, makeRows()[0])).toBe('Charlie');
    });
  });

  // -------------------------------------------------------------------------------------
  // Type-level assertions. The vitest executor does NOT typecheck `expectTypeOf` — inert at
  // runtime, only enforced by `tsc -p libs/table/tsconfig.spec.json --noEmit`.
  // -------------------------------------------------------------------------------------
  describe('types', () => {
    it('withSorting() alone contributes exactly SortingMembers, never widened to any', () => {
      const store = inContext(() =>
        createTable(signal<Row[]>([]), { trackBy: 'id', columns: makeColumns() }, withSorting()),
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
            }),
          ),
        ),
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
          withSorting(withComputed((s) => ({ ruleCount: computed(() => s.sorting().length) }))),
        ),
      );

      expectTypeOf(store.ruleCount).toEqualTypeOf<Signal<number>>();
      expect(store.ruleCount()).toBe(0);
    });
  });
});
