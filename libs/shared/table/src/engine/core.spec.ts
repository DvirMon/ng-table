import { signal } from '@angular/core';
import { createTableCore } from './core';
import type { RenderRow } from '../api/types';
import type { RenderRowsBuilder } from './pipeline';

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
    const { renderRows, setRenderRowsBuilder } = createTableCore<Row>({
      columns,
      trackBy: 'id',
      data: signal(makeRows()),
    });
    const withGroupRow: RenderRowsBuilder<Row> = (rows) => [
      { id: 'group-1', depth: 0, kind: 'group', data: null },
      ...rows.map((row) => ({ id: row.id, depth: 1, kind: 'row' as const, data: row })),
    ];
    setRenderRowsBuilder(withGroupRow);

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
