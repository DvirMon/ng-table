import { describe, expect, it } from 'vitest';
import { runPipeline } from './pipeline';
import type { ResolvedStage } from './stage-order';
import type { StageContext } from './types';

describe('runPipeline', () => {
  it('folds stages in list order', () => {
    const trace: string[] = [];
    const stages: ResolvedStage<(rows: string[]) => string[]>[] = [
      { name: 'filter', label: 'test', run: (rows) => (trace.push('filter'), rows) },
      { name: 'group', label: 'test', run: (rows) => (trace.push('group'), rows) },
      { name: 'sort', label: 'test', run: (rows) => (trace.push('sort'), rows) },
    ];

    runPipeline(['a'], stages, {});

    expect(trace).toEqual(['filter', 'group', 'sort']);
  });

  it('threads each stage output into the next', () => {
    const stages: ResolvedStage<(rows: number[]) => number[]>[] = [
      { name: 'filter', label: 'test', run: (rows) => rows.filter((n) => n > 1) },
      { name: 'sort', label: 'test', run: (rows) => [...rows].sort((a, b) => b - a) },
    ];

    expect(runPipeline([3, 1, 2], stages, {})).toEqual([3, 2]);
  });

  it('is a pass-through with no stages registered', () => {
    const rows = [1, 2, 3];

    expect(runPipeline(rows, [], {})).toBe(rows);
  });

  it('hands the same context to every pipeline stage', () => {
    const seen: StageContext<string>[] = [];
    const ctx: StageContext<string> = { parentOf: () => null };
    const stages: ResolvedStage<(rows: string[], ctx: StageContext<string>) => string[]>[] = [
      { name: 'filter', label: 'test', run: (rows, ctx) => (seen.push(ctx), rows) },
      { name: 'sort', label: 'test', run: (rows, ctx) => (seen.push(ctx), rows) },
    ];

    runPipeline(['a'], stages, ctx);

    expect(seen).toHaveLength(2);
    expect(seen[0]).toBe(ctx);
    expect(seen[1]).toBe(ctx);
  });
});
