import { describe, expect, it } from 'vitest';
import { mapNodes, runRenderStages } from './render-stages';
import type { RenderNode, RenderStages } from './render-stages';

type Row = { id: string };

function node(id: string, overrides: Partial<RenderNode<Row>> = {}): RenderNode<Row> {
  return {
    id,
    kind: 'row',
    data: { id },
    children: [],
    ...overrides,
  };
}

describe('runRenderStages', () => {
  it('runs stages in RENDER_ANCHORS regardless of registration order', () => {
    const trace: string[] = [];
    // Registered in reverse of the fixed order, to prove insertion order is irrelevant.
    const stages: RenderStages<Row> = {};
    stages.tree = (nodes) => (trace.push('tree'), nodes);
    stages.group = (nodes) => (trace.push('group'), nodes);

    runRenderStages([node('a')], stages);

    expect(trace).toEqual(['group', 'tree']);
  });

  it('threads each stage output into the next', () => {
    const stages: RenderStages<Row> = {
      group: (nodes) => nodes.filter((n) => n.id !== 'b'),
      tree: (nodes) => [...nodes].reverse(),
    };
    const nodes = [node('a'), node('b'), node('c')];

    expect(runRenderStages(nodes, stages).map((n) => n.id)).toEqual(['c', 'a']);
  });

  it('skips an unregistered stage', () => {
    const stages: RenderStages<Row> = { tree: (nodes) => [...nodes].reverse() };
    const nodes = [node('a'), node('b')];

    expect(runRenderStages(nodes, stages).map((n) => n.id)).toEqual(['b', 'a']);
  });

  it('is a pass-through with no stages registered, returning the input reference', () => {
    const nodes = [node('a')];

    expect(runRenderStages(nodes, {})).toBe(nodes);
  });
});

describe('mapNodes reach (via runRenderStages)', () => {
  it('reaches a node nested two levels under another stage output, post-order (C1/C2)', () => {
    const stages: RenderStages<Row> = {
      // Fake 'group' stage: ignores its input entirely and always emits a fixed,
      // two-levels-deep tree — proving mapNodes' reach does not depend on which stage
      // produced the nesting.
      group: () => [
        {
          id: 'g1',
          kind: 'group',
          data: null,
          children: [
            {
              id: 'g2',
              kind: 'group',
              data: null,
              children: [node('leaf')],
            },
          ],
        },
      ],
      // 'tree' stamps each node's label from its already-mapped children's own labels —
      // a value that can only be correct if mapNodes visited children before their parent.
      tree: (nodes) =>
        mapNodes(nodes, (n) => ({
          ...n,
          aggregates: {
            label:
              n.children.length === 0
                ? n.id
                : n.children.map((c) => c.aggregates?.['label']).join('+'),
          },
        })),
    };

    const result = runRenderStages([node('seed')], stages);

    expect(result[0].aggregates).toEqual({ label: 'leaf' });
    expect(result[0].children[0].aggregates).toEqual({ label: 'leaf' });
    expect(result[0].children[0].children[0].aggregates).toEqual({ label: 'leaf' });
  });
});
