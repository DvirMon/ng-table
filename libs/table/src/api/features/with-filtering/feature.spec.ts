import { computed, signal, type Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expectTypeOf } from 'vitest';
import { makeFlatRows, noData, type FlatRow } from '../../../table.mock';
import { createColumns } from '../../create-columns';
import { createTable } from '../../create-table';
import { anyOf, contains, equals, filter } from './rules';
import { withComputed } from '../with-computed';
import { withTree } from '../with-tree';
import { withFiltering } from './feature';
import type { ColumnDecl, ColumnSet, ColumnValues, TableStore } from '../../types';

interface Row {
  id: string;
  name: string;
  status: string;
  category: string;
}

// No return-type annotation — `path.<id>` is read throughout this file via `withFiltering()`'s
// `schema`, and an explicit `ColumnSet<Row, readonly ColumnDecl<Row, string, unknown>[]>` would
// widen `id` to `string`, breaking that literal `ColumnsPath` access (ADR-0019).
function makeColumns() {
  return createColumns(noData<Row>(), (col) => [
    col('name'),
    col('status'),
    col('category'),
  ]);
}

function makeRows(): Row[] {
  return [
    { id: 'r1', name: 'Ann', status: 'open', category: 'a' },
    { id: 'r2', name: 'Bob', status: 'closed', category: 'b' },
    { id: 'r3', name: 'Cid', status: 'open', category: 'b' },
  ];
}

/** Runs a `createTable()` build inside an Angular injection context. */
function inContext<T>(build: () => T): T {
  return TestBed.runInInjectionContext(build);
}

/** The exact store `createTable(data, { columns: makeColumns() })` composes, before any
 * feature — `makeColumns()`'s declared columns carry literal ids, so this is stronger than the
 * default `TableStore<Row>` the "recovered exactly" type assertions below compare against. */
type RowStore = TableStore<Row, ColumnValues<Row, ReturnType<typeof makeColumns>['columns']>>;

/** Widened on purpose (explicit `TId` of plain `string`, no literal union) — the "unknown
 * column id" cases below need an out-of-union id to compile at all, to prove the *runtime*
 * check rather than relying on the compile-time rejection `makeColumns()`'s literal ids already
 * give a real caller for free. Mirrors `with-grouping/feature.spec.ts`'s
 * `makeWidenedColumns()`. */
function makeWidenedColumns(): ColumnSet<Row, readonly ColumnDecl<Row, string, unknown>[]> {
  return makeColumns();
}

/** A row shape with no `doubled`/`total` field of its own — the derived-accessor and
 * carrier-column cases below can only narrow by reading the column's resolved cell through the
 * pipeline, never by accident against a same-named raw field. */
interface AccessorRow {
  id: string;
  amount: number;
}

function makeAccessorRows(): AccessorRow[] {
  return [
    { id: 'a1', amount: 50 },
    { id: 'a2', amount: 100 },
    { id: 'a3', amount: 150 },
  ];
}

describe('withFiltering', () => {
  it('composes into createTable() with Row inferred from the data slot', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withFiltering({ schema: (path) => ({ name: contains(path.name) }) })
      )
    );

    store.filters.name().value.set('A');

    expect(store.rows().map((row) => row.id)).toEqual(['r1']);
  });

  it('narrows rows() from a schema criterion', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withFiltering({ schema: (path) => ({ status: equals(path.status) }) })
      )
    );

    store.filters.status().value.set('open');

    expect(store.rows().map((row) => row.id)).toEqual(['r1', 'r3']);
  });

  it('narrows conjunctively across two criteria (AND)', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withFiltering({
          schema: (path) => ({ status: equals(path.status), category: equals(path.category) }),
        })
      )
    );

    store.filters.status().value.set('open');
    store.filters.category().value.set('b');

    expect(store.rows().map((row) => row.id)).toEqual(['r3']);
  });

  it('never narrows while every criterion is empty', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withFiltering({
          schema: (path) => ({ status: equals(path.status), category: equals(path.category) }),
        })
      )
    );

    expect(store.rows()).toHaveLength(3);
  });

  it('contributes no members beyond the core store surface when no schema is given', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>([]), { trackBy: 'id', columns: makeColumns() }, withFiltering())
    );

    expect('filters' in store).toBe(false);
  });

  it('re-narrows automatically when a criterion changes', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withFiltering({ schema: (path) => ({ status: equals(path.status) }) })
      )
    );

    expect(store.rows()).toHaveLength(3);

    store.filters.status().value.set('open');
    expect(store.rows().map((row) => row.id)).toEqual(['r1', 'r3']);

    store.filters.status().value.set('closed');
    expect(store.rows().map((row) => row.id)).toEqual(['r2']);
  });

  it('re-narrows when a rule source changes and the user has not overridden it', () => {
    const wantedStatus = signal<string | null>('open');
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withFiltering({
          schema: (path) => ({ status: equals(path.status, { source: () => wantedStatus() }) }),
        })
      )
    );

    expect(store.rows().map((row) => row.id)).toEqual(['r1', 'r3']);

    wantedStatus.set('closed');
    expect(store.rows().map((row) => row.id)).toEqual(['r2']);
  });

  it('calls matcher() once per stage evaluation, not once per row', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()), // 3 rows: a per-row call would be 3
        { trackBy: 'id', columns: makeColumns() },
        withFiltering({ schema: (path) => ({ status: equals(path.status) }) })
      )
    );

    store.filters.status().value.set('open');
    const matcherSpy = vi.spyOn(store.filters(), 'matcher');

    expect(store.rows().map((row) => row.id)).toEqual(['r1', 'r3']);
    expect(matcherSpy).toHaveBeenCalledTimes(1);
  });

  it('the trailing block sees post-filter rows: visibleCount reflects the narrowed set', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withFiltering(
          { schema: (path) => ({ status: equals(path.status) }) },
          withComputed((s) => ({ visibleCount: computed(() => s.rows().length) }))
        )
      )
    );

    store.filters.status().value.set('open');
    expect(store.visibleCount()).toBe(2);

    store.filters.status().value.set('closed');
    expect(store.visibleCount()).toBe(1);
  });

  describe('manual mode', () => {
    it('skips the stage although the model still builds and filters is still exposed', () => {
      const rawRows = makeRows();
      const store = inContext(() =>
        createTable(
          signal<Row[]>(rawRows),
          { trackBy: 'id', columns: makeColumns() },
          withFiltering({ schema: (path) => ({ status: equals(path.status) }), manual: true })
        )
      );

      store.filters.status().value.set('open');

      expect(store.rows()).toEqual(rawRows);
      expect(store.filters().criteria()).toEqual({ status: 'open' });
    });
  });

  describe('errors — ADR-0014', () => {
    it('drops a throwing rule for the pass while its sibling keeps narrowing', () => {
      const reportSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const store = inContext(() =>
          createTable(
            signal<Row[]>(makeRows()),
            { trackBy: 'id', columns: makeColumns() },
            withFiltering({
              schema: (path) => ({
                broken: filter(
                  path.name,
                  () => {
                    throw new Error('boom');
                  },
                  { emptyValue: false, isEmpty: () => false }
                ),
                category: equals(path.category),
              }),
            })
          )
        );

        store.filters.category().value.set('b');

        // Not widened to all 3 rows — the surviving rule still narrows.
        expect(store.rows().map((row) => row.id)).toEqual(['r2', 'r3']);
        expect(reportSpy).toHaveBeenCalledTimes(1);
      } finally {
        reportSpy.mockRestore();
      }
    });

    // The boundary is the evaluation, not the row: a row past the first throw is also
    // unaffected by the dropped rule, not just the row where it happened.
    it('drops a term throwing on a row from the rest of the pass, not just that row', () => {
      const reportSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const rows: Row[] = [
          ...makeRows(),
          { id: 'r4', name: 'Dee', status: 'open', category: 'a' },
        ];
        const store = inContext(() =>
          createTable(
            signal<Row[]>(rows),
            { trackBy: 'id', columns: makeColumns() },
            withFiltering({
              schema: (path) => ({
                name: filter(
                  path.name,
                  (name: string) => {
                    if (name === 'Cid') {
                      throw new Error('boom');
                    }
                    return name === 'Ann';
                  },
                  { emptyValue: false, isEmpty: () => false }
                ),
              }),
            })
          )
        );

        // r2 (Bob) is decided false before the throw and stays excluded. r3 (Cid) throws and
        // drops the rule. r4 (Dee), evaluated after the drop, is untouched by the now-dropped
        // rule and is kept too — not just r3, the row that threw.
        expect(store.rows().map((row) => row.id)).toEqual(['r1', 'r3', 'r4']);
        expect(reportSpy).toHaveBeenCalledTimes(1);
      } finally {
        reportSpy.mockRestore();
      }
    });
  });

  describe('members — reached through a composed store', () => {
    it('root filters().value is writable and fans out to per-key members', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withFiltering({
            schema: (path) => ({ status: equals(path.status), category: equals(path.category) }),
          })
        )
      );

      store.filters().value.set({ status: 'open', category: 'b' });

      expect(store.filters.status().value()).toBe('open');
      expect(store.filters.category().value()).toBe('b');
      expect(store.rows().map((row) => row.id)).toEqual(['r3']);
    });

    it('root filters().criteria() omits filters that are empty', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withFiltering({
            schema: (path) => ({ status: equals(path.status), category: equals(path.category) }),
          })
        )
      );

      store.filters.status().value.set('open');

      expect(store.filters().criteria()).toEqual({ status: 'open' });
    });

    it('root filters().isActive() reflects whether any filter narrows', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withFiltering({ schema: (path) => ({ status: equals(path.status) }) })
        )
      );

      expect(store.filters().isActive()).toBe(false);

      store.filters.status().value.set('open');

      expect(store.filters().isActive()).toBe(true);
    });

    it('root filters().reset() reverts to source, reset(null) reverts to empty', () => {
      const sourceStatus = signal('closed');
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withFiltering({
            schema: (path) => ({ status: equals(path.status, { source: () => sourceStatus() }) }),
          })
        )
      );

      store.filters.status().value.set('open');
      store.filters().reset();
      expect(store.filters.status().value()).toBe('closed');

      store.filters.status().value.set('open');
      store.filters().reset(null);
      expect(store.filters.status().value()).toBe(null);
    });

    it('per-key filters.status().value reads and writes that filter, narrowing the pipeline', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withFiltering({ schema: (path) => ({ status: equals(path.status) }) })
        )
      );

      store.filters.status().value.set('closed');

      expect(store.filters.status().value()).toBe('closed');
      expect(store.rows().map((row) => row.id)).toEqual(['r2']);
    });

    it('per-key filters.status().criterion() is undefined while the filter is empty', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withFiltering({ schema: (path) => ({ status: equals(path.status) }) })
        )
      );

      expect(store.filters.status().criterion()).toBeUndefined();

      store.filters.status().value.set('open');

      expect(store.filters.status().criterion()).toBe('open');
    });

    it('per-key filters.status().isActive() reflects that filter alone', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withFiltering({
            schema: (path) => ({ status: equals(path.status), category: equals(path.category) }),
          })
        )
      );

      store.filters.category().value.set('b');

      expect(store.filters.status().isActive()).toBe(false);
      expect(store.filters.category().isActive()).toBe(true);
    });

    it('per-key filters.status().reset() reverts only that filter', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withFiltering({
            schema: (path) => ({ status: equals(path.status), category: equals(path.category) }),
          })
        )
      );

      store.filters.status().value.set('open');
      store.filters.category().value.set('b');

      store.filters.status().reset();

      expect(store.filters.status().value()).toBe(null);
      expect(store.filters.category().value()).toBe('b');
    });
  });

  describe('construction — unknown column ids (#115)', () => {
    it('a single rule naming an undeclared column id throws, naming withFiltering and the id', () => {
      expect(() =>
        inContext(() =>
          createTable(
            signal<Row[]>(makeRows()),
            { trackBy: 'id', columns: makeWidenedColumns() },
            withFiltering({ schema: (path) => ({ territory: equals(path['territory']) }) })
          )
        )
      ).toThrow(/\[withFiltering\].*"territory"/);
    });

    it('an anyOf child naming an undeclared column id throws the same way', () => {
      expect(() =>
        inContext(() =>
          createTable(
            signal<Row[]>(makeRows()),
            { trackBy: 'id', columns: makeWidenedColumns() },
            withFiltering({
              schema: (path) => ({
                search: anyOf([contains(path['name']), contains(path['territory'])]),
              }),
            })
          )
        )
      ).toThrow(/\[withFiltering\].*"territory"/);
    });
  });

  describe('derived accessors & carrier columns (#115)', () => {
    it("rows() narrows by a derived accessor's resolved output, not a same-named raw field", () => {
      const columns = createColumns(noData<AccessorRow>(), (col) => [
        col('doubled', { accessor: (row) => row.amount * 2 }),
      ]);
      const store = inContext(() =>
        createTable(
          signal<AccessorRow[]>(makeAccessorRows()),
          { trackBy: 'id', columns },
          withFiltering({ schema: (path) => ({ doubled: equals(path.doubled) }) })
        )
      );

      store.filters.doubled().value.set(200);

      expect(store.rows().map((row) => row.id)).toEqual(['a2']);
    });

    it('a carrier column (visible: false) still narrows rows()', () => {
      const columns = createColumns(noData<AccessorRow>(), (col) => [
        col('total', { visible: false, accessor: (row) => row.amount * 2 }),
      ]);
      const store = inContext(() =>
        createTable(
          signal<AccessorRow[]>(makeAccessorRows()),
          { trackBy: 'id', columns },
          withFiltering({ schema: (path) => ({ total: equals(path.total) }) })
        )
      );

      store.filters.total().value.set(300);

      expect(store.rows().map((row) => row.id)).toEqual(['a3']);
    });
  });

  describe('anyOf across multiple columns (#115)', () => {
    it('folds two columns into one declaration, matching on either', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withFiltering({
            schema: (path) => ({ search: anyOf([contains(path.name), contains(path.status)]) }),
          })
        )
      );

      store.filters.search().value.set('Ann');
      expect(store.rows().map((row) => row.id)).toEqual(['r1']);

      store.filters.search().value.set('closed');
      expect(store.rows().map((row) => row.id)).toEqual(['r2']);
    });
  });

  // -------------------------------------------------------------------------------------
  // Type-level assertions. The vitest executor does NOT typecheck `expectTypeOf`/
  // `@ts-expect-error` — they are inert at runtime. These are only enforced by
  // `tsc -p libs/table/tsconfig.spec.json --noEmit`, which is the verification step
  // for this describe block.
  // -------------------------------------------------------------------------------------
  describe('types', () => {
    it('withFiltering() and withFiltering({ manual: true }) with no schema contribute {} — recovered exactly as TableStore<Row>, never widened to any', () => {
      const store = inContext(() =>
        createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withFiltering())
      );

      expectTypeOf(store).toEqualTypeOf<RowStore>();
      expectTypeOf(store).not.toBeAny();

      const manualStore = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withFiltering({ manual: true })
        )
      );

      expectTypeOf(manualStore).toEqualTypeOf<RowStore>();
      expectTypeOf(manualStore).not.toBeAny();
    });

    it('trailing block: withComputed adds visibleCount, keyof store is TableStore<Row> | "visibleCount"', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withFiltering(
            undefined,
            withComputed((s) => ({ visibleCount: computed(() => s.rows().length) }))
          )
        )
      );

      expectTypeOf(store.visibleCount).toEqualTypeOf<Signal<number>>();
      expectTypeOf<keyof typeof store>().toEqualTypeOf<keyof TableStore<Row> | 'visibleCount'>();
    });
  });

  describe('tree retention (#168)', () => {
    function makeFlatColumns() {
      return createColumns(noData<FlatRow>(), (col) => [col('name')]);
    }

    function setup(options: { includeDescendants?: boolean; manual?: boolean } = {}) {
      return inContext(() =>
        createTable(
          signal(makeFlatRows()),
          { trackBy: 'id', columns: makeFlatColumns() },
          withTree({ parentId: (row) => row.parentId }),
          withFiltering({
            schema: (path) => ({ name: contains(path.name) }),
            includeDescendants: options.includeDescendants,
            manual: options.manual,
          })
        )
      );
    }

    it("keeps a matched row's ancestors, in input order", () => {
      const store = setup();

      store.filters.name().value.set('Grand');

      expect(store.rows().map((row) => row.id)).toEqual(['g1', 'r1', 'c1']);
    });

    it('flags retained ancestors as context rows and leaves the match unflagged', () => {
      const store = setup();

      store.tree.expand(['r1', 'c1']);
      store.filters.name().value.set('Grand');

      const flagged = store
        .renderRows()
        .filter((row) => row.isContextRow)
        .map((row) => row.id);
      expect(flagged).toEqual(['r1', 'c1']);
    });

    it("includeDescendants keeps a matched parent's whole branch", () => {
      const store = setup({ includeDescendants: true });

      store.filters.name().value.set('Parent');

      expect(store.rows().map((row) => row.id)).toEqual(['g1', 'r1', 'c1', 'c2']);
    });

    it('drops every context flag once the filter is cleared', () => {
      const store = setup();
      const flaggedIds = () =>
        store
          .renderRows()
          .filter((row) => row.isContextRow)
          .map((row) => row.id);

      store.tree.expand(['r1', 'c1']);
      store.filters.name().value.set('Grand');
      expect(flaggedIds()).toEqual(['r1', 'c1']);

      store.filters().reset(null);

      expect(flaggedIds()).toEqual([]);
      expect(store.rows()).toHaveLength(5);
    });

    it('runs no tree retention and flags nothing under manual filtering', () => {
      const store = setup({ manual: true });

      store.tree.expand(['r1', 'c1']);
      store.filters.name().value.set('Grand');

      expect(store.rows()).toHaveLength(5);
      expect(store.renderRows().some((row) => row.isContextRow)).toBe(false);
    });
  });
});
