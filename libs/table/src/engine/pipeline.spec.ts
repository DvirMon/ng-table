import { describe, expect, it } from 'vitest';
import { runPipeline } from './pipeline';
import type { ResolvedStage } from './stage-order';

describe('runPipeline', () => {
  it('folds stages in list order', () => {
    const trace: string[] = [];
    const stages: ResolvedStage<(rows: string[]) => string[]>[] = [
      { name: 'filter', run: (rows) => (trace.push('filter'), rows) },
      { name: 'group', run: (rows) => (trace.push('group'), rows) },
      { name: 'sort', run: (rows) => (trace.push('sort'), rows) },
    ];

    runPipeline(['a'], stages);

    expect(trace).toEqual(['filter', 'group', 'sort']);
  });

  it('threads each stage output into the next', () => {
    const stages: ResolvedStage<(rows: number[]) => number[]>[] = [
      { name: 'filter', run: (rows) => rows.filter((n) => n > 1) },
      { name: 'sort', run: (rows) => [...rows].sort((a, b) => b - a) },
    ];

    expect(runPipeline([3, 1, 2], stages)).toEqual([3, 2]);
  });

  it('is a pass-through with no stages registered', () => {
    const rows = [1, 2, 3];

    expect(runPipeline(rows, [])).toBe(rows);
  });
});
