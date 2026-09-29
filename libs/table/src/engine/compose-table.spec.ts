import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
  signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createColumns } from '../api/create-columns';
import { getNgDevMode, setNgDevMode } from '../ng-dev-mode.testing';
import type { PipelineStage, RowTransform } from './pipeline';
import type { StageRule } from '../schema/stage-rules';
import { stageSchema } from '../schema/stage-schema';
import { stage } from '../schema/stage-rules';
import { noData } from '../table.mock';
import { composeTable, type InternalFeature } from './compose-table';
import { CORE_MEMBER_KEYS } from './slots';
import type { ParentLink, TableEngineConfig } from './types';
import type { AnyTableFeature, RowId } from '../api/types';

interface Row {
  id: string;
  name: string;
  age: number;
}

const columns = [
  ...createColumns(noData<Row>(), (col) => [col('name'), col('age')]).columns,
];

/**
 * Casts a `Row`-typed claim-rule array down to `AnyTableFeature`'s erased `RowOf<any>`
 * (`unknown`) — the same static/dynamic seam `composeWithRows` already crosses for the
 * feature list itself (ADR-0003). Needed only where a rule's `run` reads concrete `Row`
 * fields (e.g. `row.name`); a rule that only touches generic node shape infers `unknown`
 * on its own and needs no cast.
 */
function asStages(
  rules: readonly StageRule<RowTransform<Row>>[]
): readonly StageRule<RowTransform<unknown>>[] {
  return rules as unknown as readonly StageRule<RowTransform<unknown>>[];
}

/**
 * Casts a `Row`-typed `parentLink` down to `AnyTableFeature`'s erased `RowOf<any>`
 * (`unknown`) — same static/dynamic seam `asStages` crosses above, for the single-claim
 * `parentLink` slot instead of a stage rule array.
 */
function asParentLink(link: ParentLink<Row>): ParentLink<unknown> {
  return link as unknown as ParentLink<unknown>;
}

function makeRows(): Row[] {
  return [
    { id: 'r1', name: 'Charlie', age: 40 },
    { id: 'r2', name: 'Ann', age: 25 },
  ];
}

// Composes inside an injection context, as `createTable()` does. Returns the untyped store
// because the engine's runtime fold is deliberately independent of the static member type
// `ComposedFeatureMembers` reconstructs. Each call gets its own `data` signal so tests seed
// rows at construction time — there is no post-construction write path anymore.
function composeWithRows(
  rows: Row[],
  features: readonly AnyTableFeature[],
  internalFeatures: readonly AnyTableFeature[] = []
): Record<string, unknown> {
  const data = signal(rows);
  const config: TableEngineConfig<Row> = { columns, trackBy: 'id', data };
  // Test-only marker features (e.g. `marking()`) don't distinguish consumer vs. internal
  // calling convention, so this cast bridges the same static/dynamic seam `composeTable()`
  // itself crosses to call `AnyTableFeature`-typed values (ADR-0003).
  const internal = internalFeatures as unknown as readonly InternalFeature<Row>[];
  return TestBed.runInInjectionContext(
    () =>
      composeTable(config, features, internal) as unknown as Record<
        string,
        unknown
      >
  );
}

function compose(
  features: readonly AnyTableFeature[],
  internalFeatures: readonly AnyTableFeature[] = []
): Record<string, unknown> {
  return composeWithRows([], features, internalFeatures);
}

/** Records a stage transform that tags each row's name, so fold order is observable. */
function taggingStage(
  anchor: 'filter' | 'group' | 'sort',
  tag: string
): AnyTableFeature {
  return () => ({
    stages: asStages(
      stageSchema<Row>('pipeline', (s) =>
        stage(s[anchor], {
          run: (rows: Row[]) =>
            rows.map((row) => ({ ...row, name: `${row.name}${tag}` })),
        })
      )
    ),
  });
}

/** `'audit'` and `'pin'` below only typecheck because `../schema/stage-schema.types.spec.ts`
 * merges them into `PipelineStageRegistry`/`RenderStageRegistry`. */

/** Declares a new pipeline stage `name`, anchored on `anchor` at `placement`, tagging each
 * row's name the same way `taggingStage` does — makes a declared stage's resolved position
 * observable through the pipeline output (#155 step 2, seam D). */
function declaredPipelineStage(
  anchor: 'filter' | 'group' | 'sort',
  name: PipelineStage,
  placement: 'before' | 'after',
  tag: string
): AnyTableFeature {
  return () => ({
    stages: asStages(
      stageSchema<Row>('pipeline', (s) =>
        stage(s[anchor], {
          name,
          placement,
          run: (rows: Row[]) =>
            rows.map((row) => ({ ...row, name: `${row.name}${tag}` })),
        })
      )
    ),
  });
}

/** Reads the running `trail` a render fixture has appended to so far. */
function trailOf(node: { aggregates?: Record<string, unknown> }): string {
  return (node.aggregates?.['trail'] as string | undefined) ?? '';
}

/** Claims a render anchor and appends `tag` to every node's `aggregates.trail` — the render
 * layer's equivalent of `taggingStage`, used to make a declared render stage's resolved
 * position observable (#155 step 2, seams B/C/E). */
function renderTaggingStage(anchor: 'group' | 'tree', tag: string): AnyTableFeature {
  return () => ({
    renderStages: stageSchema('render', (s) =>
      stage(s[anchor], {
        run: (nodes) =>
          nodes.map((node) => ({
            ...node,
            aggregates: { ...(node.aggregates ?? {}), trail: `${trailOf(node)}${tag}` },
          })),
      })
    ),
  });
}

/** Claims the `'group'` render anchor and wraps every node under one synthesized group node
 * tagged `id` — used to make the winning claim observable when two features race for the
 * same render anchor with `ngDevMode` off (#155 step 3, seam B). */
function groupWrappingStage(id: string): AnyTableFeature {
  return () => ({
    renderStages: stageSchema('render', (s) =>
      stage(s.group, {
        run: (nodes) => [{ id, kind: 'group' as const, data: null, children: nodes }],
      })
    ),
  });
}

/** Declares a render stage named `pin`, anchored on `'tree'` at `placement`. Its `run`
 * both reverses node order (proves the resolved position actually runs — seam A) and
 * appends `'pin>'` to `aggregates.trail` (proves relative order against a `'tree'`
 * claimant — seams B/C/F). */
function pinningStage(placement: 'before' | 'after'): AnyTableFeature {
  return () => ({
    renderStages: stageSchema('render', (s) =>
      stage(s.tree, {
        name: 'pin',
        placement,
        run: (nodes) =>
          [...nodes].reverse().map((node) => ({
            ...node,
            aggregates: { ...(node.aggregates ?? {}), trail: `${trailOf(node)}pin>` },
          })),
      })
    ),
  });
}

describe('composeTable', () => {
  it('resolves sparse column defs into full ColumnDefs', () => {
    const store = compose([]);
    const resolved = (store['columns'] as () => Record<string, unknown>[])();

    expect(resolved).toHaveLength(2);
    expect(resolved[0]).toMatchObject({
      id: 'name',
      visible: true,
      order: 0,
      label: 'name',
    });
  });

  it('passes rows through untouched when no feature registers a stage', () => {
    const store = composeWithRows(makeRows(), []);

    expect((store['rows'] as () => Row[])()).toEqual(makeRows());
  });

  it('merges every feature’s members onto the store', () => {
    const withA: AnyTableFeature = () => ({ members: { alpha: 1 } });
    const withB: AnyTableFeature = () => ({ members: { beta: 2 } });

    const store = compose([withA, withB]);

    expect(store['alpha']).toBe(1);
    expect(store['beta']).toBe(2);
  });

  it('folds claimed stages in fixed anchor order regardless of features array order', () => {
    const store = composeWithRows(
      [{ id: 'r1', name: 'Ann', age: 25 }],
      [
        taggingStage('sort', '-sort'),
        taggingStage('group', '-group'),
        taggingStage('filter', '-filter'),
      ]
    );

    const [row] = (store['rows'] as () => Row[])();

    expect(row.name).toBe('Ann-filter-group-sort');
  });

  it('1:1-wraps rows into render rows when no feature provides a render stage', () => {
    const store = composeWithRows(makeRows(), []);

    expect((store['renderRows'] as () => unknown[])()).toEqual([
      {
        id: 'r1',
        depth: 0,
        kind: 'row',
        data: { id: 'r1', name: 'Charlie', age: 40 },
        hasChildren: false,
        index: 0,
        sourceIndex: 0,
        cells: { name: 'Charlie', age: 40 },
      },
      {
        id: 'r2',
        depth: 0,
        kind: 'row',
        data: { id: 'r2', name: 'Ann', age: 25 },
        hasChildren: false,
        index: 1,
        sourceIndex: 1,
        cells: { name: 'Ann', age: 25 },
      },
    ]);
  });

  // `depth` isn't a settable `RenderNode` field (see ADR-0023) — proves stage-claiming
  // through `hasChildren` instead.
  it('lets a feature claim a render stage', () => {
    const withHasChildrenOverride: AnyTableFeature = () => ({
      renderStages: stageSchema('render', (s) =>
        stage(s.tree, {
          run: (rows) => rows.map((row) => ({ ...row, hasChildren: true })),
        })
      ),
    });

    const store = composeWithRows(makeRows(), [withHasChildrenOverride]);

    const [first] = (store['renderRows'] as () => { hasChildren: boolean }[])();
    expect(first.hasChildren).toBe(true);
  });

  it('throws when two features claim the same pipeline anchor', () => {
    expect(() =>
      compose([taggingStage('sort', '-a'), taggingStage('sort', '-b')])
    ).toThrow(
      '[createTable] feature 1 and feature 2 both provide the "sort" pipeline stage. Only one feature may provide each stage.'
    );
  });

  it('throws when two features claim the same render anchor', () => {
    const withTreeStage: AnyTableFeature = () => ({
      renderStages: stageSchema('render', (s) => stage(s.tree, { run: (rows) => rows })),
    });

    expect(() => compose([withTreeStage, withTreeStage])).toThrow(
      '[createTable] feature 1 and feature 2 both provide the "tree" render stage. Only one feature may provide each render stage.'
    );
  });

  it('lets the later pipeline claim win without throwing when ngDevMode is false', () => {
    const previous = getNgDevMode();
    setNgDevMode(false);
    try {
      const store = composeWithRows(
        [{ id: 'r1', name: 'Ann', age: 25 }],
        [taggingStage('sort', '-a'), taggingStage('sort', '-b')]
      );

      const [row] = (store['rows'] as () => Row[])();
      expect(row.name).toBe('Ann-b');
    } finally {
      setNgDevMode(previous);
    }
  });

  it('lets the later render claim win without throwing when ngDevMode is false', () => {
    const previous = getNgDevMode();
    setNgDevMode(false);
    try {
      const store = composeWithRows(makeRows(), [
        groupWrappingStage('group-a'),
        groupWrappingStage('group-b'),
      ]);

      const [first] = (store['renderRows'] as () => { id: string }[])();
      expect(first.id).toBe('group-b');
    } finally {
      setNgDevMode(previous);
    }
  });

  it('still throws on a duplicate member claim when ngDevMode is false (members stay ungated)', () => {
    const previous = getNgDevMode();
    setNgDevMode(false);
    try {
      expect(() =>
        compose([
          () => ({ members: { alpha: 1 } }),
          () => ({ members: { alpha: 2 } }),
        ])
      ).toThrow(
        '[createTable] feature 1 and feature 2 both provide the "alpha" store member. Only one feature may provide each member.'
      );
    } finally {
      setNgDevMode(previous);
    }
  });

  describe('expandedRows contributions (ADR-0017)', () => {
    it('composes two features that both contribute an expandedRows set without throwing', () => {
      const withA: AnyTableFeature = () => ({
        expandedRows: signal(new Set<RowId>(['a'])),
      });
      const withB: AnyTableFeature = () => ({
        expandedRows: signal(new Set<RowId>(['b'])),
      });

      // Contrast with 'throws when two features claim the same render stage' above:
      // expandedRows is the one slot that ACCUMULATES rather than single-claims (decision 7)
      // — this is the ADR-0012 verification case a single-claim slot would fail.
      expect(() => compose([withA, withB])).not.toThrow();
    });

    it('collects contributions from every feature in the fold, and both are visible after the flatten', () => {
      // Nests 'r2' as a child of 'r1' via a claimed 'tree' render stage — flattenVisible derives
      // depth/parentId from a node's position in the tree, so nesting via `children` is the only
      // way to make one row's visibility depend on another row's expandedRows membership.
      const withTreeChild: AnyTableFeature = () => ({
        renderStages: stageSchema('render', (s) =>
          stage(s.tree, {
            run: (nodes) => {
              const byId = new Map(nodes.map((node) => [node.id, node]));
              const r1 = byId.get('r1');
              const r2 = byId.get('r2');
              if (!r1 || !r2) {
                throw new Error('expected seeded nodes r1/r2 to be present');
              }
              return [{ ...r1, children: [r2] }];
            },
          })
        ),
      });
      // 'r1' lives on the FIRST-folded contributor, an unrelated id on the second. If the fold
      // regressed into keeping only the most-recently-folded contributor (the exact "fixed it
      // into a SlotRegistry claim" mistake the ADR warns about), 'r1' would be lost and 'r2'
      // would stay hidden — this ordering is chosen so that regression fails loudly.
      const withFirstContributor: AnyTableFeature = () => ({
        expandedRows: signal(new Set<RowId>(['r1'])),
      });
      const withSecondContributor: AnyTableFeature = () => ({
        expandedRows: signal(new Set<RowId>(['unrelated'])),
      });

      const store = composeWithRows(makeRows(), [
        withTreeChild,
        withFirstContributor,
        withSecondContributor,
      ]);

      const ids = (store['renderRows'] as () => { id: string }[])().map((row) => row.id);

      expect(ids).toEqual(['r1', 'r2']);
    });
  });

  describe('contextRows contributions', () => {
    it('collects a contextRows contribution from every feature in the fold', () => {
      const withFirst: AnyTableFeature = () => ({
        contextRows: signal(new Set<RowId>(['r1'])),
      });
      const withSecond: AnyTableFeature = () => ({
        contextRows: signal(new Set<RowId>(['unrelated'])),
      });

      const store = composeWithRows(makeRows(), [withFirst, withSecond]);
      const flags = (
        store['renderRows'] as () => { isContextRow?: boolean }[]
      )().map((row) => row.isContextRow);

      expect(flags).toEqual([true, false]);
    });
  });

  it('composes render stages in RENDER_ANCHORS order regardless of registration order', () => {
    const withGroupStage: AnyTableFeature = () => ({
      renderStages: stageSchema('render', (s) =>
        stage(s.group, {
          run: (nodes) => [
            { id: 'group-1', kind: 'group' as const, data: null, children: nodes },
          ],
        })
      ),
    });
    // Tags only the 'group'-kind node — a node that exists solely because 'group' already ran.
    // If RENDER_ANCHORS were not fixed (e.g. array order leaked into execution order), the
    // reversed composition would run 'tree' before any group header exists to tag, and this
    // assertion would catch it — a transform that touched every node regardless of kind would
    // commute with 'group' and prove nothing about order.
    const withTreeStage: AnyTableFeature = () => ({
      renderStages: stageSchema('render', (s) =>
        stage(s.tree, {
          run: (nodes) =>
            nodes.map((node) =>
              node.kind === 'group' ? { ...node, aggregates: { touched: true } } : node
            ),
        })
      ),
    });

    const forward = composeWithRows(makeRows(), [withGroupStage, withTreeStage]);
    const reversed = composeWithRows(makeRows(), [withTreeStage, withGroupStage]);

    const forwardRows = (forward['renderRows'] as () => unknown[])();
    const reversedRows = (reversed['renderRows'] as () => unknown[])();

    expect(forwardRows).toEqual(reversedRows);
    expect(forwardRows).toEqual([
      {
        id: 'group-1',
        depth: 0,
        kind: 'group',
        data: null,
        aggregates: { touched: true },
        hasChildren: true,
        index: 0,
        sourceIndex: undefined,
        cells: { touched: true },
      },
      {
        id: 'r1',
        depth: 1,
        parentId: 'group-1',
        kind: 'row',
        data: { id: 'r1', name: 'Charlie', age: 40 },
        hasChildren: false,
        index: 1,
        sourceIndex: 0,
        cells: { name: 'Charlie', age: 40 },
      },
      {
        id: 'r2',
        depth: 1,
        parentId: 'group-1',
        kind: 'row',
        data: { id: 'r2', name: 'Ann', age: 25 },
        hasChildren: false,
        index: 2,
        sourceIndex: 1,
        cells: { name: 'Ann', age: 25 },
      },
    ]);
  });

  it('runs both render claims a feature records in one stageSchema call (group + tree)', () => {
    const withGroupAndDrop: AnyTableFeature = () => ({
      renderStages: stageSchema('render', (s) => {
        stage(s.group, {
          run: (nodes) => [
            { id: 'group-1', kind: 'group' as const, data: null, children: nodes },
          ],
        });
        // Drops 'r1' from the header's children (not the top-level array — after 'group' runs,
        // the top level holds only the header itself).
        stage(s.tree, {
          run: (nodes) =>
            nodes.map((node) =>
              node.kind === 'group'
                ? { ...node, children: node.children.filter((child) => child.id !== 'r1') }
                : node
            ),
        });
      }),
    });

    const store = composeWithRows(makeRows(), [withGroupAndDrop]);
    const rows = (store['renderRows'] as () => { index: number; kind: string }[])();

    // Dropping either claimed stage from the fold would fail these: losing 'group' drops the
    // group-header node (length 1, no 'group'-kind row); losing 'tree' leaves 'r1' present.
    expect(rows.map((row) => row.index)).toEqual([0, 1]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ kind: 'group' });
  });

  it('lets one feature claim the "group" anchor in both stages and renderStages (mirrors withGrouping)', () => {
    const withGrouping: AnyTableFeature = () => ({
      stages: asStages(
        stageSchema<Row>('pipeline', (s) => stage(s.group, { run: (rows: Row[]) => rows }))
      ),
      renderStages: stageSchema('render', (s) =>
        stage(s.group, {
          run: (nodes) => [
            { id: 'group-1', kind: 'group' as const, data: null, children: nodes },
          ],
        })
      ),
    });

    expect(() => composeWithRows(makeRows(), [withGrouping])).not.toThrow();
  });

  // #155 step 2 — runs a declared stage at its `resolveStageOrder`-resolved position instead
  // of dropping it (the fold's `if ('name' in rule) continue`). See
  // step-2-run-resolved-order.test-plan.md seams A-D, F.
  describe('declared stages (#155)', () => {
    it('runs a declared render stage placed after an unclaimed anchor', () => {
      const store = composeWithRows(makeRows(), [pinningStage('after')]);

      const ids = (store['renderRows'] as () => { id: string }[])().map(
        (row) => row.id
      );

      expect(ids).toEqual(['r2', 'r1']);
    });

    it('runs a declared stage after the anchor it is placed after', () => {
      const store = composeWithRows(makeRows(), [
        renderTaggingStage('tree', 'tree>'),
        pinningStage('after'),
      ]);

      const rows = (
        store['renderRows'] as () => { aggregates?: Record<string, unknown> }[]
      )();

      for (const row of rows) {
        expect(trailOf(row)).toBe('tree>pin>');
      }
    });

    it('runs a declared stage before the anchor it is placed before', () => {
      const store = composeWithRows(makeRows(), [
        renderTaggingStage('tree', 'tree>'),
        pinningStage('before'),
      ]);

      const rows = (
        store['renderRows'] as () => { aggregates?: Record<string, unknown> }[]
      )();

      for (const row of rows) {
        expect(trailOf(row)).toBe('pin>tree>');
      }
    });

    it('runs a declared pipeline stage after the anchor it is placed after', () => {
      const store = composeWithRows(
        [{ id: 'r1', name: 'Ann', age: 25 }],
        [
          taggingStage('sort', '-sort'),
          declaredPipelineStage('sort', 'audit', 'after', '-audit'),
        ]
      );

      const [row] = (store['rows'] as () => Row[])();

      expect(row.name).toBe('Ann-sort-audit');
    });

    it('throws naming both features when two declare the same stage name', () => {
      let thrown: unknown;
      try {
        compose([pinningStage('after'), pinningStage('after')]);
      } catch (error) {
        thrown = error;
      }

      const message = thrown instanceof Error ? thrown.message : '';
      expect(message).toContain('feature 1');
      expect(message).toContain('feature 2');
      expect(message).toContain('"pin"');
    });
  });

  it('throws when two features claim the same store member (ADR-0007)', () => {
    const withEditing: AnyTableFeature = () => ({ members: { editing: signal(0) } });

    expect(() => compose([withEditing, withEditing])).toThrow(
      /feature 1 and feature 2 both provide the "editing" store member/
    );
  });

  it('runs setup only after every feature is composed', () => {
    let seenAtInit: unknown;
    const withLateReader: AnyTableFeature = (store) => ({
      setup: () => {
        seenAtInit = store['contributedLater'];
      },
    });
    const withLateMember: AnyTableFeature = () => ({
      members: { contributedLater: 'present' },
    });

    compose([withLateReader, withLateMember]);

    expect(seenAtInit).toBe('present');
  });

  it('shows a feature only earlier features’ members at factory time', () => {
    let seenAtFactory: unknown = 'unset';
    const withEarly: AnyTableFeature = () => ({ members: { early: 'yes' } });
    const withReader: AnyTableFeature = (store) => {
      seenAtFactory = { early: store['early'], late: store['late'] };
      return {};
    };
    const withLate: AnyTableFeature = () => ({ members: { late: 'yes' } });

    compose([withEarly, withReader, withLate]);

    expect(seenAtFactory).toEqual({ early: 'yes', late: undefined });
  });

  it('lets a deferred read (inside a member function) see a later feature’s member (D25)', () => {
    // Contrast with the factory-time case above: a *method* captures the shared store
    // reference and is called after the whole fold completes, so it sees `late` even though
    // `withEarlyReader` folds before `withLate` — runtime is less strict than the static type.
    const withEarlyReader: AnyTableFeature = (store) => ({
      members: {
        readLateNow: () => (store as Record<string, unknown>)['late'],
      },
    });
    const withLate: AnyTableFeature = () => ({ members: { late: 'yes' } });

    const store = compose([withEarlyReader, withLate]);

    expect((store['readLateNow'] as () => unknown)()).toBe('yes');
  });

  it('runs onDestroy hooks when the owning injector is destroyed', () => {
    const destroyed: string[] = [];
    const withTeardown: AnyTableFeature = () => ({
      onDestroy: () => destroyed.push('torn-down'),
    });

    const injector = createEnvironmentInjector(
      [],
      TestBed.inject(EnvironmentInjector)
    );
    const config: TableEngineConfig<Row> = { columns, trackBy: 'id', data: signal([]) };
    runInInjectionContext(injector, () => composeTable(config, [withTeardown]));

    expect(destroyed).toEqual([]);

    injector.destroy();

    expect(destroyed).toEqual(['torn-down']);
  });

  it('gives each composition independent state', () => {
    const first = composeWithRows(makeRows(), []);
    const second = composeWithRows([], []);

    expect((first['rows'] as () => Row[])()).toHaveLength(2);
    expect((second['rows'] as () => Row[])()).toHaveLength(0);
  });

  describe('base store before the fold', () => {
    it('exposes the core members to a feature at factory time', () => {
      let renderRowIdsAtFactory: unknown;
      let countAtFactory: unknown;
      const withCoreReader: AnyTableFeature = (store) => {
        // Reading through the signals, not just checking they are functions — `trackBy` is a
        // bare function too, so `typeof` alone would not prove these are live computeds.
        renderRowIdsAtFactory = (
          store['renderRows'] as () => { id: string }[]
        )().map((row) => row.id);
        countAtFactory = (store['totalRowCount'] as () => number)();
        return {};
      };

      composeWithRows(makeRows(), [withCoreReader]);

      expect(renderRowIdsAtFactory).toEqual(['r1', 'r2']);
      expect(countAtFactory).toBe(2);
    });

    it('exposes indexById to a feature at factory time, mapping id to position', () => {
      let indexAtFactory: ReadonlyMap<RowId, number> | undefined;
      const withIndexReader: AnyTableFeature = (store) => {
        indexAtFactory = (
          store['indexById'] as () => ReadonlyMap<RowId, number>
        )();
        return {};
      };

      composeWithRows(makeRows(), [withIndexReader]);

      expect(indexAtFactory).toEqual(
        new Map([
          ['r1', 0],
          ['r2', 1],
        ])
      );
    });

    it('gives an internal feature the core handle, whose baseColumns is a live signal', () => {
      let baseColumnsAtFactory: unknown;
      const internalReadingCore: InternalFeature<Row> = (core) => {
        baseColumnsAtFactory = core.baseColumns();
        return {};
      };

      const data = signal(makeRows());
      const config: TableEngineConfig<Row> = { columns, trackBy: 'id', data };
      TestBed.runInInjectionContext(() =>
        composeTable(config, [], [internalReadingCore])
      );

      expect(baseColumnsAtFactory).toHaveLength(2);
    });

    it.each(CORE_MEMBER_KEYS)(
      'throws naming core and the feature position when a feature declares "%s"',
      (key) => {
        const withShadow: AnyTableFeature = () => ({
          members: { [key]: 'shadow' },
        });

        expect(() => compose([withShadow])).toThrow(
          new RegExp(`core and feature 1 both provide the "${key}" store member`)
        );
      }
    );

    it('lets a feature override totalRowCount (ADR-0005)', () => {
      const withVirtualCount: AnyTableFeature = () => ({
        members: { totalRowCount: signal(99) },
      });

      const store = composeWithRows(makeRows(), [withVirtualCount]);

      expect((store['totalRowCount'] as () => number)()).toBe(99);
    });

    it('folds internal features before consumer features', () => {
      const order: string[] = [];
      const marking = (tag: string): AnyTableFeature => () => {
        order.push(tag);
        return {};
      };

      compose([marking('consumer')], [marking('internal')]);

      expect(order).toEqual(['internal', 'consumer']);
    });

    it('does not let an internal feature shift consumer positions', () => {
      const inert: AnyTableFeature = () => ({});

      expect(() =>
        compose([taggingStage('sort', '-a'), taggingStage('sort', '-b')], [inert])
      ).toThrow(/feature 1 and feature 2 both provide the "sort" pipeline stage/);
    });

    it('names an internal feature as internal in a collision', () => {
      expect(() =>
        compose([taggingStage('sort', '-b')], [taggingStage('sort', '-a')])
      ).toThrow(
        /internal feature 1 and feature 1 both provide the "sort" pipeline stage/
      );
    });
  });

  describe('parentLink contribution (ADR-0028)', () => {
    it('resolves ctx.parentOf lazily, so a factory sees a link a later feature contributes', () => {
      const withParentOfReader: AnyTableFeature = (_store, ctx) => ({
        members: {
          parentOfRow: (row: Row) =>
            (ctx.parentOf as ParentLink<Row> | undefined)?.(row) ?? 'root',
        },
      });
      const withParentLink: AnyTableFeature = () => ({
        parentLink: asParentLink((row) => (row.id === 'r2' ? 'r1' : null)),
      });

      const store = composeWithRows(makeRows(), [withParentOfReader, withParentLink]);

      expect(makeRows().map(store['parentOfRow'] as (row: Row) => RowId)).toEqual([
        'root',
        'r1',
      ]);
    });

    it('leaves ctx.parentOf undefined when no feature contributes a parent link', () => {
      const withUnlinkedTag: AnyTableFeature = () => ({
        stages: asStages(
          stageSchema<Row>('pipeline', (s) =>
            stage(s.filter, {
              run: (rows: Row[], ctx) =>
                rows.map((row) => ({
                  ...row,
                  name: ctx.parentOf === undefined ? 'unlinked' : 'linked',
                })),
            })
          )
        ),
      });

      const store = composeWithRows(makeRows(), [withUnlinkedTag]);

      expect((store['rows'] as () => Row[])().map((row) => row.name)).toEqual([
        'unlinked',
        'unlinked',
      ]);
    });

    it('lets a pipeline stage resolve parents via a link another feature contributes', () => {
      const withParentTag: AnyTableFeature = () => ({
        stages: asStages(
          stageSchema<Row>('pipeline', (s) =>
            stage(s.filter, {
              run: (rows: Row[], ctx) =>
                rows.map((row) => ({
                  ...row,
                  name: `${row.name}<${ctx.parentOf?.(row) ?? 'root'}`,
                })),
            })
          )
        ),
      });
      const withParentLink: AnyTableFeature = () => ({
        parentLink: asParentLink((row) => (row.id === 'r2' ? 'r1' : null)),
      });

      const store = composeWithRows(makeRows(), [withParentTag, withParentLink]);

      expect((store['rows'] as () => Row[])().map((row) => row.name)).toEqual([
        'Charlie<root',
        'Ann<r1',
      ]);
    });

    it('passes the contributed parent link to render stages too', () => {
      const withParentAggregate: AnyTableFeature = () => ({
        renderStages: stageSchema('render', (s) =>
          stage(s.tree, {
            run: (nodes, ctx) =>
              nodes.map((node) => ({
                ...node,
                aggregates: { parent: ctx.parentOf?.(node.data) ?? 'none' },
              })),
          })
        ),
      });
      const withParentLink: AnyTableFeature = () => ({
        parentLink: asParentLink((row) => (row.id === 'r2' ? 'r1' : null)),
      });

      const store = composeWithRows(makeRows(), [withParentAggregate, withParentLink]);

      expect(
        (store['renderRows'] as () => { aggregates?: Record<string, unknown> }[])().map(
          (row) => row.aggregates?.['parent']
        )
      ).toEqual(['none', 'r1']);
    });

    it('throws naming both features when two contribute a parent link', () => {
      const withLinkA: AnyTableFeature = () => ({ parentLink: () => null });
      const withLinkB: AnyTableFeature = () => ({ parentLink: () => null });

      expect(() => compose([withLinkA, withLinkB])).toThrow(
        '[createTable] feature 1 and feature 2 both provide the parent link. ' +
          'Only one feature may provide a parent link.'
      );
    });

    it('still throws on a duplicate parent link when ngDevMode is false (ungated, like members)', () => {
      const previous = getNgDevMode();
      setNgDevMode(false);
      try {
        const withLinkA: AnyTableFeature = () => ({ parentLink: () => null });
        const withLinkB: AnyTableFeature = () => ({ parentLink: () => null });

        expect(() => compose([withLinkA, withLinkB])).toThrow(
          '[createTable] feature 1 and feature 2 both provide the parent link. ' +
            'Only one feature may provide a parent link.'
        );
      } finally {
        setNgDevMode(previous);
      }
    });
  });

  describe('onRowsRemoved (ADR-0006)', () => {
    function composeWithData(
      data: ReturnType<typeof signal<Row[]>>,
      onRowsRemoved: (ids: readonly RowId[]) => void
    ): void {
      const withReconciler: AnyTableFeature = () => ({ onRowsRemoved });
      const config: TableEngineConfig<Row> = { columns, trackBy: 'id', data };
      TestBed.runInInjectionContext(() => composeTable(config, [withReconciler]));
    }

    it('fires with the diffed ids when data.update(...) drops a row', () => {
      const data = signal(makeRows());
      const removed: RowId[][] = [];
      composeWithData(data, (ids) => removed.push([...ids]));

      data.update((rows) => rows.filter((row) => row.id !== 'r1'));
      TestBed.tick();

      expect(removed).toEqual([['r1']]);
    });

    it('fires on a direct data.set(...) full replacement', () => {
      const data = signal(makeRows());
      const removed: RowId[][] = [];
      composeWithData(data, (ids) => removed.push([...ids]));

      data.set([{ id: 'r3', name: 'New', age: 1 }]);
      TestBed.tick();

      expect(removed).toEqual([['r1', 'r2']]);
    });

    it('does not fire when no composed feature declares onRowsRemoved', () => {
      const data = signal(makeRows());
      const config: TableEngineConfig<Row> = { columns, trackBy: 'id', data };
      // No onRowsRemoved hook composed — the effect should never be created, so mutating
      // `data` afterward must not throw or do anything observable here.
      TestBed.runInInjectionContext(() => composeTable(config, []));

      expect(() => {
        data.set([]);
        TestBed.tick();
      }).not.toThrow();
    });

    it('does not fire when a data change only adds rows', () => {
      const data = signal(makeRows());
      const removed: RowId[][] = [];
      composeWithData(data, (ids) => removed.push([...ids]));

      data.update((rows) => [...rows, { id: 'r3', name: 'New', age: 1 }]);
      TestBed.tick();

      expect(removed).toEqual([]);
    });
  });
});
