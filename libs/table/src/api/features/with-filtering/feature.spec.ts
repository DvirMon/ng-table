import { computed, signal, type Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expectTypeOf } from 'vitest';
import { createTable } from '../../create-table';
import { contains, equals, filter } from './rules';
import { withComputed } from '../with-computed';
import { withFiltering } from './feature';
import type { ColumnDef, TableStore } from '../../types';

interface Row {
  id: string;
  name: string;
  status: string;
  category: string;
}

function makeColumns(): ColumnDef<Row>[] {
  return [
    { id: 'name', accessor: (row) => row.name, visible: true, order: 0, label: 'name' },
    { id: 'status', accessor: (row) => row.status, visible: true, order: 1, label: 'status' },
    { id: 'category', accessor: (row) => row.category, visible: true, order: 2, label: 'category' },
  ];
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

      expectTypeOf(store).toEqualTypeOf<TableStore<Row>>();
      expectTypeOf(store).not.toBeAny();

      const manualStore = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withFiltering({ manual: true })
        )
      );

      expectTypeOf(manualStore).toEqualTypeOf<TableStore<Row>>();
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
});
