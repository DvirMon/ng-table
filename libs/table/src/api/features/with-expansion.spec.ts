import { computed, signal, type Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expectTypeOf } from 'vitest';
import { removeRow } from '../../mutations/row-mutations';
import { createTable } from '../create-table';
import type { ColumnDef, RowId, TableStore } from '../types';
import { withComputed } from './with-computed';
import { withExpansion, type ExpansionMembers } from './with-expansion';
import { withGrouping } from './with-grouping';

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

  it('hasChildren is true only for rows with a non-empty children array; isExpanded matches expandedRows membership for a row with children, and is undefined for a childless row (C4)', () => {
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

    // C4: c2 and r2 are childless (hasChildren: false) — the walk now leaves isExpanded
    // undefined for them instead of stamping false.
    expect(c2?.hasChildren).toBe(false);
    expect(c2?.isExpanded).toBeUndefined();

    expect(r2?.hasChildren).toBe(false);
    expect(r2?.isExpanded).toBeUndefined();
  });

  it('C4 — flat table, withExpansion() composed, nothing expandable: isExpanded is undefined on every row (a leaf now reads undefined, not false)', () => {
    interface FlatRow {
      id: string;
      name: string;
    }
    const flatRows: FlatRow[] = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ];
    const columns: ColumnDef<FlatRow>[] = [
      { id: 'name', accessor: (row) => row.name, visible: true, order: 0, label: 'name' },
    ];

    const store = inContext(() =>
      createTable(signal<FlatRow[]>(flatRows), { trackBy: 'id', columns }, withExpansion())
    );

    const renderRows = store.renderRows();
    expect(renderRows).toHaveLength(2);
    expect(renderRows.every((row) => row.hasChildren === false)).toBe(true);
    expect(renderRows.every((row) => row.isExpanded === undefined)).toBe(true);
  });

  it("C3 — a row whose childrenAccessor returns [] but isExpandable returns true renders hasChildren: true so its toggle shows before children load; toggling it adds no rows, and supplying children afterwards nests them at depth + 1", () => {
    const data = signal<Row[]>([
      { id: 'lazy', name: 'Lazy parent' }, // children undefined — not fetched yet
      { id: 'leaf', name: 'Leaf' },
    ]);
    const store = inContext(() =>
      createTable(
        data,
        { trackBy: 'id', columns: makeColumns() },
        withExpansion({ isExpandable: (row) => row.id === 'lazy' })
      )
    );

    // Before anything is toggled or loaded: the toggle must already render.
    const before = store.renderRows();
    expect(before.map((row) => row.id)).toEqual(['lazy', 'leaf']);
    expect(before.find((row) => row.id === 'lazy')?.hasChildren).toBe(true);

    // Toggling open with no loaded children adds no rows — childrenAccessor still returns [].
    store.toggleExpanded('lazy');
    expect(store.renderRows().map((row) => row.id)).toEqual(['lazy', 'leaf']);

    // Children load afterwards — no re-toggle needed, they appear nested at depth + 1.
    data.update((rows) =>
      rows.map((row) =>
        row.id === 'lazy' ? { ...row, children: [{ id: 'lazy-child', name: 'Loaded child' }] } : row
      )
    );
    TestBed.tick();

    const after = store.renderRows();
    expect(after.map((row) => row.id)).toEqual(['lazy', 'lazy-child', 'leaf']);
    expect(after.find((row) => row.id === 'lazy-child')?.depth).toBe(1);
  });

  it("visibility comes entirely from the walk, not the 'tree' stage: nested rows are absent until toggled, then exactly that subtree's direct children appear (user story 7)", () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    // The 'tree' stage already nested c1/c2 under r1 and g1 under c1 — nothing renders until
    // the walk is told to descend.
    expect(store.renderRows().map((row) => row.id)).toEqual(['r1', 'r2']);

    // One toggle reveals exactly r1's own direct children — not c1's grandchild.
    store.toggleExpanded('r1');
    const renderRows = store.renderRows();
    expect(renderRows.map((row) => row.id)).toEqual(['r1', 'c1', 'c2', 'r2']);
    expect(renderRows.find((row) => row.id === 'c1')?.depth).toBe(1);
    expect(renderRows.find((row) => row.id === 'c2')?.depth).toBe(1);
    expect(renderRows.map((row) => row.id)).not.toContain('g1');
  });

  it("a tree child's parentId is its parent row's id, at depth 1 and depth 2", () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    store.toggleExpanded('r1');
    store.toggleExpanded('c1');

    const renderRows = store.renderRows();
    const c1 = renderRows.find((row) => row.id === 'c1');
    const c2 = renderRows.find((row) => row.id === 'c2');
    const g1 = renderRows.find((row) => row.id === 'g1');

    expect(c1?.parentId).toBe('r1'); // depth 1
    expect(c2?.parentId).toBe('r1'); // depth 1
    expect(g1?.parentId).toBe('c1'); // depth 2
  });

  it('a top-level row has parentId === undefined', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withExpansion())
    );

    const renderRows = store.renderRows();
    const r1 = renderRows.find((row) => row.id === 'r1');
    const r2 = renderRows.find((row) => row.id === 'r2');

    expect(r1?.parentId).toBeUndefined();
    expect(r2?.parentId).toBeUndefined();
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

  it('initialExpanded seeds expandedRows and everExpanded at construction, emitting nothing on rowExpanded', () => {
    const emitted: RowId[] = [];
    const store = inContext(() => {
      const s = createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withExpansion({ initialExpanded: ['r1', 'c1'] })
      );
      s.rowExpanded.subscribe((id) => emitted.push(id));
      return s;
    });

    expect(store.expandedRows().has('r1')).toBe(true);
    expect(store.expandedRows().has('c1')).toBe(true);
    expect(store.everExpanded().has('r1')).toBe(true);
    expect(store.everExpanded().has('c1')).toBe(true);
    expect(emitted).toEqual([]);
  });

  it('initialExpanded seeds renderRows as already expanded', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withExpansion({ initialExpanded: ['r1'] })
      )
    );

    expect(store.renderRows().map((row) => row.id)).toEqual(['r1', 'c1', 'c2', 'r2']);
  });

  it('initialExpanded seeded rows behave normally afterward: toggle, expandAll, collapseAll all work on top of the seed', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withExpansion({ initialExpanded: ['r1'] })
      )
    );

    // Toggle collapses the seeded row.
    store.toggleExpanded('r1');
    expect(store.expandedRows().has('r1')).toBe(false);
    // everExpanded remains true — additive, never shrinks.
    expect(store.everExpanded().has('r1')).toBe(true);

    // expandAll expands everything expandable, including re-expanding r1.
    store.expandAll();
    expect(store.expandedRows().has('r1')).toBe(true);
    expect(store.expandedRows().has('c1')).toBe(true);

    // collapseAll clears everything, seed included.
    store.collapseAll();
    expect(store.expandedRows().size).toBe(0);
    expect(store.everExpanded().has('r1')).toBe(true);
  });

  it("C1 — mapNodes reaches through group nodes: composing withGrouping() + withExpansion() together, a data row nested under a group header still gets its own children nested (capability the walk didn't have before this migration)", () => {
    interface GroupableRow {
      id: string;
      region: string;
      children?: GroupableRow[];
    }
    const rows: GroupableRow[] = [
      { id: 'p1', region: 'US', children: [{ id: 'c1', region: 'US' }] },
      { id: 'p2', region: 'EU' },
    ];
    const columns: ColumnDef<GroupableRow>[] = [
      { id: 'region', accessor: (row) => row.region, visible: true, order: 0, label: 'region' },
    ];

    const store = inContext(() =>
      createTable(
        signal<GroupableRow[]>(rows),
        { trackBy: 'id', columns },
        withGrouping({ initial: ['region'] }),
        withExpansion()
      )
    );

    const usHeader = store
      .renderRows()
      .find((row) => row.kind === 'group' && row.groupKey?.value === 'US');
    expect(usHeader).toBeDefined();

    // Expand the group header — p1 appears, stamped by the 'tree' stage reaching through the
    // group node — but p1's own child is not yet toggled open.
    store.toggleExpanded(usHeader?.id ?? '');
    const afterGroupExpand = store.renderRows();
    const p1 = afterGroupExpand.find((row) => row.id === 'p1');
    expect(p1).toBeDefined();
    expect(p1?.hasChildren).toBe(true);
    expect(afterGroupExpand.map((row) => row.id)).not.toContain('c1');

    // Expand p1 itself — c1 nests under it, independent of the group header.
    store.toggleExpanded('p1');
    const afterRowExpand = store.renderRows();
    const c1 = afterRowExpand.find((row) => row.id === 'c1');
    expect(c1).toBeDefined();
    expect(c1?.depth).toBe(2); // group header depth 0, p1 depth 1, c1 depth 2
    expect(c1?.parentId).toBe('p1');
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
