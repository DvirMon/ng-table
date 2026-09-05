import { describe, expect, it } from 'vitest';
import { RENDER_ORDER, runRenderStages, type RenderStages } from './render-stages';
import type { RenderRow } from '../api/types';

type Row = { id: string };
type Shaped = Omit<RenderRow<Row>, 'index'>;

function makeRow(id: string): Shaped {
  return { id, depth: 0, kind: 'row', data: { id } };
}

describe('runRenderStages', () => {
  it('runs stages in RENDER_ORDER regardless of registration order', () => {
    const trace: string[] = [];
    // Registered in reverse of the fixed order, to prove insertion order is irrelevant.
    const stages: RenderStages<Row> = {};
    stages.paginate = (rows) => (trace.push('paginate'), rows);
    stages.tree = (rows) => (trace.push('tree'), rows);
    stages.group = (rows) => (trace.push('group'), rows);

    runRenderStages([makeRow('a')], stages);

    expect(trace).toEqual(['group', 'tree', 'paginate']);
    expect(trace).toEqual([...RENDER_ORDER]);
  });

  it('threads each stage output into the next', () => {
    const stages: RenderStages<Row> = {
      group: (rows) => rows.filter((row) => row.id !== 'b'),
      tree: (rows) => [...rows].reverse(),
    };

    const rows = [makeRow('a'), makeRow('b'), makeRow('c')];

    expect(runRenderStages(rows, stages).map((row) => row.id)).toEqual(['c', 'a']);
  });

  it('skips unregistered stages', () => {
    const stages: RenderStages<Row> = { tree: (rows) => [...rows].reverse() };
    const rows = [makeRow('a'), makeRow('b')];

    expect(runRenderStages(rows, stages).map((row) => row.id)).toEqual(['b', 'a']);
  });

  it('is a pass-through with no stages registered', () => {
    const rows = [makeRow('a')];

    expect(runRenderStages(rows, {})).toBe(rows);
  });
});
