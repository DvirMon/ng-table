import { computed, signal, type Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expectTypeOf } from 'vitest';
import { removeRow } from '../../mutations/row-mutations';
import { createTable } from '../create-table';
import type { ColumnDef, RowId, TableStore } from '../types';
import { withComputed } from './with-computed';
import { withExpansion, type ExpansionMembers } from './with-expansion';

interface Row {
  id: string;
  name: string;
  children?: Row[];
}

interface CustomChildrenRow {
  id: string;
  name: string;
  nested?: CustomChildrenRow[];
}

function makeColumns(): ColumnDef<Row>[] {
  return [
    { id: 'name', accessor: (row) => row.name, visible: true, order: 0, label: 'name' },
  ];
}

// Small tree: r1 has two children (c1, c1 has a grandchild g1); r2 is a leaf.
function makeRows(): Row[] {
  return [
    {
      id: 'r1',
      name: 'Parent',
      children: [
        {
          id: 'c1',
          name: 'Child 1',
          children: [{ id: 'g1', name: 'Grandchild 1' }],
        },
        { id: 'c2', name: 'Child 2' },
      ],
    },
    { id: 'r2', name: 'Leaf' },
  ];
}

/** Runs `build` inside an Angular injection context — `createTable()` requires one unless
 *  `config.injector` is passed. */
function inContext<T>(build: () => T): T {
  return TestBed.runInInjectionContext(build);
}

describe('withExpansion', () => {
  it('toggleExpanded(id) flips a row from collapsed to expanded and back', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    expect(store.expandedRows().has('r1')).toBe(false);

    store.toggleExpanded('r1');
    expect(store.expandedRows().has('r1')).toBe(true);

    store.toggleExpanded('r1');
    expect(store.expandedRows().has('r1')).toBe(false);
  });

  it('expanding row A does not collapse row B (multi-expand)', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    store.toggleExpanded('r1');
    store.toggleExpanded('c1');

    expect(store.expandedRows().has('r1')).toBe(true);
    expect(store.expandedRows().has('c1')).toBe(true);
  });

  it('expandAll() expands every row that has children, leaves leaves alone', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    store.expandAll();

    const expanded = store.expandedRows();
    expect(expanded.has('r1')).toBe(true);
    expect(expanded.has('c1')).toBe(true);
    expect(expanded.has('c2')).toBe(false);
    expect(expanded.has('r2')).toBe(false);
    expect(expanded.has('g1')).toBe(false);
  });

  it('expandAll(explicitIds) expands exactly those ids verbatim — no isExpandable filter, no recursion', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>([{ id: 'leaf', name: 'Leaf, no children' }]),
        { trackBy: 'id', columns: makeColumns() },
        withExpansion()
      )
    );

    // A synthetic id with no corresponding row — `isExpandable` would reject 'leaf' too, and
    // 'group:region:US' has no TRow to test against it or recurse into at all.
    store.expandAll(['group:region:US', 'leaf']);

    const expanded = store.expandedRows();
    expect(expanded.has('group:region:US')).toBe(true);
    expect(expanded.has('leaf')).toBe(true);
  });

  it('expandAll(explicitIds) unions the explicit ids with auto-discovered expandable rows', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    store.expandAll(['group:region:US']);

    const expanded = store.expandedRows();
    expect(expanded.has('group:region:US')).toBe(true);
    expect(expanded.has('r1')).toBe(true);
    expect(expanded.has('c1')).toBe(true);
  });

  it('collapseAll() clears all expansion regardless of prior state', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    store.expandAll();
    expect(store.expandedRows().size).toBeGreaterThan(0);

    store.collapseAll();
    expect(store.expandedRows().size).toBe(0);
  });

  it('rowExpanded emits the toggled RowId on both expand and collapse', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    const emitted: RowId[] = [];
    store.rowExpanded.subscribe((id) => emitted.push(id));

    store.toggleExpanded('r1'); // expand
    store.toggleExpanded('r1'); // collapse

    expect(emitted).toEqual(['r1', 'r1']);
  });

  it('expandAll() emits rowExpanded once per newly expanded id, and nothing on a repeat', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    const emitted: RowId[] = [];
    store.rowExpanded.subscribe((id) => emitted.push(id));

    store.expandAll();
    expect([...emitted].sort()).toEqual([...store.expandedRows()].sort());

    emitted.length = 0;
    store.expandAll();
    expect(emitted).toEqual([]);
  });

  it('rowExpanded completes when the table is destroyed, so subscribers do not leak', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    let completed = false;
    store.rowExpanded.subscribe({ complete: () => (completed = true) });
    expect(completed).toBe(false);

    TestBed.resetTestingModule();

    expect(completed).toBe(true);
  });

  it('emitEvent: false suppresses the emission on every write verb, state still changes', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    const emitted: RowId[] = [];
    store.rowExpanded.subscribe((id) => emitted.push(id));

    store.toggleExpanded('r1', { emitEvent: false });
    expect(store.expandedRows().has('r1')).toBe(true);

    store.expandAll({ emitEvent: false });
    expect(store.expandedRows().size).toBeGreaterThan(1);

    store.collapseAll({ emitEvent: false });
    expect(store.expandedRows().size).toBe(0);

    expect(emitted).toEqual([]);
  });

  it('collapseAll() emits rowExpanded once per previously expanded id', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    store.expandAll();
    const expandedBefore = [...store.expandedRows()];

    const emitted: RowId[] = [];
    store.rowExpanded.subscribe((id) => emitted.push(id));

    store.collapseAll();

    expect([...emitted].sort()).toEqual([...expandedBefore].sort());
    expect(store.expandedRows().size).toBe(0);
  });

  it("renderRows() excludes a row's children when collapsed (default state)", () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    const ids = store.renderRows().map((row) => row.id);
    expect(ids).toEqual(['r1', 'r2']);
  });

  it("renderRows() includes a row's children, at depth + 1, only once that row is expanded", () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    store.toggleExpanded('r1');

    const renderRows = store.renderRows();
    const childRow = renderRows.find((row) => row.id === 'c1');
    const otherChildRow = renderRows.find((row) => row.id === 'c2');

    expect(renderRows.map((row) => row.id)).toEqual(['r1', 'c1', 'c2', 'r2']);
    expect(childRow?.depth).toBe(1);
    expect(otherChildRow?.depth).toBe(1);
  });

  it('nested/grandchild case: a depth-2 child only appears once both its ancestors are expanded independently', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    // Only r1 expanded — grandchild g1 (under c1) must not appear yet.
    store.toggleExpanded('r1');
    expect(store.renderRows().map((row) => row.id)).not.toContain('g1');

    // Now expand c1 too — g1 should appear at depth 2.
    store.toggleExpanded('c1');
    const renderRows = store.renderRows();
    const grandchild = renderRows.find((row) => row.id === 'g1');

    expect(renderRows.map((row) => row.id)).toEqual(['r1', 'c1', 'g1', 'c2', 'r2']);
    expect(grandchild?.depth).toBe(2);
  });

  it('hasChildren is true only for rows with a non-empty children array; isExpanded matches expandedRows membership', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    store.toggleExpanded('r1');

    const renderRows = store.renderRows();
    const r1 = renderRows.find((row) => row.id === 'r1');
    const c1 = renderRows.find((row) => row.id === 'c1');
    const c2 = renderRows.find((row) => row.id === 'c2');
    const r2 = renderRows.find((row) => row.id === 'r2');

    expect(r1?.hasChildren).toBe(true);
    expect(r1?.isExpanded).toBe(true);

    expect(c1?.hasChildren).toBe(true);
    expect(c1?.isExpanded).toBe(false);

    expect(c2?.hasChildren).toBe(false);
    expect(c2?.isExpanded).toBe(false);

    expect(r2?.hasChildren).toBe(false);
    expect(r2?.isExpanded).toBe(false);
  });

  it('custom childrenAccessor is honored (row shape where children live under a different key)', () => {
    const rows: CustomChildrenRow[] = [
      {
        id: 'p1',
        name: 'Parent',
        nested: [{ id: 'n1', name: 'Nested Child' }],
      },
    ];
    const columns: ColumnDef<CustomChildrenRow>[] = [
      { id: 'name', accessor: (row) => row.name, visible: true, order: 0, label: 'name' },
    ];

    const store = inContext(() =>
      createTable(
        signal<CustomChildrenRow[]>(rows),
        { trackBy: 'id', columns },
        withExpansion({
          // No explicit annotation on `row` — the acceptance evidence that the consumer's row
          // type flows through unannotated.
          childrenAccessor: (row) => {
            expectTypeOf(row).toEqualTypeOf<CustomChildrenRow>();
            return row.nested;
          },
        })
      )
    );

    expect(store.renderRows().map((row) => row.id)).toEqual(['p1']);
    expect(store.renderRows()[0]?.hasChildren).toBe(true);

    store.toggleExpanded('p1');

    const renderRows = store.renderRows();
    expect(renderRows.map((row) => row.id)).toEqual(['p1', 'n1']);
    expect(renderRows.find((row) => row.id === 'n1')?.depth).toBe(1);
  });

  it('removing an expanded row from data clears it from expandedRows but not everExpanded, via either write path (ADR-0006)', () => {
    const data = signal(makeRows());
    const store = inContext(() =>
      createTable(data, { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    // Write path 1: the raw data signal directly.
    store.toggleExpanded('r1');
    expect(store.expandedRows().has('r1')).toBe(true);
    expect(store.everExpanded().has('r1')).toBe(true);

    data.update((rows) => rows.filter((row) => row.id !== 'r1'));
    TestBed.tick();

    expect(store.expandedRows().has('r1')).toBe(false);
    expect(store.everExpanded().has('r1')).toBe(true);

    // Write path 2: through the store's own `value` WritableView — same underlying signal,
    // a different call surface. Reconciliation must fire either way.
    store.toggleExpanded('r2');
    expect(store.expandedRows().has('r2')).toBe(true);
    expect(store.everExpanded().has('r2')).toBe(true);

    store.value.update(removeRow('r2'));
    TestBed.tick();

    expect(store.expandedRows().has('r2')).toBe(false);
    expect(store.everExpanded().has('r2')).toBe(true);
  });

  it('composes with zero other features present — createTable(data, config, withExpansion()) alone works end-to-end', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    expect(store.rows().map((row) => row.id)).toEqual(['r1', 'r2']);

    store.toggleExpanded('r1');
    expect(store.renderRows().map((row) => row.id)).toEqual(['r1', 'c1', 'c2', 'r2']);
  });

  // -------------------------------------------------------------------------------------
  // Type-level assertions. The vitest executor does NOT typecheck `expectTypeOf` — it is
  // inert at runtime. These are only enforced by `tsc -p libs/shared/table/tsconfig.spec.json
  // --noEmit`, which is the verification step for this describe block.
  // -------------------------------------------------------------------------------------
  describe('types', () => {
    it('withExpansion() alone: composed members are recovered exactly, never widened to any', () => {
      const store = inContext(() =>
        createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
      );

      expectTypeOf<keyof typeof store>().toEqualTypeOf<keyof TableStore<Row> | keyof ExpansionMembers>();
      expectTypeOf(store).not.toBeAny();
      expectTypeOf(store.expandedRows).toEqualTypeOf<Signal<Set<RowId>>>();
    });

    it('withComputed() as a trailing derive block adds a typed member derived from expandedRows', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withExpansion(
            { isExpandable: (row) => row.id === 'r1' },
            withComputed((s) => ({ openCount: computed(() => s.expandedRows().size) }))
          )
        )
      );

      expectTypeOf(store.openCount).toEqualTypeOf<Signal<number>>();

      expect(store.openCount()).toBe(0);

      store.toggleExpanded('r1');
      expect(store.openCount()).toBe(1);

      store.collapseAll();
      expect(store.openCount()).toBe(0);
    });

    it('the derive-first form compiles: withExpansion(withComputed(...))', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withExpansion(withComputed((s) => ({ openCount: computed(() => s.expandedRows().size) })))
        )
      );

      expectTypeOf(store.openCount).toEqualTypeOf<Signal<number>>();
      expect(store.openCount()).toBe(0);
    });
  });
});
