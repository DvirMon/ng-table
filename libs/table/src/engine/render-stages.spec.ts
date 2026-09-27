import { describe, expect, it } from 'vitest';
import { mapNodes, runRenderStages } from './render-stages';
import type { RenderNode, RenderNodeTransform } from './render-stages';
import type { ResolvedStage } from './stage-order';
import type { StageContext } from './types';

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
  it('folds stages in list order', () => {
    const trace: string[] = [];
    const stages: ResolvedStage<RenderNodeTransform<Row>>[] = [
      { name: 'group', run: (nodes) => (trace.push('group'), nodes) },
      { name: 'tree', run: (nodes) => (trace.push('tree'), nodes) },
    ];

    runRenderStages([node('a')], stages, {});

    expect(trace).toEqual(['group', 'tree']);
  });

  it('threads each stage output into the next', () => {
    const stages: ResolvedStage<RenderNodeTransform<Row>>[] = [
      { name: 'group', run: (nodes) => nodes.filter((n) => n.id !== 'b') },
      { name: 'tree', run: (nodes) => [...nodes].reverse() },
    ];
    const nodes = [node('a'), node('b'), node('c')];

    expect(runRenderStages(nodes, stages, {}).map((n) => n.id)).toEqual(['c', 'a']);
  });

  it('is a pass-through with no stages registered, returning the input reference', () => {
    const nodes = [node('a')];

    expect(runRenderStages(nodes, [], {})).toBe(nodes);
  });

  it('hands the same context to every render stage', () => {
    const seen: StageContext<Row>[] = [];
    const ctx: StageContext<Row> = { parentOf: () => null };
    const stages: ResolvedStage<RenderNodeTransform<Row>>[] = [
      { name: 'group', run: (nodes, ctx) => (seen.push(ctx), nodes) },
      { name: 'tree', run: (nodes, ctx) => (seen.push(ctx), nodes) },
    ];

    runRenderStages([node('a')], stages, ctx);

    expect(seen).toHaveLength(2);
    expect(seen[0]).toBe(ctx);
    expect(seen[1]).toBe(ctx);
  });
});

describe('mapNodes reach (via runRenderStages)', () => {
  it('reaches a node nested two levels under another stage output, post-order (C1/C2)', () => {
    const stages: ResolvedStage<RenderNodeTransform<Row>>[] = [
      {
        // Fake 'group' stage: ignores its input entirely and always emits a fixed,
        // two-levels-deep tree — proving mapNodes' reach does not depend on which stage
        // produced the nesting.
        name: 'group',
        run: () => [
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
      },
      {
        // 'tree' stamps each node's label from its already-mapped children's own labels — a
        // value that can only be correct if mapNodes visited children before their parent.
        name: 'tree',
        run: (nodes) =>
          mapNodes(nodes, (n) => ({
            ...n,
            aggregates: {
              label:
                n.children.length === 0
                  ? n.id
                  : n.children.map((c) => c.aggregates?.['label']).join('+'),
            },
          })),
      },
    ];

    const result = runRenderStages([node('seed')], stages, {});

    expect(result[0].aggregates).toEqual({ label: 'leaf' });
    expect(result[0].children[0].aggregates).toEqual({ label: 'leaf' });
    expect(result[0].children[0].children[0].aggregates).toEqual({ label: 'leaf' });
  });
});
