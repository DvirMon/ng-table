import { signal } from '@angular/core';
import { createColumns } from '../api/create-columns';
import { noData } from '../table.mock';
import { createTableCore } from './core';
import type { RenderRow, RowId } from '../api/types';
import type { RenderNodeTransform } from './render-stages';

interface Row {
  id: string;
  name: string;
}

const columns = [...createColumns(noData<Row>(), (col) => [col('name')]).columns];

function makeRows(): Row[] {
  return [
    { id: 'r1', name: 'Ann' },
    { id: 'r2', name: 'Bea' },
    { id: 'r3', name: 'Cid' },
  ];
}

describe('createTableCore — sourceIndex', () => {
  it('stamps each render row with its position in data()', () => {
    const { renderRows } = createTableCore<Row>({
      columns,
      trackBy: 'id',
      data: signal(makeRows()),
    });

    expect(renderRows().map((row) => row.sourceIndex)).toEqual([0, 1, 2]);
  });

  it('resolves sourceIndex by trackBy id, not array position, once the pipeline reorders rows', () => {
    const { renderRows, stages } = createTableCore<Row>({
      columns,
      trackBy: 'id',
      data: signal(makeRows()),
    });
    stages.push({ name: 'sort', label: 'test', run: (rows) => [...rows].reverse() });

    expect(renderRows().map((row) => row.sourceIndex)).toEqual([2, 1, 0]);
  });

  it('leaves sourceIndex undefined for a synthesized row with no backing data() entry', () => {
    const { renderRows, renderStages } = createTableCore<Row>({
      columns,
      trackBy: 'id',
      data: signal(makeRows()),
    });
    const withGroupRow: RenderNodeTransform<Row> = (nodes) => [
      { id: 'group-1', kind: 'group', data: null, children: nodes },
    ];
    renderStages.push({ name: 'group', label: 'test', run: withGroupRow });

    const [groupRow, ...rest]: RenderRow<Row>[] = renderRows();

    expect(groupRow.sourceIndex).toBeUndefined();
    expect(rest.map((row) => row.sourceIndex)).toEqual([0, 1, 2]);
  });

  it('recomputes sourceIndex when data() changes', () => {
    const data = signal(makeRows());
    const { renderRows } = createTableCore<Row>({ columns, trackBy: 'id', data });

    data.set([{ id: 'r0', name: 'Zed' }, ...makeRows()]);

    expect(renderRows().map((row) => row.sourceIndex)).toEqual([0, 1, 2, 3]);
  });
});

describe('createTableCore — cells on data rows (ADR-0022)', () => {
  it('stamps a cells entry per column in columns(), keyed by accessor output, including a hidden column', () => {
    const { renderRows } = createTableCore<Row>({
      columns: [
        ...createColumns(noData<Row>(), (col) => [
          col('name'),
          col('shout', { visible: false, accessor: (row) => row.name.toUpperCase() }),
        ]).columns,
      ],
      trackBy: 'id',
      data: signal(makeRows()),
    });

    const [row] = renderRows();

    expect(row.cells).toEqual({ name: 'Ann', shout: 'ANN' });
  });

  it('recomputes cells when data changes', () => {
    const data = signal(makeRows());
    const { renderRows } = createTableCore<Row>({ columns, trackBy: 'id', data });

    expect(renderRows()[0].cells['name']).toBe('Ann');

    data.set([{ id: 'r1', name: 'Zed' }, ...makeRows().slice(1)]);

    expect(renderRows()[0].cells['name']).toBe('Zed');
  });

  it('recomputes cells when columns changes', () => {
    const { core, renderRows } = createTableCore<Row>({
      columns,
      trackBy: 'id',
      data: signal(makeRows()),
    });

    expect(renderRows()[0].cells['name']).toBe('Ann');

    core.columns.update((cols) =>
      cols.map((column) =>
        column.id === 'name'
          ? { ...column, accessor: (row: Row) => row.name.toUpperCase() }
          : column,
      ),
    );

    expect(renderRows()[0].cells['name']).toBe('ANN');
  });

  it('a throwing accessor degrades only that cell, leaving siblings resolved, and logs once across a multi-row table', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { renderRows } = createTableCore<Row>({
        columns: [
          ...createColumns(noData<Row>(), (col) => [
            col('name'),
            col('bad', {
              accessor: () => {
                throw new Error('boom');
              },
            }),
          ]).columns,
        ],
        trackBy: 'id',
        data: signal(makeRows()),
      });

      const rows = renderRows();

      expect(rows.every((row) => row.cells['bad'] === undefined)).toBe(true);
      expect(rows.map((row) => row.cells['name'])).toEqual(['Ann', 'Bea', 'Cid']);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    } finally {
      errorSpy.mockRestore();
    }
  });
});

describe('createTableCore — group-row cells (D5, ADR-0022)', () => {
  it("a group header's cells deep-equals its aggregates", () => {
    const { renderRows, renderStages } = createTableCore<Row>({
      columns,
      trackBy: 'id',
      data: signal(makeRows()),
    });
    const aggregates = { amount: 150 };
    renderStages.push({
      name: 'group',
      label: 'test',
      run: (nodes) => [
        {
          id: 'group-1',
          kind: 'group',
          data: null,
          aggregates,
          groupKey: { columnId: 'name', value: 'all', label: 'All' },
          children: nodes,
        },
      ],
    });

    const [groupRow] = renderRows();

    expect(groupRow.cells).toEqual(aggregates);
  });

  it('a column with no aggregateFn is absent from a group header cells (reading undefined)', () => {
    const { renderRows, renderStages } = createTableCore<Row>({
      columns,
      trackBy: 'id',
      data: signal(makeRows()),
    });
    // 'name' has no aggregateFn — a real aggregation stage would never populate an entry for it
    // in `aggregates`, so the synthesized row here mirrors that: only 'amount' is present.
    renderStages.push({
      name: 'group',
      label: 'test',
      run: (nodes) => [
        {
          id: 'group-1',
          kind: 'group',
          data: null,
          aggregates: { amount: 150 },
          groupKey: { columnId: 'name', value: 'all', label: 'All' },
          children: nodes,
        },
      ],
    });

    const [groupRow] = renderRows();

    expect(groupRow.cells['name']).toBeUndefined();
    expect('name' in groupRow.cells).toBe(false);
  });

  it('a group header carries no cells entry keyed by groupKey.columnId unless that column has an aggregateFn', () => {
    const { renderRows, renderStages } = createTableCore<Row>({
      columns,
      trackBy: 'id',
      data: signal(makeRows()),
    });
    // groupKey.columnId is 'name', but 'name' carries no aggregateFn, so aggregates never gets a
    // 'name' entry — the D5 amendment: the group's own clustered value is never merged back into
    // cells under its own column id.
    renderStages.push({
      name: 'group',
      label: 'test',
      run: (nodes) => [
        {
          id: 'group-1',
          kind: 'group',
          data: null,
          aggregates: {},
          groupKey: { columnId: 'name', value: 'Ann', label: 'Ann' },
          children: nodes,
        },
      ],
    });

    const [groupRow] = renderRows();

    expect(groupRow.groupKey?.columnId).toBe('name');
    expect('name' in groupRow.cells).toBe(false);
  });
});

describe('createTableCore — expandedRows union (ADR-0017)', () => {
  it('unions two contributed expandedRows sets — a row shows if either set contains its parent', () => {
    // `core.ts` unions every feature's contributed `expandedRows` (`expandedSources`) and feeds
    // the result into `flattenVisible`, the only function that reads it. Push two disjoint sets
    // directly onto the handle, the same way `compose-table.ts`'s fold does one at a time —
    // neither set alone covers both children, only the union does.
    interface TreeRow {
      id: string;
    }
    const rows: TreeRow[] = [{ id: 'p1' }, { id: 'c1' }, { id: 'p2' }, { id: 'c2' }];
    const { renderRows, renderStages, expandedSources } = createTableCore<TreeRow>({
      columns: [...createColumns(noData<TreeRow>(), (col) => [col('id')]).columns],
      trackBy: 'id',
      data: signal(rows),
    });
    renderStages.push({
      name: 'tree',
      label: 'test',
      run: (nodes) => {
        const byId = new Map(nodes.map((node) => [node.id, node]));
        const p1 = byId.get('p1');
        const c1 = byId.get('c1');
        const p2 = byId.get('p2');
        const c2 = byId.get('c2');
        if (!p1 || !c1 || !p2 || !c2) {
          throw new Error('expected seeded nodes p1/c1/p2/c2 to be present');
        }
        return [
          { ...p1, children: [c1] },
          { ...p2, children: [c2] },
        ];
      },
    });
    expandedSources.push(signal(new Set<RowId>(['p1'])));
    expandedSources.push(signal(new Set<RowId>(['p2'])));

    expect(renderRows().map((row) => row.id)).toEqual(['p1', 'c1', 'p2', 'c2']);
  });
});

describe('createTableCore — isContextRow stamp', () => {
  function makeCore() {
    return createTableCore<Row>({ columns, trackBy: 'id', data: signal(makeRows()) });
  }

  it('stamps isContextRow true for ids in a contributed set and false for every other data row', () => {
    const { renderRows, contextSources } = makeCore();
    contextSources.push(signal(new Set<RowId>(['r2'])));

    expect(renderRows().map((row) => row.isContextRow)).toEqual([false, true, false]);
  });

  it('unions every contributed context-row set', () => {
    const { renderRows, contextSources } = makeCore();
    contextSources.push(signal(new Set<RowId>(['r1'])));
    contextSources.push(signal(new Set<RowId>(['r3'])));

    expect(renderRows().map((row) => row.isContextRow)).toEqual([true, false, true]);
  });

  it('leaves isContextRow undefined on every row when no feature contributes context rows', () => {
    const { renderRows } = makeCore();

    expect(renderRows().map((row) => row.isContextRow)).toEqual([undefined, undefined, undefined]);
  });

  it('stamps false, not undefined, when a contributor exists but its set is empty', () => {
    const { renderRows, contextSources } = makeCore();
    contextSources.push(signal(new Set<RowId>()));

    for (const row of renderRows()) {
      expect(row.isContextRow).toBe(false);
    }
  });

  it('leaves isContextRow undefined on a synthesized group row while stamping its data rows', () => {
    const { renderRows, renderStages, contextSources } = makeCore();
    const withGroupRow: RenderNodeTransform<Row> = (nodes) => [
      { id: 'group-1', kind: 'group', data: null, children: nodes },
    ];
    renderStages.push({ name: 'group', label: 'test', run: withGroupRow });
    contextSources.push(signal(new Set<RowId>(['r2'])));

    const [groupRow, ...rest]: RenderRow<Row>[] = renderRows();

    expect(groupRow.isContextRow).toBeUndefined();
    expect(rest.map((row) => row.isContextRow)).toEqual([false, true, false]);
  });
});
