import { describe, expect, it } from 'vitest';
import { PIPELINE_ANCHORS, runPipeline, type PipelineStages } from './pipeline';

describe('runPipeline', () => {
  it('runs stages in PIPELINE_ANCHORS regardless of registration order', () => {
    const trace: string[] = [];
    // Registered in reverse of the fixed order, to prove insertion order is irrelevant.
    const stages: PipelineStages<string> = {};
    stages.sort = (rows) => (trace.push('sort'), rows);
    stages.group = (rows) => (trace.push('group'), rows);
    stages.filter = (rows) => (trace.push('filter'), rows);

    runPipeline(['a'], stages);

    expect(trace).toEqual(['filter', 'group', 'sort']);
    expect(trace).toEqual([...PIPELINE_ANCHORS]);
  });

  it('threads each stage output into the next', () => {
    const stages: PipelineStages<number> = {
      filter: (rows) => rows.filter((n) => n > 1),
      sort: (rows) => [...rows].sort((a, b) => b - a),
    };

    expect(runPipeline([3, 1, 2], stages)).toEqual([3, 2]);
  });

  it('skips unregistered stages', () => {
    const stages: PipelineStages<number> = { sort: (rows) => [...rows].reverse() };

    expect(runPipeline([1, 2, 3], stages)).toEqual([3, 2, 1]);
  });

  it('is a pass-through with no stages registered', () => {
    const rows = [1, 2, 3];

    expect(runPipeline(rows, {})).toBe(rows);
  });
});
