import { computed, signal, type Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expectTypeOf, vi } from 'vitest';
import { removeRow } from '../../mutations/row-mutations';
import { mockGroupingRows, mockGroupingTrackBy, type GroupingMockRow } from '../../table.mock';
import { createTable } from '../create-table';
import { createTableFeature } from '../create-table-feature';
import type { ColumnDef, RowId, TableStore } from '../types';
import { withComputed } from './with-computed';
import { withGrouping } from './with-grouping';
import { withTree, type ExpansionChange, type TreeMembers, type TreeSlice } from './with-tree';

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

// No `row.children` fallback any more (D2/E6) — every composition below passes this
// explicitly.
const childrenAccessor = (row: Row): Row[] | undefined => row.children;

function makeGroupingColumns(): ColumnDef<GroupingMockRow>[] {
  return [{ id: 'region', accessor: (row) => row.region, visible: true, order: 0, label: 'Region' }];
}

// A minimal feature that claims the 'tree' render stage — stands in for whatever a future
// panel feature will claim once #121 lands. Deliberately not `withExpansion()`: it claims
// 'tree' unconditionally today and stops in #121, which would make this file fail on an
// unrelated issue, and it would be asserting the panel's domain from the tree's own spec.
const claimsTreeStage = createTableFeature(() => ({
  renderStages: { tree: (nodes) => nodes },
}));

describe('withTree', () => {
  it('toggle(id) flips a row from collapsed to expanded and back', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withTree({ childrenAccessor }))
    );

    expect(store.tree().has('r1')).toBe(false);

    store.tree.toggle('r1');
    expect(store.tree().has('r1')).toBe(true);

    store.tree.toggle('r1');
    expect(store.tree().has('r1')).toBe(false);
  });

  it('expanding row A does not collapse row B (multi-expand)', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withTree({ childrenAccessor }))
    );

    store.tree.toggle('r1');
    store.tree.toggle('c1');

    expect(store.tree().has('r1')).toBe(true);
    expect(store.tree().has('c1')).toBe(true);
  });

  it('expand() with no ids opens every expandable row at any depth, leaves leaves closed', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withTree({ childrenAccessor }))
    );

    store.tree.expand();

    const expanded = store.tree();
    expect(expanded.has('r1')).toBe(true);
    expect(expanded.has('c1')).toBe(true);
    expect(expanded.has('c2')).toBe(false);
    expect(expanded.has('r2')).toBe(false);
    expect(expanded.has('g1')).toBe(false);
  });

  it('expand(ids) adds exactly those ids, with no isExpandable filter and no discovery recursion', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withTree({ childrenAccessor }))
    );

    // c2 has no children — the default isExpandable would reject it. The synthetic id has no
    // corresponding row at all. Both must still land in the open set verbatim.
    store.tree.expand(['c2', 'synthetic:not-a-row']);

    const expanded = store.tree();
    expect(expanded.has('c2')).toBe(true);
    expect(expanded.has('synthetic:not-a-row')).toBe(true);
    expect(expanded.has('r1')).toBe(false); // no recursion into ancestors or siblings
  });

  it('expand(ids) adds to the current set rather than replacing it (regression guard: old expandAll union semantics must not return)', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withTree({ childrenAccessor }))
    );

    store.tree.toggle('r1');
    store.tree.expand(['c1']);

    const expanded = store.tree();
    expect(expanded.has('r1')).toBe(true);
    expect(expanded.has('c1')).toBe(true);
  });

  it('collapse(ids) removes exactly those ids and leaves the rest open', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withTree({ childrenAccessor }))
    );

    store.tree.expand(); // opens r1, c1
    store.tree.collapse(['r1']);

    const expanded = store.tree();
    expect(expanded.has('r1')).toBe(false);
    expect(expanded.has('c1')).toBe(true);
  });

  it('collapse() with no ids clears everything', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withTree({ childrenAccessor }))
    );

    store.tree.expand();
    expect(store.tree().size).toBeGreaterThan(0);

    store.tree.collapse();
    expect(store.tree().size).toBe(0);
  });

  it('set(ids) replaces atomically — an open id absent from ids closes in the same write', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withTree({ childrenAccessor }))
    );

    store.tree.expand(['r1', 'c1']);
    store.tree.set(['c1']);

    const expanded = store.tree();
    expect(expanded.has('r1')).toBe(false);
    expect(expanded.has('c1')).toBe(true);
  });

  it('changed emits once per write — toggle expanding emits { added: [id], removed: [] }', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withTree({ childrenAccessor }))
    );

    const emitted: ExpansionChange[] = [];
    store.tree.changed.subscribe((change) => emitted.push(change));

    store.tree.toggle('r1');

    expect(emitted).toEqual([{ added: ['r1'], removed: [] }]);
  });

  it('changed emits once for expand() over a fresh table, added holding every newly opened id', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withTree({ childrenAccessor }))
    );

    const emitted: ExpansionChange[] = [];
    store.tree.changed.subscribe((change) => emitted.push(change));

    store.tree.expand();

    expect(emitted).toHaveLength(1);
    expect([...emitted[0].added].sort()).toEqual(['c1', 'r1']);
    expect(emitted[0].removed).toEqual([]);
  });

  it('changed emits once for collapse(), removed holding every previously open id', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withTree({ childrenAccessor }))
    );

    store.tree.expand();
    const emitted: ExpansionChange[] = [];
    store.tree.changed.subscribe((change) => emitted.push(change));

    store.tree.collapse();

    expect(emitted).toHaveLength(1);
    expect([...emitted[0].removed].sort()).toEqual(['c1', 'r1']);
    expect(emitted[0].added).toEqual([]);
  });

  it('a repeat write that changes nothing emits nothing on changed', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withTree({ childrenAccessor }))
    );

    store.tree.expand();
    const emitted: ExpansionChange[] = [];
    store.tree.changed.subscribe((change) => emitted.push(change));

    store.tree.expand(); // same set again — no-op

    expect(emitted).toEqual([]);
  });

  it('emitEvent: false suppresses changed on every write verb, tree() still changes', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withTree({ childrenAccessor }))
    );

    const emitted: ExpansionChange[] = [];
    store.tree.changed.subscribe((change) => emitted.push(change));

    store.tree.toggle('r1', { emitEvent: false });
    expect(store.tree().has('r1')).toBe(true);

    store.tree.expand(undefined, { emitEvent: false });
    expect(store.tree().has('c1')).toBe(true);

    store.tree.set(['r2'], { emitEvent: false });
    expect(store.tree().has('r2')).toBe(true);
    expect(store.tree().has('r1')).toBe(false);

    store.tree.collapse(undefined, { emitEvent: false });
    expect(store.tree().size).toBe(0);

    expect(emitted).toEqual([]);
  });

  it('changed completes when the table is destroyed, so subscribers do not leak', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withTree({ childrenAccessor }))
    );

    let completed = false;
    store.tree.changed.subscribe({ complete: () => (completed = true) });
    expect(completed).toBe(false);

    TestBed.resetTestingModule();

    expect(completed).toBe(true);
  });

  it("renderRows() excludes a row's children when collapsed (default state)", () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withTree({ childrenAccessor }))
    );

    const ids = store.renderRows().map((row) => row.id);
    expect(ids).toEqual(['r1', 'r2']);
  });

  it("renderRows() includes a row's children, at depth + 1, only once that row is expanded", () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withTree({ childrenAccessor }))
    );

    store.tree.toggle('r1');

    const renderRows = store.renderRows();
    const childRow = renderRows.find((row) => row.id === 'c1');
    const otherChildRow = renderRows.find((row) => row.id === 'c2');

    expect(renderRows.map((row) => row.id)).toEqual(['r1', 'c1', 'c2', 'r2']);
    expect(childRow?.depth).toBe(1);
    expect(otherChildRow?.depth).toBe(1);
  });

  it('nested/grandchild case: a depth-2 child only appears once both its ancestors are expanded independently', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withTree({ childrenAccessor }))
    );

    // Only r1 expanded — grandchild g1 (under c1) must not appear yet.
    store.tree.toggle('r1');
    expect(store.renderRows().map((row) => row.id)).not.toContain('g1');

    // Now expand c1 too — g1 should appear at depth 2.
    store.tree.toggle('c1');
    const renderRows = store.renderRows();
    const grandchild = renderRows.find((row) => row.id === 'g1');

    expect(renderRows.map((row) => row.id)).toEqual(['r1', 'c1', 'g1', 'c2', 'r2']);
    expect(grandchild?.depth).toBe(2);
  });

  it('hasChildren is true only for rows with a non-empty children array; isExpanded matches tree() membership for a row with children, and is undefined for a childless row (C4)', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withTree({ childrenAccessor }))
    );

    store.tree.toggle('r1');

    const renderRows = store.renderRows();
    const r1 = renderRows.find((row) => row.id === 'r1');
    const c1 = renderRows.find((row) => row.id === 'c1');
    const c2 = renderRows.find((row) => row.id === 'c2');
    const r2 = renderRows.find((row) => row.id === 'r2');

    expect(r1?.hasChildren).toBe(true);
    expect(r1?.isExpanded).toBe(true);

    expect(c1?.hasChildren).toBe(true);
    expect(c1?.isExpanded).toBe(false);

    // C4: c2 and r2 are childless (hasChildren: false) — isExpanded is undefined for them,
    // not stamped false.
    expect(c2?.hasChildren).toBe(false);
    expect(c2?.isExpanded).toBeUndefined();

    expect(r2?.hasChildren).toBe(false);
    expect(r2?.isExpanded).toBeUndefined();
  });

  it('flat table, withTree() composed, nothing expandable: isExpanded is undefined on every row', () => {
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
      createTable(
        signal<FlatRow[]>(flatRows),
        { trackBy: 'id', columns },
        withTree({ childrenAccessor: (): FlatRow[] | undefined => undefined })
      )
    );

    const renderRows = store.renderRows();
    expect(renderRows).toHaveLength(2);
    expect(renderRows.every((row) => row.hasChildren === false)).toBe(true);
    expect(renderRows.every((row) => row.isExpanded === undefined)).toBe(true);
  });

  it("C3 — a row whose accessor returns [] but whose isExpandable returns true renders hasChildren: true so its toggle shows before children load; toggling it adds no rows, and supplying children afterwards nests them at depth + 1", () => {
    const data = signal<Row[]>([
      { id: 'lazy', name: 'Lazy parent' }, // children undefined — not fetched yet
      { id: 'leaf', name: 'Leaf' },
    ]);
    const store = inContext(() =>
      createTable(
        data,
        { trackBy: 'id', columns: makeColumns() },
        withTree({ childrenAccessor, isExpandable: (row) => row.id === 'lazy' })
      )
    );

    // Before anything is toggled or loaded: the toggle must already render.
    const before = store.renderRows();
    expect(before.map((row) => row.id)).toEqual(['lazy', 'leaf']);
    expect(before.find((row) => row.id === 'lazy')?.hasChildren).toBe(true);

    // Toggling open with no loaded children adds no rows — childrenAccessor still returns [].
    store.tree.toggle('lazy');
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

  it("a tree child's parentId is its parent row's id, at depth 1 and depth 2; a top-level row's parentId is undefined", () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withTree({ childrenAccessor }))
    );

    store.tree.toggle('r1');
    store.tree.toggle('c1');

    const renderRows = store.renderRows();
    const r1 = renderRows.find((row) => row.id === 'r1');
    const r2 = renderRows.find((row) => row.id === 'r2');
    const c1 = renderRows.find((row) => row.id === 'c1');
    const c2 = renderRows.find((row) => row.id === 'c2');
    const g1 = renderRows.find((row) => row.id === 'g1');

    expect(c1?.parentId).toBe('r1'); // depth 1
    expect(c2?.parentId).toBe('r1'); // depth 1
    expect(g1?.parentId).toBe('c1'); // depth 2
    expect(r1?.parentId).toBeUndefined();
    expect(r2?.parentId).toBeUndefined();
  });

  it('a custom accessor is honored (row shape where children live under a different key)', () => {
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
        withTree({ childrenAccessor: (row) => row.nested })
      )
    );

    expect(store.renderRows().map((row) => row.id)).toEqual(['p1']);
    expect(store.renderRows()[0]?.hasChildren).toBe(true);

    store.tree.toggle('p1');

    const renderRows = store.renderRows();
    expect(renderRows.map((row) => row.id)).toEqual(['p1', 'n1']);
    expect(renderRows.find((row) => row.id === 'n1')?.depth).toBe(1);
  });

  it('removing an expanded row from data clears it from tree(), via either write path (ADR-0006)', () => {
    const data = signal(makeRows());
    const store = inContext(() =>
      createTable(data, { trackBy: 'id', columns: makeColumns() }, withTree({ childrenAccessor }))
    );

    // Write path 1: the raw data signal directly.
    store.tree.toggle('r1');
    expect(store.tree().has('r1')).toBe(true);

    data.update((rows) => rows.filter((row) => row.id !== 'r1'));
    TestBed.tick();

    expect(store.tree().has('r1')).toBe(false);

    // Write path 2: through the store's own `value` WritableView — same underlying signal, a
    // different call surface. Reconciliation must fire either way.
    store.tree.toggle('r2');
    expect(store.tree().has('r2')).toBe(true);

    store.value.update(removeRow('r2'));
    TestBed.tick();

    expect(store.tree().has('r2')).toBe(false);
  });

  it('composes with zero other features present — createTable(data, config, withTree({ childrenAccessor })) works end-to-end', () => {
    const store = inContext(() =>
      createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withTree({ childrenAccessor }))
    );

    expect(store.rows().map((row) => row.id)).toEqual(['r1', 'r2']);

    store.tree.toggle('r1');
    expect(store.renderRows().map((row) => row.id)).toEqual(['r1', 'c1', 'c2', 'r2']);
  });

  it('initial seeds tree() at construction, emits nothing on changed, seeds renderRows() as already expanded, and the row behaves normally afterward', () => {
    const emitted: ExpansionChange[] = [];
    const store = inContext(() => {
      const s = createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withTree({ childrenAccessor, initial: ['r1'] })
      );
      s.tree.changed.subscribe((change) => emitted.push(change));
      return s;
    });

    expect(store.tree().has('r1')).toBe(true);
    expect(emitted).toEqual([]);
    expect(store.renderRows().map((row) => row.id)).toEqual(['r1', 'c1', 'c2', 'r2']);

    // toggle collapses the seeded row.
    store.tree.toggle('r1');
    expect(store.tree().has('r1')).toBe(false);

    // expand() re-expands everything expandable, including re-expanding r1.
    store.tree.expand();
    expect(store.tree().has('r1')).toBe(true);
    expect(store.tree().has('c1')).toBe(true);

    // collapse() clears everything, seed included.
    store.tree.collapse();
    expect(store.tree().size).toBe(0);
  });

  it("C1 — mapNodes reaches through group nodes: composing withGrouping() then withTree(), a data row nested under a group header still gets its own children nested (capability the walk didn't have before this migration)", () => {
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
    const groupableAccessor = (row: GroupableRow): GroupableRow[] | undefined => row.children;

    // Compile-time-legal order: withGrouping() must precede withTree() for the group stage to
    // have produced headers the tree stage then descends through. Render order is fixed
    // (RENDER_ORDER = ['group', 'tree']) regardless.
    const store = inContext(() =>
      createTable(
        signal<GroupableRow[]>(rows),
        { trackBy: 'id', columns },
        withGrouping({ initial: ['region'] }),
        withTree({ childrenAccessor: groupableAccessor })
      )
    );

    const usHeader = store
      .renderRows()
      .find((row) => row.kind === 'group' && row.groupKey?.value === 'US');
    expect(usHeader).toBeDefined();

    // Expand the group header — p1 appears, stamped by the 'tree' stage reaching through the
    // group node — but p1's own child is not yet toggled open.
    store.tree.toggle(usHeader?.id ?? '');
    const afterGroupExpand = store.renderRows();
    const p1 = afterGroupExpand.find((row) => row.id === 'p1');
    expect(p1).toBeDefined();
    expect(p1?.hasChildren).toBe(true);
    expect(afterGroupExpand.map((row) => row.id)).not.toContain('c1');

    // Expand p1 itself — c1 nests under it, independent of the group header.
    store.tree.toggle('p1');
    const afterRowExpand = store.renderRows();
    const c1 = afterRowExpand.find((row) => row.id === 'c1');
    expect(c1).toBeDefined();
    expect(c1?.depth).toBe(2); // group header depth 0, p1 depth 1, c1 depth 2
    expect(c1?.parentId).toBe('p1');
  });

  describe('collapse-only (D9/E13)', () => {
    it('withTree() with no accessor composes alongside a stage claimant without throwing; supplying childrenAccessor throws the slot-collision error', () => {
      expect(() =>
        inContext(() =>
          createTable(
            signal<Row[]>(makeRows()),
            { trackBy: 'id', columns: makeColumns() },
            claimsTreeStage,
            withTree()
          )
        )
      ).not.toThrow();

      expect(() =>
        inContext(() =>
          createTable(
            signal<Row[]>(makeRows()),
            { trackBy: 'id', columns: makeColumns() },
            claimsTreeStage,
            withTree({ childrenAccessor })
          )
        )
      ).toThrow(/feature 1 and feature 2 \(withTree\) both provide the "tree" render stage/);
    });

    it("collapse-only over the r1 -> c1 -> g1 fixture: renderRows() is 1:1 with rows(), every row at depth 0 with hasChildren: false and isExpanded: undefined — no children nested, because no stage ran", () => {
      const store = inContext(() =>
        createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withTree())
      );

      const renderRows = store.renderRows();

      expect(renderRows.map((row) => row.id)).toEqual(store.rows().map((row) => row.id));
      expect(renderRows.every((row) => row.depth === 0)).toBe(true);
      expect(renderRows.every((row) => row.hasChildren === false)).toBe(true);
      expect(renderRows.every((row) => row.isExpanded === undefined)).toBe(true);
    });

    it('collapse-only still hides descendants: composing withGrouping() with withTree(), group headers render and their members stay hidden until tree.expand(table.groupIds()) opens them', () => {
      const store = inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeGroupingColumns() },
          withGrouping({ initial: ['region'] }),
          withTree()
        )
      );

      const beforeExpand = store.renderRows();
      const usHeader = beforeExpand.find(
        (row) => row.kind === 'group' && row.groupKey?.value === 'US'
      );
      expect(usHeader).toBeDefined();
      // No contributor with an id in `expandedRows` — every member row stays hidden.
      expect(beforeExpand.some((row) => row.kind === 'row')).toBe(false);

      store.tree.expand(store.groupIds());

      const afterExpand = store.renderRows();
      expect(afterExpand.some((row) => row.kind === 'row')).toBe(true);
    });

    it('expand() with no ids on a collapse-only instance is a no-op: the discovery walk finds nothing, tree() stays empty, and changed is silent', () => {
      const store = inContext(() =>
        createTable(signal<Row[]>(makeRows()), { trackBy: 'id', columns: makeColumns() }, withTree())
      );

      const emitted: ExpansionChange[] = [];
      store.tree.changed.subscribe((change) => emitted.push(change));

      store.tree.expand();

      expect(store.tree().size).toBe(0);
      expect(emitted).toEqual([]);
    });
  });

  describe('state() (D5/E9)', () => {
    it('reads "none" on a fresh table with expandable rows', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withTree({ childrenAccessor })
        )
      );

      expect(store.tree.state()).toBe('none');
    });

    it('reads "some" when one of two expandable rows is open', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withTree({ childrenAccessor })
        )
      );

      store.tree.toggle('r1');

      expect(store.tree.state()).toBe('some');
    });

    it('reads "all" after expand() opens every expandable row', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withTree({ childrenAccessor })
        )
      );

      store.tree.expand();

      expect(store.tree.state()).toBe('all');
    });

    it('reads "none", not "all", on a flat table with nothing expandable — the empty denominator is spelled out in TreeSlice.state\'s own doc', () => {
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
        createTable(
          signal<FlatRow[]>(flatRows),
          { trackBy: 'id', columns },
          withTree({ childrenAccessor: (): FlatRow[] | undefined => undefined })
        )
      );

      expect(store.tree.state()).toBe('none');
    });

    it('a collapse-only instance reads "none" even with group ids open — group ids are not discoverable from an accessor, the documented limitation', () => {
      const store = inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeGroupingColumns() },
          withGrouping({ initial: ['region'] }),
          withTree()
        )
      );

      store.tree.expand(store.groupIds());

      expect(store.tree.state()).toBe('none');
    });

    it('recomputes when data changes — adding an expandable row to a fully-expanded table moves "all" to "some"', () => {
      const data = signal<Row[]>([
        { id: 'x1', name: 'X1', children: [{ id: 'x1-child', name: 'Child' }] },
      ]);
      const store = inContext(() =>
        createTable(data, { trackBy: 'id', columns: makeColumns() }, withTree({ childrenAccessor }))
      );

      store.tree.expand();
      expect(store.tree.state()).toBe('all');

      data.update((rows) => [
        ...rows,
        { id: 'x2', name: 'X2', children: [{ id: 'x2-child', name: 'Child 2' }] },
      ]);
      TestBed.tick();

      expect(store.tree.state()).toBe('some');
    });
  });

  describe('the ADR-0014 degrade', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      // Restored per case, or cardinality counts leak across cases and every assertion below
      // becomes meaningless.
      consoleErrorSpy.mockRestore();
    });

    it('a childrenAccessor that throws for every row still renders — hasChildren: false, no nested children — and reports exactly once across the evaluation', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withTree({
            childrenAccessor: (): Row[] | undefined => {
              throw new Error('boom');
            },
          })
        )
      );

      const renderRows = store.renderRows();

      expect(renderRows.map((row) => row.id)).toEqual(['r1', 'r2']);
      expect(renderRows.every((row) => row.hasChildren === false)).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('the dedupe flag is scoped to the evaluation, not the process: renderRows(), expand() and state() each report again — a module-level flag would leave this at 1', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withTree({
            childrenAccessor: (): Row[] | undefined => {
              throw new Error('boom');
            },
          })
        )
      );

      store.renderRows();
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

      store.tree.expand();
      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);

      store.tree.state();
      expect(consoleErrorSpy).toHaveBeenCalledTimes(3);
    });

    it('a throwing isExpandable degrades to false — no toggle renders — and reports once, with its own message', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withTree({
            childrenAccessor,
            isExpandable: (): boolean => {
              throw new Error('boom');
            },
          })
        )
      );

      const renderRows = store.renderRows();

      expect(renderRows.find((row) => row.id === 'r1')?.hasChildren).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('isExpandable');
    });

    it('a childrenAccessor and isExpandable that both throw report twice in one evaluation, once per callback — the per-callback dedupe flags, not a shared one', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withTree({
            childrenAccessor: (): Row[] | undefined => {
              throw new Error('children-boom');
            },
            isExpandable: (): boolean => {
              throw new Error('expandable-boom');
            },
          })
        )
      );

      store.renderRows();

      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    });

    it('the default isExpandable produces no second report — with only childrenAccessor supplied and throwing, the count stays at 1 per evaluation', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withTree({
            childrenAccessor: (): Row[] | undefined => {
              throw new Error('boom');
            },
          })
        )
      );

      store.renderRows();

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------------------
  // Type-level assertions. The vitest executor does NOT typecheck `expectTypeOf` — it is
  // inert at runtime. These are only enforced by `tsc -p libs/table/tsconfig.spec.json
  // --noEmit`, which is the verification step for this describe block.
  // -------------------------------------------------------------------------------------
  describe('types', () => {
    it('withTree() alone: composed members are recovered exactly, never widened to any', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withTree({ childrenAccessor })
        )
      );

      expectTypeOf<keyof typeof store>().toEqualTypeOf<keyof TableStore<Row> | keyof TreeMembers>();
      expectTypeOf(store).not.toBeAny();
      expectTypeOf(store.tree).toMatchTypeOf<TreeSlice>();
      expectTypeOf(store.tree()).toEqualTypeOf<ReadonlySet<RowId>>();
      expectTypeOf(store.tree.state()).toEqualTypeOf<'all' | 'some' | 'none'>();
    });

    it('a trailing withComputed() block reading s.tree adds a typed member — typed only because withTree() precedes it', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withTree(
            { childrenAccessor },
            withComputed((s) => ({ openTreeCount: computed(() => s.tree().size) }))
          )
        )
      );

      expectTypeOf(store.openTreeCount).toEqualTypeOf<Signal<number>>();

      expect(store.openTreeCount()).toBe(0);

      store.tree.toggle('r1');
      expect(store.openTreeCount()).toBe(1);
    });

    it('the derive-first form compiles: withTree(withComputed(...))', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withTree(withComputed((s) => ({ openTreeCount: computed(() => s.tree().size) })))
        )
      );

      expectTypeOf(store.openTreeCount).toEqualTypeOf<Signal<number>>();
      expect(store.openTreeCount()).toBe(0);
    });
  });
});
