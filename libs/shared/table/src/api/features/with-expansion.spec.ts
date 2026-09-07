import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createTable } from '../create-table';
import { withExpansion } from './with-expansion';
import type { AnyTableFeature, ColumnDef, RowId, TableStoreConfig } from '../types';

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

// Mirrors `with-sorting.spec.ts`: rows are seeded at construction via the `data` signal —
// pass `rows` for tests that need them, omit for state-only tests.
function makeStore<const F extends readonly AnyTableFeature[]>(
  cfg: () => TableStoreConfig<Row, F>,
  rows: Row[] = []
) {
  return TestBed.runInInjectionContext(() => createTable(signal<Row[]>(rows), cfg));
}

describe('withExpansion', () => {
  it('toggleExpanded(id) flips a row from collapsed to expanded and back', () => {
    const store = makeStore(() => ({
      trackBy: 'id',
      columns: makeColumns(),
      features: [withExpansion<Row>()],
    }), makeRows());

    expect(store.expandedRows().has('r1')).toBe(false);

    store.toggleExpanded('r1');
    expect(store.expandedRows().has('r1')).toBe(true);

    store.toggleExpanded('r1');
    expect(store.expandedRows().has('r1')).toBe(false);
  });

  it('expanding row A does not collapse row B (multi-expand)', () => {
    const store = makeStore(() => ({
      trackBy: 'id',
      columns: makeColumns(),
      features: [withExpansion<Row>()],
    }), makeRows());

    store.toggleExpanded('r1');
    store.toggleExpanded('c1');

    expect(store.expandedRows().has('r1')).toBe(true);
    expect(store.expandedRows().has('c1')).toBe(true);
  });

  it('expandAll() expands every row that has children, leaves leaves alone', () => {
    const store = makeStore(() => ({
      trackBy: 'id',
      columns: makeColumns(),
      features: [withExpansion<Row>()],
    }), makeRows());

    store.expandAll();

    const expanded = store.expandedRows();
    expect(expanded.has('r1')).toBe(true);
    expect(expanded.has('c1')).toBe(true);
    expect(expanded.has('c2')).toBe(false);
    expect(expanded.has('r2')).toBe(false);
    expect(expanded.has('g1')).toBe(false);
  });

  it('collapseAll() clears all expansion regardless of prior state', () => {
    const store = makeStore(() => ({
      trackBy: 'id',
      columns: makeColumns(),
      features: [withExpansion<Row>()],
    }), makeRows());

    store.expandAll();
    expect(store.expandedRows().size).toBeGreaterThan(0);

    store.collapseAll();
    expect(store.expandedRows().size).toBe(0);
  });

  it('rowExpanded emits the toggled RowId on both expand and collapse', () => {
    const store = makeStore(() => ({
      trackBy: 'id',
      columns: makeColumns(),
      features: [withExpansion<Row>()],
    }), makeRows());

    const emitted: RowId[] = [];
    store.rowExpanded.subscribe((id) => emitted.push(id));

    store.toggleExpanded('r1'); // expand
    store.toggleExpanded('r1'); // collapse

    expect(emitted).toEqual(['r1', 'r1']);
  });

  it('expandAll() emits rowExpanded once per newly expanded id, and nothing on a repeat', () => {
    const store = makeStore(() => ({
      trackBy: 'id',
      columns: makeColumns(),
      features: [withExpansion<Row>()],
    }), makeRows());

    const emitted: RowId[] = [];
    store.rowExpanded.subscribe((id) => emitted.push(id));

    store.expandAll();
    expect([...emitted].sort()).toEqual([...store.expandedRows()].sort());

    emitted.length = 0;
    store.expandAll();
    expect(emitted).toEqual([]);
  });

  it('rowExpanded completes when the table is destroyed, so subscribers do not leak', () => {
    const store = makeStore(() => ({
      trackBy: 'id',
      columns: makeColumns(),
      features: [withExpansion<Row>()],
    }), makeRows());

    let completed = false;
    store.rowExpanded.subscribe({ complete: () => (completed = true) });
    expect(completed).toBe(false);

    TestBed.resetTestingModule();

    expect(completed).toBe(true);
  });

  it('emitEvent: false suppresses the emission on every write verb, state still changes', () => {
    const store = makeStore(() => ({
      trackBy: 'id',
      columns: makeColumns(),
      features: [withExpansion<Row>()],
    }), makeRows());

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
    const store = makeStore(() => ({
      trackBy: 'id',
      columns: makeColumns(),
      features: [withExpansion<Row>()],
    }), makeRows());

    store.expandAll();
    const expandedBefore = [...store.expandedRows()];

    const emitted: RowId[] = [];
    store.rowExpanded.subscribe((id) => emitted.push(id));

    store.collapseAll();

    expect([...emitted].sort()).toEqual([...expandedBefore].sort());
    expect(store.expandedRows().size).toBe(0);
  });

  it("renderRows() excludes a row's children when collapsed (default state)", () => {
    const store = makeStore(() => ({
      trackBy: 'id',
      columns: makeColumns(),
      features: [withExpansion<Row>()],
    }), makeRows());

    const ids = store.renderRows().map((row) => row.id);
    expect(ids).toEqual(['r1', 'r2']);
  });

  it("renderRows() includes a row's children, at depth + 1, only once that row is expanded", () => {
    const store = makeStore(() => ({
      trackBy: 'id',
      columns: makeColumns(),
      features: [withExpansion<Row>()],
    }), makeRows());

    store.toggleExpanded('r1');

    const renderRows = store.renderRows();
    const childRow = renderRows.find((row) => row.id === 'c1');
    const otherChildRow = renderRows.find((row) => row.id === 'c2');

    expect(renderRows.map((row) => row.id)).toEqual(['r1', 'c1', 'c2', 'r2']);
    expect(childRow?.depth).toBe(1);
    expect(otherChildRow?.depth).toBe(1);
  });

  it('nested/grandchild case: a depth-2 child only appears once both its ancestors are expanded independently', () => {
    const store = makeStore(() => ({
      trackBy: 'id',
      columns: makeColumns(),
      features: [withExpansion<Row>()],
    }), makeRows());

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
    const store = makeStore(() => ({
      trackBy: 'id',
      columns: makeColumns(),
      features: [withExpansion<Row>()],
    }), makeRows());

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

    const store = TestBed.runInInjectionContext(() =>
      createTable(signal<CustomChildrenRow[]>(rows), () => ({
        trackBy: 'id',
        columns,
        features: [
          withExpansion<CustomChildrenRow>({
            childrenAccessor: (row) => row.nested,
          }),
        ],
      }))
    );

    expect(store.renderRows().map((row) => row.id)).toEqual(['p1']);
    expect(store.renderRows()[0]?.hasChildren).toBe(true);

    store.toggleExpanded('p1');

    const renderRows = store.renderRows();
    expect(renderRows.map((row) => row.id)).toEqual(['p1', 'n1']);
    expect(renderRows.find((row) => row.id === 'n1')?.depth).toBe(1);
  });

  it('removing an expanded row from data clears it from expandedRows but not everExpanded (ADR-0006)', () => {
    const data = signal(makeRows());
    const store = TestBed.runInInjectionContext(() =>
      createTable(data, () => ({
        trackBy: 'id',
        columns: makeColumns(),
        features: [withExpansion<Row>()],
      }))
    );

    store.toggleExpanded('r1');
    expect(store.expandedRows().has('r1')).toBe(true);
    expect(store.everExpanded().has('r1')).toBe(true);

    data.update((rows) => rows.filter((row) => row.id !== 'r1'));
    TestBed.tick();

    expect(store.expandedRows().has('r1')).toBe(false);
    expect(store.everExpanded().has('r1')).toBe(true);
  });

  it('composes with zero other features present — createTable({ features: [withExpansion()] }) alone works end-to-end', () => {
    const store = makeStore(() => ({
      trackBy: 'id',
      columns: makeColumns(),
      features: [withExpansion<Row>()],
    }), makeRows());

    expect(store.rows().map((row) => row.id)).toEqual(['r1', 'r2']);

    store.toggleExpanded('r1');
    expect(store.renderRows().map((row) => row.id)).toEqual(['r1', 'c1', 'c2', 'r2']);
  });
});
