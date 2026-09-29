import { computed, signal, type Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expectTypeOf } from 'vitest';
import { removeRow } from '../../mutations/row-mutations';
import { noData } from '../../table.mock';
import { createColumns } from '../create-columns';
import { createTable } from '../create-table';
import type { ColumnDecl, ColumnSet, RowId, TableStore } from '../types';
import { withComputed } from './with-computed';
import {
  withExpansion,
  type ExpansionChange,
  type ExpansionMembers,
  type ExpansionSlice,
} from './with-expansion';
import { withGrouping } from './with-grouping';
import { withTree } from './with-tree';

// The panel doesn't read row shape at all — a flat fixture, no `children` field.
interface Row {
  id: string;
  name: string;
}

// Widened `TId` (plain `string`) — no `path.<id>` usage in this file.
function makeColumns(): ColumnSet<Row, readonly ColumnDecl<Row, string, unknown>[]> {
  return createColumns(noData<Row>(), (col) => [col('name')]);
}

function makeRows(): Row[] {
  return [
    { id: 'r1', name: 'Row 1' },
    { id: 'r2', name: 'Row 2' },
    { id: 'r3', name: 'Row 3' },
  ];
}

/** Runs `build` inside an Angular injection context — `createTable()` requires one unless
 *  `config.injector` is passed. */
function inContext<T>(build: () => T): T {
  return TestBed.runInInjectionContext(build);
}

describe('withExpansion', () => {
  it('toggle(id) flips a row from collapsed to expanded and back', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    expect(store.expansion().has('r1')).toBe(false);

    store.expansion.toggle('r1');
    expect(store.expansion().has('r1')).toBe(true);

    store.expansion.toggle('r1');
    expect(store.expansion().has('r1')).toBe(false);
  });

  it('expanding row A does not collapse row B (multi-expand)', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    store.expansion.toggle('r1');
    store.expansion.toggle('r2');

    expect(store.expansion().has('r1')).toBe(true);
    expect(store.expansion().has('r2')).toBe(true);
  });

  it('expand() with no ids expands every row in rows() — the panel has no discovery walk', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    store.expansion.expand();

    const expanded = store.expansion();
    expect(expanded.has('r1')).toBe(true);
    expect(expanded.has('r2')).toBe(true);
    expect(expanded.has('r3')).toBe(true);
  });

  it('expand(explicitIds) unions the explicit ids with what is already open', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    store.expansion.toggle('r1');
    store.expansion.expand(['r2']);

    const expanded = store.expansion();
    expect(expanded.has('r1')).toBe(true);
    expect(expanded.has('r2')).toBe(true);
    expect(expanded.has('r3')).toBe(false);
  });

  it('collapse() with no ids clears everything', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    store.expansion.expand();
    expect(store.expansion().size).toBeGreaterThan(0);

    store.expansion.collapse();
    expect(store.expansion().size).toBe(0);
  });

  it('collapse(ids) removes exactly those ids and leaves the rest open', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    store.expansion.expand();
    store.expansion.collapse(['r1']);

    const expanded = store.expansion();
    expect(expanded.has('r1')).toBe(false);
    expect(expanded.has('r2')).toBe(true);
    expect(expanded.has('r3')).toBe(true);
  });

  it('set(ids) replaces atomically — an open id absent from ids closes in the same write', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    store.expansion.expand(['r1', 'r2']);
    store.expansion.set(['r2']);

    const expanded = store.expansion();
    expect(expanded.has('r1')).toBe(false);
    expect(expanded.has('r2')).toBe(true);
  });

  it('changed emits once per write — toggle expanding emits { added: [id], removed: [] }', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    const emitted: ExpansionChange[] = [];
    store.expansion.changed.subscribe((change) => emitted.push(change));

    store.expansion.toggle('r1');

    expect(emitted).toEqual([{ added: ['r1'], removed: [] }]);
  });

  it('changed emits once for expand() over a fresh table, added holding every row id (no discovery walk — every row in rows())', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    const emitted: ExpansionChange[] = [];
    store.expansion.changed.subscribe((change) => emitted.push(change));

    store.expansion.expand();

    expect(emitted).toHaveLength(1);
    expect([...emitted[0].added].sort()).toEqual(['r1', 'r2', 'r3']);
    expect(emitted[0].removed).toEqual([]);
  });

  it("changed carries the full symmetric diff in one emission — expand(['r1','r2']) on an empty set emits exactly one { added: ['r1','r2'], removed: [] }, not two single-id emissions", () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    const emitted: ExpansionChange[] = [];
    store.expansion.changed.subscribe((change) => emitted.push(change));

    store.expansion.expand(['r1', 'r2']);

    expect(emitted).toHaveLength(1);
    expect([...emitted[0].added].sort()).toEqual(['r1', 'r2']);
    expect(emitted[0].removed).toEqual([]);
  });

  it('changed emits once for collapse(), removed holding every previously open id', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    store.expansion.expand();
    const emitted: ExpansionChange[] = [];
    store.expansion.changed.subscribe((change) => emitted.push(change));

    store.expansion.collapse();

    expect(emitted).toHaveLength(1);
    expect([...emitted[0].removed].sort()).toEqual(['r1', 'r2', 'r3']);
    expect(emitted[0].added).toEqual([]);
  });

  it('a repeat write that changes nothing emits nothing on changed', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    store.expansion.expand();
    const emitted: ExpansionChange[] = [];
    store.expansion.changed.subscribe((change) => emitted.push(change));

    store.expansion.expand(); // same set again — no-op

    expect(emitted).toEqual([]);
  });

  it('emitEvent: false suppresses changed on every write verb, expansion() still changes', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    const emitted: ExpansionChange[] = [];
    store.expansion.changed.subscribe((change) => emitted.push(change));

    store.expansion.toggle('r1', { emitEvent: false });
    expect(store.expansion().has('r1')).toBe(true);

    store.expansion.expand(undefined, { emitEvent: false });
    expect(store.expansion().has('r2')).toBe(true);

    store.expansion.set(['r3'], { emitEvent: false });
    expect(store.expansion().has('r3')).toBe(true);
    expect(store.expansion().has('r1')).toBe(false);

    store.expansion.collapse(undefined, { emitEvent: false });
    expect(store.expansion().size).toBe(0);

    expect(emitted).toEqual([]);
  });

  it('changed completes when the table is destroyed, so subscribers do not leak', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    let completed = false;
    store.expansion.changed.subscribe({ complete: () => (completed = true) });
    expect(completed).toBe(false);

    TestBed.resetTestingModule();

    expect(completed).toBe(true);
  });

  it('removing an open row from data clears it from expansion() but not everExpanded(), via either write path (ADR-0006)', () => {
    const data = signal(makeRows());
    const store = inContext(() =>
      createTable(data, { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    // Write path 1: the raw data signal directly.
    store.expansion.toggle('r1');
    expect(store.expansion().has('r1')).toBe(true);
    expect(store.expansion.everExpanded().has('r1')).toBe(true);

    data.update((rows) => rows.filter((row) => row.id !== 'r1'));
    TestBed.tick();

    expect(store.expansion().has('r1')).toBe(false);
    expect(store.expansion.everExpanded().has('r1')).toBe(true);

    // Write path 2: through the store's own `value` WritableView — same underlying signal, a
    // different call surface. Reconciliation must fire either way.
    store.expansion.toggle('r2');
    expect(store.expansion().has('r2')).toBe(true);
    expect(store.expansion.everExpanded().has('r2')).toBe(true);

    store.value.update(removeRow('r2'));
    TestBed.tick();

    expect(store.expansion().has('r2')).toBe(false);
    expect(store.expansion.everExpanded().has('r2')).toBe(true);
  });

  it('composes with zero other features present — createTable(data, config, withExpansion()) works end-to-end', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    expect(store.rows().map((row) => row.id)).toEqual(['r1', 'r2', 'r3']);

    store.expansion.toggle('r1');
    expect(store.expansion().has('r1')).toBe(true);
  });

  it('initial seeds both expansion() and everExpanded() at construction, emitting nothing on changed', () => {
    const emitted: ExpansionChange[] = [];
    const store = inContext(() => {
      const s = createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withExpansion({ initial: ['r1', 'r2'] })
      );
      s.expansion.changed.subscribe((change) => emitted.push(change));
      return s;
    });

    expect(store.expansion().has('r1')).toBe(true);
    expect(store.expansion().has('r2')).toBe(true);
    expect(store.expansion.everExpanded().has('r1')).toBe(true);
    expect(store.expansion.everExpanded().has('r2')).toBe(true);
    expect(emitted).toEqual([]);
  });

  it('initial seeded rows behave normally afterward: toggle, expand, collapse all work on top of the seed', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withExpansion({ initial: ['r1'] })
      )
    );

    // Toggle collapses the seeded row.
    store.expansion.toggle('r1');
    expect(store.expansion().has('r1')).toBe(false);
    // everExpanded remains true — additive, never shrinks.
    expect(store.expansion.everExpanded().has('r1')).toBe(true);

    // expand() re-opens everything, including re-expanding r1.
    store.expansion.expand();
    expect(store.expansion().has('r1')).toBe(true);
    expect(store.expansion().has('r2')).toBe(true);

    // collapse() clears everything, seed included.
    store.expansion.collapse();
    expect(store.expansion().size).toBe(0);
    expect(store.expansion.everExpanded().has('r1')).toBe(true);
  });

  it('claims no render stage: renderRows() is 1:1 with rows(), every depth is 0, isExpanded is unstamped on every row', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    // Opening a panel must not synthesize or nest any row — there is no contributor to the
    // union `flattenVisible` walks, so it never stamps `isExpanded`.
    store.expansion.toggle('r1');

    const renderRows = store.renderRows();
    expect(renderRows.map((row) => row.id)).toEqual(store.rows().map((row) => row.id));
    expect(renderRows.every((row) => row.depth === 0)).toBe(true);
    expect(renderRows.every((row) => row.isExpanded === undefined)).toBe(true);
  });

  describe('composed with withTree()', () => {
    // Only this group needs a row shape with a parent link — the panel itself never reads row
    // shape, so every other case above stays on the flat `Row` fixture.
    interface TreeRow {
      id: string;
      name: string;
      parentId?: string | null;
    }

    function makeTreeColumns(): ColumnSet<TreeRow, readonly ColumnDecl<TreeRow, string, unknown>[]> {
      return createColumns(noData<TreeRow>(), (col) => [col('name')]);
    }

    function makeTreeRows(): TreeRow[] {
      return [
        { id: 'r1', name: 'Parent' },
        { id: 'c1', name: 'Child 1', parentId: 'r1' },
        { id: 'r2', name: 'Leaf' },
      ];
    }

    it('opening a panel never reveals children — only tree.toggle() does — in either argument order (the ADR-0012 correction: the panel contributes nothing to the union, so it cannot collide)', () => {
      const orders = ['expansion-first', 'tree-first'] as const;

      for (const order of orders) {
        const store = inContext(() =>
          order === 'expansion-first'
            ? createTable(
                signal<TreeRow[]>(makeTreeRows()),
                { trackBy: 'id', columns: makeTreeColumns() },
                withExpansion(),
                withTree({ parentId: (row) => row.parentId })
              )
            : createTable(
                signal<TreeRow[]>(makeTreeRows()),
                { trackBy: 'id', columns: makeTreeColumns() },
                withTree({ parentId: (row) => row.parentId }),
                withExpansion()
              )
        );

        store.expansion.toggle('r1');
        expect(store.renderRows().map((row) => row.id)).toEqual(['r1', 'r2']);
        expect(store.expansion().has('r1')).toBe(true);
        expect(store.tree().has('r1')).toBe(false);

        store.tree.toggle('r1');
        expect(store.renderRows().map((row) => row.id)).toEqual(['r1', 'c1', 'r2']);
      }
    });
  });

  // -------------------------------------------------------------------------------------
  // Type-level assertions. The vitest executor does NOT typecheck `expectTypeOf` — it is
  // inert at runtime. These are only enforced by `tsc -p libs/table/tsconfig.spec.json
  // --noEmit`, which is the verification step for this describe block.
  // -------------------------------------------------------------------------------------
  describe('types', () => {
    it('withExpansion() alone: composed members are recovered exactly, never widened to any', () => {
      const store = inContext(() =>
        createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
      );

      expectTypeOf<keyof typeof store>().toEqualTypeOf<
        keyof TableStore<Row> | keyof ExpansionMembers
      >();
      expectTypeOf(store).not.toBeAny();
      expectTypeOf(store.expansion).toMatchTypeOf<ExpansionSlice>();
      expectTypeOf(store.expansion()).toEqualTypeOf<ReadonlySet<RowId>>();
    });

    it('withComputed() as a trailing derive block adds a typed member derived from expansion()', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withExpansion({}, withComputed((s) => ({ openCount: computed(() => s.expansion().size) })))
        )
      );

      expectTypeOf(store.openCount).toEqualTypeOf<Signal<number>>();

      expect(store.openCount()).toBe(0);

      store.expansion.toggle('r1');
      expect(store.openCount()).toBe(1);

      store.expansion.collapse();
      expect(store.openCount()).toBe(0);
    });

    it('the derive-first form compiles: withExpansion(withComputed(...))', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withExpansion(withComputed((s) => ({ openCount: computed(() => s.expansion().size) })))
        )
      );

      expectTypeOf(store.openCount).toEqualTypeOf<Signal<number>>();
      expect(store.openCount()).toBe(0);
    });

    it('a trailing derive on grouping sees s.expansion only when withExpansion() is composed first (D25 — types stricter than runtime)', () => {
      // Expansion first: grouping's trailing block sees `expansion` off the accumulated `In`.
      inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withExpansion(),
          withGrouping(
            {},
            withComputed((s) => {
              expectTypeOf(s.expansion).toEqualTypeOf<ExpansionSlice>();
              return {};
            })
          )
        )
      );

      // Grouping first: the same read is a compile error — this slot's `In` doesn't carry
      // `ExpansionMembers` yet.
      inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withGrouping(
            {},
            withComputed((s) => {
              // @ts-expect-error — expansion is declared by withExpansion(), composed after
              // grouping in this order (D25).
              expectTypeOf(s.expansion).toEqualTypeOf<ExpansionSlice>();
              return {};
            })
          ),
          withExpansion()
        )
      );
    });
  });
});
