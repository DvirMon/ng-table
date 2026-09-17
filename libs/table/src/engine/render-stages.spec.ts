import { describe, expect, it } from 'vitest';
import {
  CLAIMABLE_RENDER_STAGES,
  runRenderStages,
  type RenderStages,
} from './render-stages';
import type { RenderRow, RowId } from '../api/types';

type Row = { id: string };
type Shaped = Omit<RenderRow<Row>, 'index'>;

function makeRow(id: string, parentId?: string): Shaped {
  return {
    id,
    depth: 0,
    kind: 'row',
    data: { id },
    ...(parentId !== undefined ? { parentId } : {}),
  };
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
    // 'prune' (ADR-0017) is engine-owned and unclaimable — it never touches `stages` and never
    // pushes to `trace`, so RENDER_ORDER (which now includes 'prune') is no longer the right
    // comparison. CLAIMABLE_RENDER_STAGES is RENDER_ORDER minus 'prune', derived, not a second
    // hand-maintained list.
    expect(trace).toEqual([...CLAIMABLE_RENDER_STAGES]);
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

  it('runs prune between tree and paginate — paginate sees pruning already applied', () => {
    // The prune is not a registered stage, so it cannot be proven via a trace string (only
    // registered `stages.*` closures push to one). Assert on what the fake `paginate`
    // transform actually receives as input instead.
    let paginateSawIds: RowId[] = [];
    const stages: RenderStages<Row> = {
      paginate: (rows) => {
        paginateSawIds = rows.map((row) => row.id);
        return rows;
      },
    };
    const rows = [makeRow('parent'), makeRow('child', 'parent')];

    // Nothing expanded — 'child' should be pruned before 'paginate' ever runs.
    const result = runRenderStages(rows, stages, new Set());

    expect(paginateSawIds).toEqual(['parent']);
    expect(result.map((row) => row.id)).toEqual(['parent']);
  });

  it('is a pure no-op when expanded is undefined — zero contributors (D5)', () => {
    const rows = [makeRow('parent'), makeRow('child', 'parent')];

    // Third param omitted entirely: no feature composed the expandedRows slot at all.
    const result = runRenderStages(rows, {});

    expect(result).toBe(rows);
    expect(result.map((row) => row.id)).toEqual(['parent', 'child']);
  });

  it('a currently-empty contributed set is NOT a no-op — hides every parented row (decision 6)', () => {
    // Distinct from the zero-contributor case above: here a feature DID contribute the slot,
    // it just has nothing expanded right now. That must still prune.
    const rows = [makeRow('parent'), makeRow('child', 'parent')];

    const result = runRenderStages(rows, {}, new Set());

    expect(result.map((row) => row.id)).toEqual(['parent']);
  });

  it('a collapsed parent (absent from the expanded set) drops its direct children', () => {
    const rows = [makeRow('parent'), makeRow('child', 'parent')];

    const result = runRenderStages(rows, {}, new Set(['some-other-id']));

    expect(result.map((row) => row.id)).toEqual(['parent']);
  });

  it('drops transitive descendants of a dropped row, proving the hidden accumulator', () => {
    // 'child' is itself present in `expanded` (so its own children would normally show), but
    // 'child' gets hidden because ITS parent isn't expanded. 'grandchild' must be dropped too,
    // via the `hidden` accumulator — not because 'grandchild' fails a direct membership check
    // against `expanded`.
    const rows = [
      makeRow('parent'),
      makeRow('child', 'parent'),
      makeRow('grandchild', 'child'),
    ];

    const result = runRenderStages(rows, {}, new Set(['child']));

    expect(result.map((row) => row.id)).toEqual(['parent']);
  });

  it('never drops a row with no parentId, whatever the expanded set contains', () => {
    const rows = [makeRow('top1'), makeRow('top2')];

    const result = runRenderStages(rows, {}, new Set());

    expect(result.map((row) => row.id)).toEqual(['top1', 'top2']);
  });

  it('documents the emit-order contract: a descendant emitted before its hidden ancestor is not pruned', () => {
    // ADR-0017 decision 8: the single forward-pass `hidden` accumulator is correct ONLY
    // because both synthesizing stages emit a parent immediately before its descendants. This
    // is not a bug — it is the documented invariant that keeps the prune O(n) instead of an
    // O(depth) ancestor climb per row. This test deliberately violates that invariant to make
    // the consequence visible: 'grandchild' is listed before its own parent 'child', so by the
    // time 'grandchild' is evaluated, 'child' has not yet been added to `hidden` — 'grandchild'
    // survives even though it should have been hidden once 'child' is dropped a row later.
    const rows = [
      makeRow('grandchild', 'child'),
      makeRow('child', 'parent'),
      makeRow('parent'),
    ];
    // 'child' is itself expandable, but its own parent ('parent') is not — so 'child' gets
    // dropped. If emission order were parent-first, 'grandchild' would be dropped too.
    const expanded = new Set(['child']);

    const result = runRenderStages(rows, {}, expanded);

    expect(result.map((row) => row.id)).toEqual(['grandchild', 'parent']);
  });
});
