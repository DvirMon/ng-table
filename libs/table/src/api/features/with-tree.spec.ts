import { computed, signal, type Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expectTypeOf, vi } from 'vitest';
import { removeRow } from '../../mutations/row-mutations';
import { getNgDevMode, setNgDevMode } from '../../ng-dev-mode.testing';
import {
  makeFlatRows,
  mockGroupingRows,
  mockGroupingTrackBy,
  noData,
  type FlatRow,
  type GroupingMockRow,
} from '../../table.mock';
import { stage } from '../../schema/stage-rules';
import { stageSchema } from '../../schema/stage-schema';
import { createColumns } from '../create-columns';
import { createTable } from '../create-table';
import { createTableFeature } from '../create-table-feature';
import type { ColumnDecl, ColumnSet, RenderRow, RowId, TableStore } from '../types';
import { selectAllIds } from './with-selection/utils';
import { withComputed } from './with-computed';
import { withGrouping, type GroupingMembers } from './with-grouping';
import { withSorting, type SortingMembers } from './with-sorting';
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

// Widened `TId` (plain `string`) — no `path.<id>` usage in this file.
function makeColumns(): ColumnSet<Row, readonly ColumnDecl<Row, string, unknown>[]> {
  return createColumns(noData<Row>(), (col) => [col('name')]);
}

// Columns for the flat-fixture (#167) seams below — same single `name` column, over `FlatRow`.
function makeFlatColumns(): ColumnSet<FlatRow, readonly ColumnDecl<FlatRow, string, unknown>[]> {
  return createColumns(noData<FlatRow>(), (col) => [col('name')]);
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

// Widened `TId` (plain `string`) — no `path.<id>` usage in this file; group header ids are
// built from runtime string literals, not from this set's declared id type.
function makeGroupingColumns(): ColumnSet<
  GroupingMockRow,
  readonly ColumnDecl<GroupingMockRow, string, unknown>[]
> {
  return createColumns(noData<GroupingMockRow>(), (col) => [
    col('region', { label: 'Region' }),
    col('category', { label: 'Category' }),
  ]);
}

/** Finds a `kind: 'group'` render row by id. Brought over from `with-grouping/feature.spec.ts`
 *  for the migrated collapse cases below (`composed with withGrouping()`). */
function findHeader(
  rows: readonly RenderRow<GroupingMockRow>[],
  id: string
): RenderRow<GroupingMockRow> | undefined {
  return rows.find((row) => row.kind === 'group' && row.id === id);
}

/** `[kind, depth, id-if-a-row]` per render row. Brought over from
 *  `with-grouping/feature.spec.ts` for the either-order pair below. */
function toShape<TRow extends { id: number }>(
  rows: readonly { kind: string; depth: number; data: TRow | null }[]
): [string, number, number | undefined][] {
  return rows.map((row) => [row.kind, row.depth, row.data?.id]);
}

// Header ids encode the level path (`group:>region:string:US>category:string:Electronics`) —
// brought over from `with-grouping/feature.spec.ts` alongside `makeGroupingColumns()`'s widened
// declared columns, which these ids are keyed against.
const US_HEADER_ID = 'group:>region:string:US';
const US_ELECTRONICS_HEADER_ID = 'group:>region:string:US>category:string:Electronics';
const EU_ELECTRONICS_HEADER_ID = 'group:>region:string:EU>category:string:Electronics';
const EU_HEADER_ID = 'group:>region:string:EU';
const US_FURNITURE_HEADER_ID = 'group:>region:string:US>category:string:Furniture';
const EU_FURNITURE_HEADER_ID = 'group:>region:string:EU>category:string:Furniture';

// A minimal feature that claims the 'tree' render stage — stands in for whatever a future
// panel feature will claim once #121 lands. Deliberately not `withExpansion()`: it claims
// 'tree' unconditionally today and stops in #121, which would make this file fail on an
// unrelated issue, and it would be asserting the panel's domain from the tree's own spec.
const claimsTreeStage = createTableFeature(() => ({
  renderStages: stageSchema('render', (s) => {
    stage(s.tree, { run: (nodes) => nodes });
  }),
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
    const columns = createColumns(noData<FlatRow>(), (col) => [
      col('name'),
    ]);

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
    const columns = createColumns(noData<CustomChildrenRow>(), (col) => [
      col('name'),
    ]);

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
    const columns = createColumns(noData<GroupableRow>(), (col) => [
      col('region', { label: 'region' }),
    ]);
    const groupableAccessor = (row: GroupableRow): GroupableRow[] | undefined => row.children;

    // Compile-time-legal order: withGrouping() must precede withTree() for the group stage to
    // have produced headers the tree stage then descends through. Render order is fixed
    // (RENDER_ANCHORS = ['group', 'tree']) regardless.
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

  // Step 2 (#167): withTree({ parentId }) nests flat rows via engine/tree-links.ts's
  // resolveTreeLinks(), instead of a nested childrenAccessor. Seams A-O, red-green order per
  // step-2-with-tree-parent-id.test-plan.md. `parentId` is type-only in this red phase —
  // withTree() does not yet nest anything from it, so every seam below is expected to fail.
  describe('flat data — parentId (#167)', () => {
    // Shared by the broken-link seams (G, H, I, J, K, L) and O — one row shape, `parentId`
    // read straight off the row unless a seam's own accessor overrides it to throw.
    interface LinkRow {
      id: string;
      name: string;
      parentId?: string | null;
    }
    function makeLinkColumns(): ColumnSet<LinkRow, readonly ColumnDecl<LinkRow, string, unknown>[]> {
      return createColumns(noData<LinkRow>(), (col) => [col('name')]);
    }

    it('A — a flat fixture with parentId renders the same tree the nested fixture renders — ids, depth, parentId, hasChildren, isExpanded — and reports nothing', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const store = inContext(() =>
          createTable(
            signal<FlatRow[]>(makeFlatRows()),
            { trackBy: 'id', columns: makeFlatColumns() },
            withTree({ parentId: (row) => row.parentId, initial: ['r1', 'c1'] })
          )
        );

        const renderRows = store.renderRows();
        expect(renderRows.map((row) => row.id)).toEqual(['r1', 'c1', 'g1', 'c2', 'r2']);
        expect(renderRows.map((row) => row.depth)).toEqual([0, 1, 2, 1, 0]);
        expect(renderRows.map((row) => row.parentId)).toEqual([
          undefined,
          'r1',
          'c1',
          'r1',
          undefined,
        ]);
        expect(renderRows.map((row) => row.hasChildren)).toEqual([
          true,
          true,
          false,
          false,
          false,
        ]);
        expect(renderRows.map((row) => row.isExpanded)).toEqual([
          true,
          true,
          undefined,
          undefined,
          undefined,
        ]);
        expect(consoleErrorSpy).not.toHaveBeenCalled();
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it('B — children are real rows — a child carries its data() sourceIndex, and totalRowCount and selectAllIds() count collapsed children', () => {
      const store = inContext(() =>
        createTable(
          signal<FlatRow[]>(makeFlatRows()),
          { trackBy: 'id', columns: makeFlatColumns() },
          withTree({ parentId: (row) => row.parentId })
        )
      );

      expect(store.renderRows().map((row) => row.id)).toEqual(['r1', 'r2']);
      expect(store.totalRowCount()).toBe(5);
      expect(selectAllIds(store).sort()).toEqual(['c1', 'c2', 'g1', 'r1', 'r2']);

      store.tree.toggle('r1');
      const renderRows = store.renderRows();
      const c1 = renderRows.find((row) => row.id === 'c1');
      const c2 = renderRows.find((row) => row.id === 'c2');
      expect(c1?.sourceIndex).toBe(2);
      expect(c2?.sourceIndex).toBe(4);
    });

    it('C — siblings at every level follow the pipeline sort order', () => {
      const store = inContext(() =>
        createTable(
          signal<FlatRow[]>(makeFlatRows()),
          { trackBy: 'id', columns: makeFlatColumns() },
          withTree({ parentId: (row) => row.parentId }),
          withSorting()
        )
      );

      store.tree.toggle('r1');
      store.tree.toggle('c1');
      store.setSorting([{ columnId: 'name', direction: 'desc' }]);
      TestBed.tick();

      expect(store.renderRows().map((row) => row.id)).toEqual(['r2', 'r1', 'c2', 'c1', 'g1']);
    });

    it('D — composed after withGrouping(), a group header passes through and a child nests under its parent inside the header', () => {
      interface RegionRow {
        id: string;
        region: string;
        parentId?: string | null;
      }
      const rows: RegionRow[] = [
        { id: 'p1', region: 'US', parentId: null },
        { id: 'c1', region: 'US', parentId: 'p1' },
        { id: 'p2', region: 'EU', parentId: null },
      ];
      const columns = createColumns(noData<RegionRow>(), (col) => [
        col('region', { label: 'region' }),
      ]);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const store = inContext(() =>
          createTable(
            signal<RegionRow[]>(rows),
            { trackBy: 'id', columns },
            withGrouping({ initial: ['region'] }),
            withTree({ parentId: (row) => row.parentId })
          )
        );

        const usHeader = store
          .renderRows()
          .find((row) => row.kind === 'group' && row.groupKey?.value === 'US');
        expect(usHeader).toBeDefined();

        store.tree.toggle(usHeader?.id ?? '');
        store.tree.toggle('p1');

        const renderRows = store.renderRows();
        const c1 = renderRows.find((row) => row.id === 'c1');
        const header = renderRows.find((row) => row.id === usHeader?.id);

        expect(c1?.depth).toBe(2);
        expect(c1?.parentId).toBe('p1');
        expect(header?.kind).toBe('group');
        expect(consoleErrorSpy).not.toHaveBeenCalled();
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it('E — isExpandable decides hasChildren — a lazy row shows a toggle before children exist, and an appended child row nests under it', () => {
      interface LazyRow {
        id: string;
        name: string;
        parentId?: string | null;
      }
      const data = signal<LazyRow[]>([
        { id: 'lazy', name: 'Lazy' },
        { id: 'leaf', name: 'Leaf' },
      ]);
      const columns = createColumns(noData<LazyRow>(), (col) => [col('name')]);
      const store = inContext(() =>
        createTable(
          data,
          { trackBy: 'id', columns },
          withTree({ parentId: (row) => row.parentId, isExpandable: (row) => row.id === 'lazy' })
        )
      );

      const before = store.renderRows();
      expect(before.map((row) => row.id)).toEqual(['lazy', 'leaf']);
      expect(before.find((row) => row.id === 'lazy')?.hasChildren).toBe(true);

      store.tree.toggle('lazy');
      expect(store.renderRows().map((row) => row.id)).toEqual(['lazy', 'leaf']);

      data.update((rows) => [...rows, { id: 'lazy-child', name: 'Lazy Child', parentId: 'lazy' }]);
      TestBed.tick();

      const after = store.renderRows();
      expect(after.map((row) => row.id)).toEqual(['lazy', 'lazy-child', 'leaf']);
      expect(after.find((row) => row.id === 'lazy-child')?.depth).toBe(1);
    });

    it('F — expand() with no ids opens every row with a child in flat data, leaves leaves closed, and state() reads "all"', () => {
      const store = inContext(() =>
        createTable(
          signal<FlatRow[]>(makeFlatRows()),
          { trackBy: 'id', columns: makeFlatColumns() },
          withTree({ parentId: (row) => row.parentId })
        )
      );

      expect(store.tree.state()).toBe('none');

      store.tree.expand();

      expect([...store.tree()].sort()).toEqual(['c1', 'r1']);
      expect(store.tree.state()).toBe('all');
    });

    describe('broken links (ADR-0014)', () => {
      let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

      beforeEach(() => {
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      });

      afterEach(() => {
        consoleErrorSpy.mockRestore();
      });

      it('G — a self-parent row renders at depth 0 with its subtree intact and reports once per evaluation', () => {
        const rows: LinkRow[] = [
          { id: 's1', name: 'S1', parentId: 's1' },
          { id: 's1c', name: 'S1 Child', parentId: 's1' },
          { id: 's2', name: 'S2', parentId: 's2' },
        ];
        const store = inContext(() =>
          createTable(
            signal<LinkRow[]>(rows),
            { trackBy: 'id', columns: makeLinkColumns() },
            withTree({ parentId: (row) => row.parentId })
          )
        );

        store.tree.toggle('s1');

        const renderRows = store.renderRows();
        const s1 = renderRows.find((row) => row.id === 's1');
        const s1c = renderRows.find((row) => row.id === 's1c');
        const s2 = renderRows.find((row) => row.id === 's2');

        expect(s1?.depth).toBe(0);
        expect(s1?.hasChildren).toBe(true);
        expect(s1c?.depth).toBe(1);
        expect(s2?.depth).toBe(0);
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      });

      it('H — a row whose parent is absent renders at depth 0 with its subtree intact and reports once per evaluation', () => {
        const rows: LinkRow[] = [
          { id: 'o1', name: 'O1', parentId: 'missing' },
          { id: 'o1c', name: 'O1 Child', parentId: 'o1' },
          { id: 'o2', name: 'O2', parentId: 'gone' },
        ];
        const store = inContext(() =>
          createTable(
            signal<LinkRow[]>(rows),
            { trackBy: 'id', columns: makeLinkColumns() },
            withTree({ parentId: (row) => row.parentId })
          )
        );

        store.tree.toggle('o1');

        const renderRows = store.renderRows();
        const o1 = renderRows.find((row) => row.id === 'o1');
        const o1c = renderRows.find((row) => row.id === 'o1c');
        const o2 = renderRows.find((row) => row.id === 'o2');

        expect(o1?.depth).toBe(0);
        expect(o1c?.depth).toBe(1);
        expect(o2?.depth).toBe(0);
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      });

      it('I — a cycle renders its first member in input order at depth 0 with the rest nested beneath, and reports once', () => {
        const rows: LinkRow[] = [
          { id: 'k3', name: 'K3', parentId: 'k2' },
          { id: 'k1', name: 'K1', parentId: 'k2' },
          { id: 'k2', name: 'K2', parentId: 'k1' },
        ];
        const store = inContext(() =>
          createTable(
            signal<LinkRow[]>(rows),
            { trackBy: 'id', columns: makeLinkColumns() },
            withTree({ parentId: (row) => row.parentId })
          )
        );

        store.tree.expand();

        const renderRows = store.renderRows();
        expect(renderRows.map((row) => row.id)).toEqual(['k1', 'k2', 'k3']);
        expect(renderRows.map((row) => row.depth)).toEqual([0, 1, 2]);
        expect(renderRows.find((row) => row.id === 'k2')?.parentId).toBe('k1');
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      });

      it('J — a parentId that throws for a row degrades that row to depth 0, keeps its children beneath it, and reports once naming parentId', () => {
        const rows: LinkRow[] = [
          { id: 't1', name: 'T1' },
          { id: 't1c', name: 'T1 Child', parentId: 't1' },
          { id: 't2', name: 'T2' },
        ];
        const store = inContext(() =>
          createTable(
            signal<LinkRow[]>(rows),
            { trackBy: 'id', columns: makeLinkColumns() },
            withTree({
              parentId: (row): string | null | undefined => {
                if (row.id === 't1' || row.id === 't2') {
                  throw new Error('boom');
                }
                return row.parentId;
              },
            })
          )
        );

        store.tree.toggle('t1');

        const renderRows = store.renderRows();
        const t1 = renderRows.find((row) => row.id === 't1');
        const t1c = renderRows.find((row) => row.id === 't1c');
        const t2 = renderRows.find((row) => row.id === 't2');

        expect(t1?.depth).toBe(0);
        expect(t1c?.depth).toBe(1);
        expect(t2?.depth).toBe(0);
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy.mock.calls[0][0]).toContain('parentId');
      });

      it('K — two broken kinds in one evaluation report once each, and a second evaluation reports again', () => {
        const rows: LinkRow[] = [
          { id: 's1', name: 'S1', parentId: 's1' },
          { id: 'o1', name: 'O1', parentId: 'missing' },
        ];
        const data = signal<LinkRow[]>(rows);
        const store = inContext(() =>
          createTable(
            data,
            { trackBy: 'id', columns: makeLinkColumns() },
            withTree({ parentId: (row) => row.parentId })
          )
        );

        store.renderRows();
        expect(consoleErrorSpy).toHaveBeenCalledTimes(2);

        data.set(rows.map((row) => ({ ...row })));
        TestBed.tick();
        store.renderRows();

        expect(consoleErrorSpy).toHaveBeenCalledTimes(4);
      });

      it('L — broken-link reports fire with ngDevMode false — production too', () => {
        const previous = getNgDevMode();
        setNgDevMode(false);
        try {
          const rows: LinkRow[] = [
            { id: 'o1', name: 'O1', parentId: 'missing' },
            { id: 'o1c', name: 'O1 Child', parentId: 'o1' },
            { id: 'o2', name: 'O2', parentId: 'gone' },
          ];
          const store = inContext(() =>
            createTable(
              signal<LinkRow[]>(rows),
              { trackBy: 'id', columns: makeLinkColumns() },
              withTree({ parentId: (row) => row.parentId })
            )
          );

          store.renderRows();

          expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        } finally {
          setNgDevMode(previous);
        }
      });
    });

    it('M — parentId contributes a total parentLink — a pipeline stage reads the parent id, and null for a null, undefined or throwing parentId', () => {
      interface LinkTestRow {
        id: string;
        name: string;
        parentId?: string | null;
      }
      const rows: LinkTestRow[] = [
        { id: 'r1', name: 'R1' },
        { id: 'c1', name: 'C1', parentId: 'r1' },
        { id: 'r2', name: 'R2' },
        { id: 't1', name: 'T1' },
      ];
      const recorded: [string, RowId | null | undefined][] = [];
      // `_store` is typed, not read: it pins `In` (and so `RowOf<In>`) to `LinkTestRow` for
      // `createTableFeature`'s inference — an untyped `() => ({...})` factory would otherwise
      // infer `RowOf<In>` as `unknown` and reject the `LinkTestRow`-typed stage below. `Pick`
      // to `rows` only, so this doesn't also pin the store's column-id union.
      const recordsParentOf = createTableFeature((_store: Pick<TableStore<LinkTestRow>, 'rows'>) => ({
        stages: stageSchema<LinkTestRow>('pipeline', (s) =>
          stage(s.filter, {
            run: (rowsIn, ctx) => {
              rowsIn.forEach((row) => {
                recorded.push([row.id, ctx.parentOf?.(row)]);
              });
              return rowsIn;
            },
          })
        ),
      }));
      const columns = createColumns(noData<LinkTestRow>(), (col) => [col('name')]);
      const parentId = (row: LinkTestRow): string | null | undefined => {
        if (row.id === 't1') {
          throw new Error('boom');
        }
        if (row.id === 'r1') {
          return null;
        }
        if (row.id === 'r2') {
          return undefined;
        }
        return row.parentId;
      };

      const store = inContext(() =>
        createTable(
          signal<LinkTestRow[]>(rows),
          { trackBy: 'id', columns },
          recordsParentOf,
          withTree({ parentId })
        )
      );

      expect(() => store.rows()).not.toThrow();
      expect(recorded).toContainEqual(['c1', 'r1']);
      expect(recorded).toContainEqual(['r1', null]);
      expect(recorded).toContainEqual(['r2', null]);
      expect(recorded).toContainEqual(['t1', null]);
    });

    it('N — withTree({ parentId }) claims the tree render stage and the parent link; withTree() without it claims neither', () => {
      const contributesParentLink = createTableFeature(() => ({ parentLink: () => null }));

      expect(() =>
        inContext(() =>
          createTable(
            signal<Row[]>(makeRows()),
            { trackBy: 'id', columns: makeColumns() },
            claimsTreeStage,
            withTree({ parentId: () => null })
          )
        )
      ).toThrow(/both provide the "tree" render stage/);

      expect(() =>
        inContext(() =>
          createTable(
            signal<Row[]>(makeRows()),
            { trackBy: 'id', columns: makeColumns() },
            contributesParentLink,
            withTree({ parentId: () => null })
          )
        )
      ).toThrow(/both provide the parent link/);

      expect(() =>
        inContext(() =>
          createTable(
            signal<Row[]>(makeRows()),
            { trackBy: 'id', columns: makeColumns() },
            contributesParentLink,
            withTree()
          )
        )
      ).not.toThrow();
    });

    it('O — expand() and state() treat broken links as roots and never report — only the tree stage reports', () => {
      const rows: LinkRow[] = [
        { id: 'o1', name: 'O1', parentId: 'missing' },
        { id: 'o1c', name: 'O1 Child', parentId: 'o1' },
        { id: 'o2', name: 'O2', parentId: 'gone' },
      ];
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const store = inContext(() =>
          createTable(
            signal<LinkRow[]>(rows),
            { trackBy: 'id', columns: makeLinkColumns() },
            withTree({
              parentId: (row): string | null | undefined => {
                if (row.id === 'o2') {
                  throw new Error('boom');
                }
                return row.parentId;
              },
            })
          )
        );

        expect(() => store.tree.state()).not.toThrow();
        expect(() => store.tree.expand()).not.toThrow();

        expect(store.tree().has('o1')).toBe(true);
        expect(consoleErrorSpy).not.toHaveBeenCalled();
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });
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

  // Migrated from `with-grouping/feature.spec.ts` — descendant visibility is owned by whatever
  // feature contributes the expanded set, never by the clustering itself
  // (.claude/rules/spec-files-assert-own-domain-only.md). Every fixture here is collapse-only,
  // no accessor: `mockGroupingRows` has no nested rows, so a `childrenAccessor` would claim the
  // `'tree'` render stage for no reason. Bare `withTree()` contributes the open set without
  // claiming the stage — `withGrouping()` runs first in render order, and the flatten walk stops
  // descending at any id missing from the contributed set.
  describe('composed with withGrouping()', () => {
    it('collapse-independent: collapsing a group does not remove its id', () => {
      const store = inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeGroupingColumns() },
          withGrouping({ initial: ['region', 'category'] }),
          withTree()
        )
      );

      // withTree() collapse-only contributes an empty open set — every header still renders
      // (group headers come from the cluster tree, not the open set), so groupIds() must already
      // see every header before anything is toggled, and must keep seeing them after a toggle
      // plus a full collapse.
      expect(store.groupIds().sort()).toEqual(
        [
          US_HEADER_ID,
          US_ELECTRONICS_HEADER_ID,
          US_FURNITURE_HEADER_ID,
          EU_HEADER_ID,
          EU_ELECTRONICS_HEADER_ID,
          EU_FURNITURE_HEADER_ID,
        ].sort()
      );

      store.tree.toggle(US_HEADER_ID);
      store.tree.collapse();

      expect(store.groupIds().sort()).toEqual(
        [
          US_HEADER_ID,
          US_ELECTRONICS_HEADER_ID,
          US_FURNITURE_HEADER_ID,
          EU_HEADER_ID,
          EU_ELECTRONICS_HEADER_ID,
          EU_FURNITURE_HEADER_ID,
        ].sort()
      );
    });

    it('nothing toggled: every group renders collapsed — only the two depth-0 headers render, no category headers, no leaves', () => {
      const store = inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeGroupingColumns() },
          withGrouping({ initial: ['region', 'category'] }),
          withTree()
        )
      );

      const rows = store.renderRows();
      expect(rows).toHaveLength(2);
      expect(rows.every((row) => row.kind === 'group' && row.depth === 0)).toBe(true);
    });

    it("tree.toggle(headerId) reveals that header's descendants; the sibling header stays collapsed", () => {
      const store = inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeGroupingColumns() },
          withGrouping({ initial: ['region'] }),
          withTree()
        )
      );

      store.tree.toggle(US_HEADER_ID);

      const rows = store.renderRows();
      const usLeafIds = rows
        .filter((row) => row.kind === 'row' && (row.data as GroupingMockRow).region === 'US')
        .map((row) => (row.data as GroupingMockRow).id);
      expect(usLeafIds.sort()).toEqual([1, 2, 3]);
      // EU was never toggled — still just its header, no leaves.
      expect(
        rows.some((row) => row.kind === 'row' && (row.data as GroupingMockRow).region === 'EU')
      ).toBe(false);
    });

    it("two-level grouping, expand outer only: the outer header's own child headers appear, their leaves stay hidden until individually toggled, and the untouched sibling shows not even its child headers", () => {
      const store = inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeGroupingColumns() },
          withGrouping({ initial: ['region', 'category'] }),
          withTree()
        )
      );

      store.tree.toggle(US_HEADER_ID);

      const rows = store.renderRows();
      expect(findHeader(rows, US_ELECTRONICS_HEADER_ID)).toBeDefined();
      expect(findHeader(rows, US_FURNITURE_HEADER_ID)).toBeDefined();
      // Neither inner category header was itself toggled — no leaves anywhere yet.
      expect(rows.filter((row) => row.kind === 'row')).toHaveLength(0);
      // EU was never toggled — not even its own category headers appear.
      expect(findHeader(rows, EU_HEADER_ID)).toBeDefined();
      expect(
        rows.some((row) => row.kind === 'group' && row.id.toString().startsWith(EU_HEADER_ID + '>'))
      ).toBe(false);
    });

    it('argument order does not affect collapse behaviour: grouping-first and tree-first produce identical shapes after the same toggle', () => {
      const groupingFirst = inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeGroupingColumns() },
          withGrouping({ initial: ['region'] }),
          withTree()
        )
      );
      groupingFirst.tree.toggle(US_HEADER_ID);
      const groupingFirstShape = groupingFirst
        .renderRows()
        .map((row) => [String(row.id), row.depth]);

      const treeFirst = inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeGroupingColumns() },
          withTree(),
          withGrouping({ initial: ['region'] })
        )
      );
      treeFirst.tree.toggle(US_HEADER_ID);
      const treeFirstShape = treeFirst.renderRows().map((row) => [String(row.id), row.depth]);

      expect(treeFirstShape).toEqual(groupingFirstShape);
    });

    it('a collapsed group nested inside a collapsed group stays hidden when only the outer one opens (ADR-0017 decision 8)', () => {
      const store = inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeGroupingColumns() },
          withGrouping({ initial: ['region', 'category'] }),
          withTree()
        )
      );

      const outerHeader = store
        .renderRows()
        .find((row) => row.kind === 'group' && row.depth === 0 && row.groupKey?.value === 'US')!;

      store.tree.toggle(outerHeader.id);

      const rows = store.renderRows();
      const innerHeaders = rows.filter(
        (row) => row.kind === 'group' && row.parentId === outerHeader.id
      );

      // The outer header's own children (the category headers) are revealed once it opens...
      expect(innerHeaders).toHaveLength(2); // Electronics, Furniture

      // ...but neither inner header was itself toggled, so anything nested beneath either of
      // them stays hidden — the transitive hidden-accumulator case (ADR-0017 decision 8).
      const innerHeaderIds = innerHeaders.map((row) => row.id);
      const revealedUnderInner = rows.filter(
        (row) => row.parentId !== undefined && innerHeaderIds.includes(row.parentId)
      );
      expect(revealedUnderInner).toHaveLength(0);
    });

    it('tree composed first: nothing toggled shows two depth-0 headers; toggling US reveals its leaves, EU stays collapsed', () => {
      const store = inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeGroupingColumns() },
          withTree(),
          withGrouping({ initial: ['region'] })
        )
      );

      const collapsed = store.renderRows();
      expect(collapsed).toHaveLength(2);
      expect(collapsed.every((row) => row.kind === 'group' && row.depth === 0)).toBe(true);

      store.tree.toggle(US_HEADER_ID);

      expect(toShape(store.renderRows())).toEqual([
        ['group', 0, undefined], // US
        ['row', 1, 1],
        ['row', 1, 2],
        ['row', 1, 3],
        ['group', 0, undefined], // EU, never toggled
      ]);
    });

    it('grouping composed first: identical shape to tree-first, both before and after toggling US', () => {
      const store = inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeGroupingColumns() },
          withGrouping({ initial: ['region'] }),
          withTree()
        )
      );

      const collapsed = store.renderRows();
      expect(collapsed).toHaveLength(2);
      expect(collapsed.every((row) => row.kind === 'group' && row.depth === 0)).toBe(true);

      store.tree.toggle(US_HEADER_ID);

      expect(toShape(store.renderRows())).toEqual([
        ['group', 0, undefined], // US
        ['row', 1, 1],
        ['row', 1, 2],
        ['row', 1, 3],
        ['group', 0, undefined], // EU, never toggled
      ]);
    });

    describe('collapse state across a sort', () => {
      // Group ids are built from the cluster's value, not its position, read here through the
      // composed store — the only place a sort's effect on collapse state is observable.
      // No return-type annotation: the pre-#125 `TableStore<GroupingMockRow, 'region' |
      // 'category'>` spelling named the id union directly, which the store's second
      // parameter no longer accepts (it's the value map since #125) — inferring off the
      // `createTable()` call below carries the same literal ids with no re-spelling needed.
      function setup() {
        return inContext(() =>
          createTable(
            signal<GroupingMockRow[]>([...mockGroupingRows]),
            { trackBy: mockGroupingTrackBy, columns: makeGroupingColumns() },
            withGrouping({ initial: ['region'] }),
            withTree(),
            withSorting()
          )
        );
      }

      it('a sort change leaves the open set untouched', () => {
        const store = setup();

        store.tree.toggle(US_HEADER_ID);
        const openBefore = [...store.tree()].sort();

        store.setSorting([{ columnId: 'amount', direction: 'desc' }]);
        TestBed.tick();

        expect([...store.tree()].sort()).toEqual(openBefore);
      });

      it('an expanded group is still expanded, and a collapsed sibling still collapsed, after the sort', () => {
        const store = setup();

        store.tree.toggle(US_HEADER_ID);
        store.setSorting([{ columnId: 'amount', direction: 'desc' }]);
        TestBed.tick();

        const rows = store.renderRows();
        expect(findHeader(rows, US_HEADER_ID)).toBeDefined();
        // The opened group's own leaves are on screen; no other group's are.
        const visibleIds = rows
          .filter((row) => row.kind === 'row')
          .map((row) => row.id)
          .sort();
        expect(visibleIds).toEqual([1, 2, 3]);
      });
    });

    describe('collapse state across a row replacement', () => {
      // A refetch replaces every row with a freshly-constructed object carrying the same id.
      // Same ids and new object identities must still yield the same group ids, so the open set
      // keeps matching.
      it('replacing every row object with an equal-id copy leaves the open set untouched and the toggled header still present', () => {
        const data = signal<GroupingMockRow[]>([...mockGroupingRows]);
        const store = inContext(() =>
          createTable(
            data,
            { trackBy: mockGroupingTrackBy, columns: makeGroupingColumns() },
            withGrouping({ initial: ['region'] }),
            withTree()
          )
        );

        store.tree.toggle(US_HEADER_ID);
        const openBefore = [...store.tree()].sort();

        data.set(mockGroupingRows.map((row) => ({ ...row })));
        TestBed.tick();

        expect([...store.tree()].sort()).toEqual(openBefore);
        expect(findHeader(store.renderRows(), US_HEADER_ID)).toBeDefined();
      });
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
      const columns = createColumns(noData<FlatRow>(), (col) => [
        col('name'),
      ]);

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

  // Step 3 (#167): `table.tree.parentOf` / `descendantsOf`. Seams A-J, red-green order per
  // step-3-tree-reads.test-plan.md (seam K lives in row-mutations.spec.ts). Both reads throw
  // `not implemented` in this red phase — every seam below is expected to fail.
  describe('tree reads (parentOf / descendantsOf)', () => {
    function setupFlatTree(): TableStore<FlatRow> & TreeMembers {
      return inContext(() =>
        createTable(
          signal<FlatRow[]>(makeFlatRows()),
          { trackBy: 'id', columns: makeFlatColumns() },
          withTree({ parentId: (row) => row.parentId })
        )
      );
    }

    it('parentOf(id) returns the parent id of a child and of a grandchild', () => {
      const store = setupFlatTree();

      expect(store.tree.parentOf('c1')).toBe('r1');
      expect(store.tree.parentOf('g1')).toBe('c1');
    });

    it('parentOf(id) of a root row returns null', () => {
      const store = setupFlatTree();

      expect(store.tree.parentOf('r1')).toBeNull();
      expect(store.tree.parentOf('r2')).toBeNull();
    });

    it('parentOf(id) of an id not in data() returns null', () => {
      const store = setupFlatTree();

      expect(() => store.tree.parentOf('nope')).not.toThrow();
      expect(store.tree.parentOf('nope')).toBeNull();
    });

    it('descendantsOf(id) returns every descendant depth-first in data() order and excludes the row itself', () => {
      const store = setupFlatTree();

      expect(store.tree.descendantsOf('r1')).toEqual(['c1', 'g1', 'c2']);
      expect(store.tree.descendantsOf('c1')).toEqual(['g1']);
    });

    it('descendantsOf(id) of an id not in data() returns an empty array', () => {
      const store = setupFlatTree();

      expect(() => store.tree.descendantsOf('nope')).not.toThrow();
      expect(store.tree.descendantsOf('nope')).toEqual([]);
    });

    it('parentOf and descendantsOf read data(), so a row the pipeline dropped still counts', () => {
      // Deliberately a bare pipeline-stage claimant, not `withFiltering()` — that's another
      // domain (.claude/rules/spec-files-assert-own-domain-only.md).
      const dropsC1 = createTableFeature((_store: Pick<TableStore<FlatRow>, 'rows'>) => ({
        stages: stageSchema<FlatRow>('pipeline', (s) =>
          stage(s.filter, {
            run: (rowsIn) => rowsIn.filter((row) => row.id !== 'c1'),
          })
        ),
      }));

      const store = inContext(() =>
        createTable(
          signal<FlatRow[]>(makeFlatRows()),
          { trackBy: 'id', columns: makeFlatColumns() },
          dropsC1,
          withTree({ parentId: (row) => row.parentId })
        )
      );

      expect(store.rows().map((row) => row.id)).not.toContain('c1');
      expect(store.tree.parentOf('g1')).toBe('c1');
      expect(store.tree.descendantsOf('r1')).toEqual(['c1', 'g1', 'c2']);
    });

    it('a parentId cycle never loops: the first row of the cycle is a root', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        interface CycleRow {
          id: string;
          name: string;
          parentId?: string | null;
        }
        const rows: CycleRow[] = [
          { id: 'a', name: 'A', parentId: 'b' },
          { id: 'b', name: 'B', parentId: 'a' },
        ];
        const columns = createColumns(noData<CycleRow>(), (col) => [col('name')]);
        const store = inContext(() =>
          createTable(
            signal<CycleRow[]>(rows),
            { trackBy: 'id', columns },
            withTree({ parentId: (row) => row.parentId })
          )
        );

        expect(store.tree.parentOf('a')).toBeNull();
        expect(store.tree.parentOf('b')).toBe('a');
        expect(store.tree.descendantsOf('a')).toEqual(['b']);
        expect(store.tree.descendantsOf('b')).toEqual([]);
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it('without parentId, parentOf returns null and descendantsOf returns [] even when rows carry a parent field', () => {
      const store = inContext(() =>
        createTable(
          signal<FlatRow[]>(makeFlatRows()),
          { trackBy: 'id', columns: makeFlatColumns() },
          withTree()
        )
      );

      expect(store.tree.parentOf('c1')).toBeNull();
      expect(store.tree.descendantsOf('r1')).toEqual([]);
    });

    it('removeRow([id, ...tree.descendantsOf(id)]) cascades the delete in one write', () => {
      const data = signal<FlatRow[]>(makeFlatRows());
      const store = inContext(() =>
        createTable(
          data,
          { trackBy: 'id', columns: makeFlatColumns() },
          withTree({ parentId: (row) => row.parentId })
        )
      );

      store.value.update(removeRow(['r1', ...store.tree.descendantsOf('r1')]));
      TestBed.tick();

      expect(store.value().map((r) => r.id)).toEqual(['r2']);
    });

    it('removing only a parent leaves its children in data at the top level, and parentOf reports them as roots', () => {
      const data = signal<FlatRow[]>(makeFlatRows());
      const store = inContext(() =>
        createTable(
          data,
          { trackBy: 'id', columns: makeFlatColumns() },
          withTree({ parentId: (row) => row.parentId })
        )
      );

      store.value.update(removeRow('r1'));
      TestBed.tick();

      const remainingIds = store.value().map((r) => r.id);
      expect(remainingIds).toContain('c1');
      expect(remainingIds).toContain('c2');
      expect(remainingIds).toContain('g1');
      expect(store.tree.parentOf('c1')).toBeNull();
      expect(store.tree.parentOf('g1')).toBe('c1');

      const renderRows = store.renderRows();
      const c1 = renderRows.find((row) => row.id === 'c1');
      const c2 = renderRows.find((row) => row.id === 'c2');
      expect(c1?.depth).toBe(0);
      expect(c2?.depth).toBe(0);
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

    // Re-expressed from `with-grouping/feature.spec.ts`'s D25 case against `tree` instead of
    // `expandedRows` (§4 of the migration) — the runtime store would have the member either way
    // (any deferred read off the shared object sees it); the restriction is type-level only.
    // `withGrouping()` itself performs no such read at all since #99 —
    // `engine/flatten.ts`'s `flattenVisible` walk governs collapse/expand visibility regardless
    // of argument order (ADR-0017, ADR-0023). The `withExpansion()` counterpart of this case is
    // deliberately not written here — it belongs to #121, which narrows `withExpansion()`.
    it('a trailing derive on grouping sees s.tree only when withTree() is composed first (D25 — types stricter than runtime)', () => {
      // Tree first: grouping's trailing block sees `tree` off the accumulated `In`.
      inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withTree({ childrenAccessor }),
          withGrouping(
            {},
            withComputed((s) => {
              expectTypeOf(s.tree).toEqualTypeOf<TreeSlice>();
              return {};
            })
          )
        )
      );

      // Grouping first: the same read is a compile error — this slot's `In` doesn't carry
      // `TreeMembers` yet.
      inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withGrouping(
            {},
            withComputed((s) => {
              // @ts-expect-error — tree is declared by withTree(), composed after grouping in
              // this order (D25).
              expectTypeOf(s.tree).toEqualTypeOf<TreeSlice>();
              return {};
            })
          ),
          withTree({ childrenAccessor })
        )
      );
    });

    // #167 — `parentId`'s row parameter is inferred as `RowOf<In>`, never widened to `any`.
    it('parentId infers its row parameter as RowOf<In>, never any', () => {
      inContext(() =>
        createTable(
          signal<FlatRow[]>(makeFlatRows()),
          { trackBy: 'id', columns: makeFlatColumns() },
          withTree({
            parentId: (row) => {
              expectTypeOf(row).toEqualTypeOf<FlatRow>();
              return row.parentId;
            },
          })
        )
      );
    });

    // #167 — the return type is pinned to `RowId | null | undefined`; a mismatched return is a
    // compile error, not silently widened.
    it('parentId return type is pinned to RowId | null | undefined', () => {
      inContext(() =>
        createTable(
          signal<FlatRow[]>(makeFlatRows()),
          { trackBy: 'id', columns: makeFlatColumns() },
          // @ts-expect-error — parentId must return RowId | null | undefined, not {}.
          withTree({ parentId: () => ({}) })
        )
      );
    });
  });
});
