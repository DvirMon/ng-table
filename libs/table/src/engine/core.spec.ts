import { signal } from '@angular/core';
import { createTableCore } from './core';
import type { RenderRow, RowId } from '../api/types';
import type { RenderRowTransform } from './render-stages';

interface Row {
  id: string;
  name: string;
}

const columns = [{ id: 'name' }];

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
    stages.sort = (rows) => [...rows].reverse();

    expect(renderRows().map((row) => row.sourceIndex)).toEqual([2, 1, 0]);
  });

  it('leaves sourceIndex undefined for a synthesized row with no backing data() entry', () => {
    const { renderRows, renderStages } = createTableCore<Row>({
      columns,
      trackBy: 'id',
      data: signal(makeRows()),
    });
    const withGroupRow: RenderRowTransform<Row> = (rows) => [
      { id: 'group-1', depth: 0, kind: 'group', data: null },
      ...rows.map((row) => ({ ...row, depth: 1 })),
    ];
    renderStages.group = withGroupRow;

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

describe('createTableCore — expandedRows union (ADR-0017)', () => {
  it('unions two contributed expandedRows sets — a row shows if either set contains its parent', () => {
    // `core.ts` is the boundary that unions every feature's contributed `expandedRows`
    // (`expandedSources`) before handing the result to the terminal 'prune' stage. Push two
    // disjoint sets directly onto the handle, the same way `compose-table.ts`'s fold does one
    // at a time — neither set alone covers both children, only the union does.
    interface TreeRow {
      id: string;
    }
    const rows: TreeRow[] = [{ id: 'p1' }, { id: 'c1' }, { id: 'p2' }, { id: 'c2' }];
    const { renderRows, renderStages, expandedSources } = createTableCore<TreeRow>({
      columns: [{ id: 'id' }],
      trackBy: 'id',
      data: signal(rows),
    });
    renderStages.tree = (rs) =>
      rs.map((row) => {
        if (row.id === 'c1') return { ...row, parentId: 'p1' };
        if (row.id === 'c2') return { ...row, parentId: 'p2' };
        return row;
      });
    expandedSources.push(signal(new Set<RowId>(['p1'])));
    expandedSources.push(signal(new Set<RowId>(['p2'])));

    expect(renderRows().map((row) => row.id)).toEqual(['p1', 'c1', 'p2', 'c2']);
  });
});
