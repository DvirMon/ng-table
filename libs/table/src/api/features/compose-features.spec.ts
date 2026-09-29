import {
  computed,
  createEnvironmentInjector,
  EnvironmentInjector,
  Injector,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { VISIBLE } from '../../engine/columns';
import type { Feature, Shape, TableFeatureSpec } from '../../engine/types';
import { stage } from '../../schema/stage-rules';
import { stageSchema } from '../../schema/stage-schema';
import { mockRows, mockTrackBy, noData, type MockRow } from '../../table.mock';
import { createColumns } from '../create-columns';
import { createTable } from '../create-table';
import { createTableFeature } from '../create-table-feature';
import type {
  AnyTableFeature,
  ColumnDecl,
  ColumnSet,
  ReadonlyStore,
  RowId,
  TableStore,
} from '../types';
import { composeFeatures } from './compose-features';
import { withComputed } from './with-computed';

type Store = TableStore<MockRow>;
type WithA = { a: Signal<number> };
type WithB = { b: Signal<string> };
type WithC = { c: Signal<string> };
type WithZ = { z: Signal<number> };
type NoMembers = Record<never, never>;

// Widened `TId` (plain `string`) — no `path.<id>` usage in this file.
function makeColumns(): ColumnSet<MockRow, readonly ColumnDecl<MockRow, string, unknown>[]> {
  return createColumns(noData<MockRow>(), (col) => [col('name'), col('id')]);
}

/** Collision messages are matched by `displayName`, so every fixture below carries one. */
function named<In extends Shape, Out extends object>(
  displayName: string,
  feature: Feature<In, Out>
): Feature<In, Out> {
  return Object.assign(feature, { displayName });
}

/** Overload set for `makeStore`, mirroring `createTable`'s own per-arity typing so each call
 * site keeps full member inference instead of widening rest features to `AnyTableFeature[]`.
 * Copied from `with-computed.spec.ts`, extended to three slots. */
interface MakeStore {
  <O1 extends object>(data: WritableSignal<MockRow[]>, f1: Feature<Store, O1>): Store & O1;
  <O1 extends object, O2 extends object>(
    data: WritableSignal<MockRow[]>,
    f1: Feature<Store, O1>,
    f2: Feature<Store & O1, O2>
  ): Store & O1 & O2;
  <O1 extends object, O2 extends object, O3 extends object>(
    data: WritableSignal<MockRow[]>,
    f1: Feature<Store, O1>,
    f2: Feature<Store & O1, O2>,
    f3: Feature<Store & O1 & O2, O3>
  ): Store & O1 & O2 & O3;
}

/** `createTable`'s per-arity overloads match no spread call, so the runtime forward goes
 * through this variadic view of the same function — the static/dynamic seam `create-table.ts`
 * bridges the same way internally. `MakeStore` is what callers type against. */
type CreateTableVariadic = (
  data: WritableSignal<MockRow[]>,
  config: {
    trackBy: typeof mockTrackBy;
    columns: ColumnSet<MockRow, readonly ColumnDecl<MockRow, string, unknown>[]>;
    injector?: Injector;
  },
  ...features: AnyTableFeature[]
) => Store;

function composeWith(
  data: WritableSignal<MockRow[]>,
  injector: Injector | undefined,
  features: readonly AnyTableFeature[]
): Store {
  const config = { trackBy: mockTrackBy, columns: makeColumns(), injector };
  const call = (): Store =>
    (createTable as unknown as CreateTableVariadic)(data, config, ...features);
  return injector ? call() : TestBed.runInInjectionContext(call);
}

const makeStore = ((data: WritableSignal<MockRow[]>, ...features: AnyTableFeature[]): Store =>
  composeWith(data, undefined, features)) as MakeStore;

/** Same composition, but under a throwaway injector the test can destroy — the only way to
 * observe `onDestroy` (prior art: `compose-table.spec.ts`). */
function makeStoreIn(
  injector: Injector,
  data: WritableSignal<MockRow[]>,
  ...features: AnyTableFeature[]
): Store {
  return composeWith(data, injector, features);
}

// --- member fixtures ---------------------------------------------------------------------

/** The un-wrapped factory, needed standalone for the trailing-derive-block placement (case 14). */
function fAFactory(input: Store): TableFeatureSpec<MockRow, WithA> {
  return { members: { a: computed(() => input.rows().length * 10) } };
}

/** Contributes `a` — row count * 10. */
function fA(): Feature<Store, WithA> {
  return named('fA', createTableFeature(fAFactory));
}

/** A second claimant of `a`, typed as if `a` were already present — the inner-collision fixture. */
function fA2(): Feature<Store & WithA, WithA> {
  return named(
    'fA2',
    createTableFeature((): TableFeatureSpec<MockRow, WithA> => ({ members: { a: signal(0) } }))
  );
}

/** Contributes `b`, derived from an earlier feature's `a` — proves inner features see what
 * folded before them, inner or outer. */
function fBAfterA(): Feature<Store & WithA, WithB> {
  return named(
    'fBAfterA',
    createTableFeature((input: Store & WithA) => ({ members: { b: computed(() => `b:${input.a()}`) } }))
  );
}

/** Reads `a` and `b` **at factory time** — the visibility assertion, not a deferred read. */
function fReadsAB(): Feature<Store & WithA & WithB, WithC> {
  return named(
    'fReadsAB',
    createTableFeature((input: Store & WithA & WithB) => {
      const seenAtFactoryTime = `${input.a()}/${input.b()}`;
      return { members: { c: computed(() => seenAtFactoryTime) } };
    })
  );
}

/** A following slot that must see everything a nested composite contributed. */
function fSeesAll(): Feature<Store & WithA & WithB & WithC, { all: Signal<string> }> {
  return named(
    'fSeesAll',
    createTableFeature((input: Store & WithA & WithB & WithC) => ({
      members: { all: computed(() => `${input.a()}|${input.b()}|${input.c()}`) },
    }))
  );
}

/** Contributes `z` from a slot after the composite — the later-outer-slot fixture. */
function fZ(): Feature<Shape, WithZ> {
  return named(
    'fZ',
    createTableFeature((): TableFeatureSpec<unknown, WithZ> => ({ members: { z: signal(99) } }))
  );
}

/** Declares `lazy` as a **deferred** read of `z`, which only a later outer slot supplies. */
function fLazy(): Feature<Store, { lazy: Signal<number> }> {
  return named(
    'fLazy',
    createTableFeature((input: Store) => {
      // Runtime-only visibility: `z` lands in a later outer slot, so the static type cannot
      // see it (types are stricter than runtime). Same bridge `compose-table.spec.ts` uses.
      const deferred = input as Store & WithZ;
      return { members: { lazy: computed(() => deferred.z()) } };
    })
  );
}

/** Shadows the core `rows` member — the core-key collision fixture. */
function fShadowsRows(): Feature<Store, { rows: Signal<MockRow[]> }> {
  return named(
    'fShadowsRows',
    createTableFeature(
      (): TableFeatureSpec<MockRow, { rows: Signal<MockRow[]> }> => ({
        members: { rows: signal<MockRow[]>([]) },
      })
    )
  );
}

/** A factory that throws while declaring — the unwrapped-propagation fixture. */
function fThrows(): Feature<Store, NoMembers> {
  return named(
    'fThrows',
    createTableFeature((): TableFeatureSpec<MockRow, NoMembers> => {
      throw new Error('inner factory blew up');
    })
  );
}

// --- pipeline / render / column fixtures -------------------------------------------------

/** Positional filter — keeps the first two rows, so fold order is observable against a sort. */
function fFilterFirstTwo(displayName = 'fFilterFirstTwo'): Feature<Store, NoMembers> {
  return named(
    displayName,
    createTableFeature(
      (): TableFeatureSpec<MockRow, NoMembers> => ({
        stages: stageSchema<MockRow>('pipeline', (s) =>
          stage(s.filter, { run: (rows) => rows.slice(0, 2) })
        ),
      })
    )
  );
}

function fSortByNameDesc(): Feature<Store, NoMembers> {
  return named(
    'fSortByNameDesc',
    createTableFeature(
      (): TableFeatureSpec<MockRow, NoMembers> => ({
        stages: stageSchema<MockRow>('pipeline', (s) =>
          stage(s.sort, {
            run: (rows) => [...rows].sort((left, right) => right.name.localeCompare(left.name)),
          })
        ),
      })
    )
  );
}

function fGroupRenderStage(displayName: string): Feature<Store, NoMembers> {
  return named(
    displayName,
    createTableFeature(
      (): TableFeatureSpec<MockRow, NoMembers> => ({
        renderStages: stageSchema<MockRow>('render', (s) => stage(s.group, { run: (rows) => rows })),
      })
    )
  );
}

function fHidesColumn(columnId: string, displayName: string): Feature<Store, NoMembers> {
  return named(
    displayName,
    createTableFeature(
      (): TableFeatureSpec<MockRow, NoMembers> => ({
        columnRules: [{ columnId, key: VISIBLE, result: signal(false).asReadonly() }],
      })
    )
  );
}

/** Links row id 2 (Bea) under row id 1 (Ada) — the composable `parentLink` fixture
 * (#166 step 3, seams A-D). */
function fParentLink(displayName: string): Feature<Store, NoMembers> {
  return named(
    displayName,
    createTableFeature(
      (): TableFeatureSpec<MockRow, NoMembers> => ({
        parentLink: (row) => (row.id === 2 ? 1 : null),
      })
    )
  );
}

/** Keeps only rows `ctx.parentOf` resolves to a non-null id — a dropped link shows as `[]`
 * instead of passing silently (#166 step 3, seams A-D). */
function fKeepsLinkedRows(displayName: string): Feature<Store, NoMembers> {
  return named(
    displayName,
    createTableFeature(
      (): TableFeatureSpec<MockRow, NoMembers> => ({
        stages: stageSchema<MockRow>('pipeline', (s) =>
          stage(s.filter, {
            run: (rows, ctx) => rows.filter((row) => ctx.parentOf?.(row) != null),
          })
        ),
      })
    )
  );
}

/** Reads `ctx.parentOf` from a factory-received `ctx`, lazily inside a `computed()` — a
 * dropped or copied-early `ctx` shows as `null` instead of a resolved parent id
 * (#170 step 1, seam B). */
function fReadsParentOf(
  displayName: string
): Feature<Store, { parentIds: Signal<(RowId | null)[]> }> {
  return named(
    displayName,
    createTableFeature((input: Store, ctx) => ({
      members: {
        parentIds: computed(() => input.rows().map((row) => ctx.parentOf?.(row) ?? null)),
      },
    }))
  );
}

/** Nests row id 2 under row id 1 via the `'tree'` render stage — mimics a synthesizing
 * feature nesting one row beneath another. `parentId` isn't a settable `RenderNode`
 * field; see ADR-0023. */
function fParentsSecondRow(displayName: string): Feature<Store, NoMembers> {
  return named(
    displayName,
    createTableFeature(
      (): TableFeatureSpec<MockRow, NoMembers> => ({
        renderStages: stageSchema<MockRow>('render', (s) =>
          stage(s.tree, {
            run: (nodes) => {
              const byId = new Map(nodes.map((node) => [node.id, node]));
              const row1 = byId.get(1);
              const row2 = byId.get(2);
              if (!row1 || !row2) {
                throw new Error('expected seeded nodes 1/2 to be present');
              }
              return nodes
                .filter((node) => node.id !== 2)
                .map((node) => (node.id === 1 ? { ...row1, children: [row2] } : node));
            },
          })
        ),
      })
    )
  );
}

/** Reads the running `trail` a render fixture has appended to so far — mirrors
 * `compose-table.spec.ts`'s helper of the same name (#155 step 2, seam E). */
function trailOf(node: { aggregates?: Record<string, unknown> }): string {
  return (node.aggregates?.['trail'] as string | undefined) ?? '';
}

/** Claims the outer `'tree'` render anchor, appending `'tree>'` to every node's
 * `aggregates.trail` — the outer claimant seam E's declared stage must run after. */
function fTreeTrail(displayName: string): Feature<Store, NoMembers> {
  return named(
    displayName,
    createTableFeature(
      (): TableFeatureSpec<MockRow, NoMembers> => ({
        renderStages: stageSchema<MockRow>('render', (s) =>
          stage(s.tree, {
            run: (nodes) =>
              nodes.map((node) => ({
                ...node,
                aggregates: { ...(node.aggregates ?? {}), trail: `${trailOf(node)}tree>` },
              })),
          })
        ),
      })
    )
  );
}

/** `'pin'` below only typechecks because `../../schema/stage-schema.types.spec.ts` merges it
 * into `RenderStageRegistry`. */

/** Declares a render stage named `'pin'`, anchored `after` `'tree'`, inside a composite —
 * appends `'pin>'` to `aggregates.trail` (#155 step 2, seam E). */
function fPinAfterTree(displayName: string): Feature<Store, NoMembers> {
  return named(
    displayName,
    createTableFeature(
      (): TableFeatureSpec<MockRow, NoMembers> => ({
        renderStages: stageSchema<MockRow>('render', (s) =>
          stage(s.tree, {
            name: 'pin',
            placement: 'after',
            run: (nodes) =>
              nodes.map((node) => ({
                ...node,
                aggregates: { ...(node.aggregates ?? {}), trail: `${trailOf(node)}pin>` },
              })),
          })
        ),
      })
    )
  );
}

function fExpandedRows(ids: readonly RowId[], displayName: string): Feature<Store, NoMembers> {
  return named(
    displayName,
    createTableFeature(
      (): TableFeatureSpec<MockRow, NoMembers> => ({
        expandedRows: signal(new Set<RowId>(ids)).asReadonly(),
      })
    )
  );
}

function fContextRows(
  source: Signal<ReadonlySet<RowId>>,
  displayName: string
): Feature<Store, NoMembers> {
  return named(
    displayName,
    createTableFeature(
      (): TableFeatureSpec<MockRow, NoMembers> => ({ contextRows: source })
    )
  );
}

function contextRowIds(store: Store): readonly RowId[] {
  return store
    .renderRows()
    .filter((row) => row.isContextRow)
    .map((row) => row.id);
}

// --- hook fixtures -----------------------------------------------------------------------

function fSetup(label: string, order: string[]): Feature<Store, NoMembers> {
  return named(
    label,
    createTableFeature(
      (_input: Store): TableFeatureSpec<MockRow, NoMembers> => ({ setup: () => order.push(label) })
    )
  );
}

/** A `setup` reading a member only a later outer slot supplies — setup runs after the whole fold. */
function fSetupReadsZ(seen: { value?: number }): Feature<Store, NoMembers> {
  return named(
    'fSetupReadsZ',
    createTableFeature((input: Store): TableFeatureSpec<MockRow, NoMembers> => {
      const deferred = input as Store & WithZ;
      return {
        setup: () => {
          seen.value = deferred.z();
        },
      };
    })
  );
}

function fDestroy(label: string, destroyed: string[]): Feature<Shape, NoMembers> {
  return named(
    label,
    createTableFeature(
      (): TableFeatureSpec<unknown, NoMembers> => ({ onDestroy: () => destroyed.push(label) })
    )
  );
}

function fRowsRemoved(label: string, seen: string[]): Feature<Shape, NoMembers> {
  return named(
    label,
    createTableFeature(
      (): TableFeatureSpec<unknown, NoMembers> => ({
        onRowsRemoved: (ids: readonly RowId[]) => seen.push(`${label}:${ids.join(',')}`),
      })
    )
  );
}

describe('composeFeatures', () => {
  describe('visibility', () => {
    it('case 1 — a following slot sees the whole composite at factory time', () => {
      const data = signal([...mockRows]);

      const store = makeStore(data, composeFeatures(fA(), fBAfterA()), fReadsAB());

      expect(store.a()).toBe(30);
      expect(store.b()).toBe('b:30');
      expect(store.c()).toBe('30/b:30');
    });

    it('case 2 — an inner feature sees earlier inner features and the slot before the composite', () => {
      const data = signal([...mockRows]);

      const store = makeStore(data, fA(), composeFeatures(fBAfterA(), fReadsAB()));

      expect(store.b()).toBe('b:30');
      expect(store.c()).toBe('30/b:30');
    });

    it('case 3 — a deferred read inside a composite resolves a later outer slot’s member', () => {
      const data = signal([...mockRows]);

      const store = makeStore(data, composeFeatures(fLazy()), fZ());

      expect(store.lazy()).toBe(99);
    });

    it('case 4 — a composite inside a composite composes, and a following slot sees all three', () => {
      const data = signal([...mockRows]);

      const store = makeStore(
        data,
        composeFeatures(fA(), composeFeatures(fBAfterA(), fReadsAB())),
        fSeesAll()
      );

      expect(store.c()).toBe('30/b:30');
      expect(store.all()).toBe('30|b:30|30/b:30');
    });

    it('case 5 — a composed member recomputes when the data signal changes', () => {
      const data = signal([...mockRows]);
      const store = makeStore(data, composeFeatures(fA(), fBAfterA()));

      expect(store.a()).toBe(30);

      data.set([...mockRows, { id: 4, name: 'Dee' }]);

      expect(store.a()).toBe(40);
      expect(store.b()).toBe('b:40');
    });
  });

  describe('construction errors', () => {
    it('case 6 — two inner features claiming the same member name both inner positions', () => {
      const attempt = () => makeStore(signal([...mockRows]), composeFeatures(fA(), fA2()));

      expect(attempt).toThrow(
        /composeFeatures inner feature 1 \(fA\) and composeFeatures inner feature 2 \(fA2\) both provide the "a" store member/
      );
    });

    it('case 7 — two inner features claiming the same pipeline stage name both inner positions', () => {
      const attempt = () =>
        makeStore(
          signal([...mockRows]),
          composeFeatures(fFilterFirstTwo(), fFilterFirstTwo('fFilterOdd'))
        );

      expect(attempt).toThrow(
        /composeFeatures inner feature 1 \(fFilterFirstTwo\) and composeFeatures inner feature 2 \(fFilterOdd\) both provide the "filter" pipeline stage/
      );
    });

    it('case 8 — two inner features claiming the same render stage name both inner positions', () => {
      const attempt = () =>
        makeStore(
          signal([...mockRows]),
          composeFeatures(fGroupRenderStage('fGroupA'), fGroupRenderStage('fGroupB'))
        );

      expect(attempt).toThrow(
        /composeFeatures inner feature 1 \(fGroupA\) and composeFeatures inner feature 2 \(fGroupB\) both provide the "group" render stage/
      );
    });

    it('case 9 — an inner feature shadowing a core member names core and the inner position', () => {
      const attempt = () => makeStore(signal([...mockRows]), composeFeatures(fShadowsRows()));

      expect(attempt).toThrow(
        /core and composeFeatures inner feature 1 \(fShadowsRows\) both provide the "rows" store member/
      );
    });

    it('case 10 — a cross-boundary collision is named by the outer registry', () => {
      const attempt = () => makeStore(signal([...mockRows]), fA(), composeFeatures(fA2()));

      expect(attempt).toThrow(
        /feature 1 \(fA\) and feature 2 \(composeFeatures\) both provide the "a" store member/
      );
    });

    it('case 10b — a cross-boundary collision on a pipeline stage is named by the outer registry', () => {
      const attempt = () =>
        makeStore(
          signal([...mockRows]),
          fFilterFirstTwo('fOuterFilter'),
          composeFeatures(fFilterFirstTwo())
        );

      expect(attempt).toThrow(
        /feature 1 \(fOuterFilter\) and feature 2 \(composeFeatures\) both provide the "filter" pipeline stage/
      );
    });

    it('case 11 — an inner feature’s own construction error propagates unwrapped', () => {
      const attempt = () => makeStore(signal([...mockRows]), composeFeatures(fThrows()));

      expect(attempt).toThrow('inner factory blew up');
    });
  });

  describe('merge', () => {
    it('case 12 — stages from two inner features both apply, in anchor order not inner order', () => {
      const data = signal([...mockRows]);

      // Inner order is sort-then-filter; `PIPELINE_ANCHORS` runs filter first, so the first two
      // rows survive and are then reversed. Sort-first would have yielded ['Cid', 'Bea'].
      const store = makeStore(data, composeFeatures(fSortByNameDesc(), fFilterFirstTwo()));

      expect(store.rows().map((row) => row.name)).toEqual(['Bea', 'Ada']);
    });

    it('case 13 — column rules from two inner features both apply', () => {
      const data = signal([...mockRows]);

      const store = makeStore(
        data,
        composeFeatures(fHidesColumn('name', 'fHidesName'), fHidesColumn('id', 'fHidesId'))
      );

      const columns = store.columns();
      expect(columns.find((column) => column.id === 'name')?.visible).toBe(false);
      expect(columns.find((column) => column.id === 'id')?.visible).toBe(false);
    });

    it('case 14 — a composite works as a trailing derive block (empty spec keys stay absent)', () => {
      const feature = createTableFeature(
        fAFactory,
        composeFeatures(
          withComputed((store: ReadonlyStore<Store & WithA>) => ({
            twice: computed(() => store.a() * 2),
          })),
          withComputed((store: ReadonlyStore<Store & WithA & { twice: Signal<number> }>) => ({
            thrice: computed(() => store.a() * 3),
          }))
        )
      );

      const store = makeStore(signal([...mockRows]), feature);

      expect(store.a()).toBe(30);
      expect(store.twice()).toBe(60);
      expect(store.thrice()).toBe(90);
    });
  });

  describe('expandedRows (ADR-0017)', () => {
    it('case 18 — an inner expandedRows contribution reaches the outer engine\'s flatten', () => {
      const data = signal([...mockRows]);

      // Row 2 is parented under row 1, but nothing is contributed as expanded — the outer
      // engine's `flattenVisible` walk should hide it. If `foldInnerFeatures` dropped the inner
      // `expandedRows` contribution (the ADR-0017 regression this guards), the composite would
      // register no contributor at all and every row would stay visible, wrongly keeping row 2.
      const store = makeStore(
        data,
        composeFeatures(fParentsSecondRow('fParentsSecondRow'), fExpandedRows([99], 'fExpandedRows'))
      );

      expect(store.renderRows().map((row) => row.id)).toEqual([1, 3]);
    });

    it('case 19 — the composite\'s union includes the parent id, so the child survives', () => {
      const data = signal([...mockRows]);

      const store = makeStore(
        data,
        composeFeatures(fParentsSecondRow('fParentsSecondRow'), fExpandedRows([1], 'fExpandedRows'))
      );

      expect(store.renderRows().map((row) => row.id)).toEqual([1, 2, 3]);
    });
  });

  describe('contextRows (#168)', () => {
    it('case 25 — an inner contextRows contribution reaches the outer engine\'s stamping', () => {
      const store = makeStore(
        signal([...mockRows]),
        composeFeatures(fContextRows(signal<ReadonlySet<RowId>>(new Set([2])), 'fContext'))
      );

      expect(contextRowIds(store)).toEqual([2]);
    });

    it('case 26 — two inner contextRows contributions union into one composite set', () => {
      const store = makeStore(
        signal([...mockRows]),
        composeFeatures(
          fContextRows(signal<ReadonlySet<RowId>>(new Set([1])), 'fCtxA'),
          fContextRows(signal<ReadonlySet<RowId>>(new Set([3])), 'fCtxB')
        )
      );

      expect(contextRowIds(store)).toEqual([1, 3]);
    });

    it('case 27 — the composite contextRows recomputes when an inner source changes', () => {
      const ctx = signal<ReadonlySet<RowId>>(new Set([2]));
      const store = makeStore(
        signal([...mockRows]),
        composeFeatures(fContextRows(ctx, 'fContext'))
      );

      expect(contextRowIds(store)).toEqual([2]);

      ctx.set(new Set([3]));

      expect(contextRowIds(store)).toEqual([3]);
    });
  });

  describe('declared stages (#155)', () => {
    it('case 20 — a declared stage inside a composite runs in resolved order', () => {
      const data = signal([...mockRows]);

      expect(() =>
        makeStore(data, fTreeTrail('fOuterTree'), composeFeatures(fPinAfterTree('fPin')))
      ).not.toThrow();

      const store = makeStore(
        signal([...mockRows]),
        fTreeTrail('fOuterTree'),
        composeFeatures(fPinAfterTree('fPin'))
      );

      for (const row of store.renderRows()) {
        expect(trailOf(row as { aggregates?: Record<string, unknown> })).toBe('tree>pin>');
      }
    });
  });

  describe('parentLink (ADR-0028, #166 step 3)', () => {
    it('case 21 — an inner parentLink reaches an outer stage through ctx.parentOf', () => {
      const data = signal([...mockRows]);

      const store = makeStore(
        data,
        composeFeatures(fParentLink('fLink')),
        fKeepsLinkedRows('fOuterFilter')
      );

      expect(store.rows().map((row) => row.name)).toEqual(['Bea']);
    });

    it('case 22 — two inner parentLink contributions throw, naming both inner positions', () => {
      const attempt = () =>
        makeStore(
          signal([...mockRows]),
          composeFeatures(fParentLink('fLinkA'), fParentLink('fLinkB'))
        );

      expect(attempt).toThrow(
        /composeFeatures inner feature 1 \(fLinkA\) and composeFeatures inner feature 2 \(fLinkB\) both provide the parent link/
      );
    });

    it('case 23 — an inner parentLink clashing with an outer one is named by the outer registry', () => {
      const attempt = () =>
        makeStore(
          signal([...mockRows]),
          fParentLink('fOuterLink'),
          composeFeatures(fParentLink('fInnerLink'))
        );

      expect(attempt).toThrow(
        /feature 1 \(fOuterLink\) and feature 2 \(composeFeatures\) both provide the parent link/
      );
    });

    it('case 24 — a composite without a parentLink leaves the key absent, so an outer link is not a clash', () => {
      const store = makeStore(
        signal([...mockRows]),
        fParentLink('fOuterLink'),
        composeFeatures(fKeepsLinkedRows('fInnerFilter'))
      );

      expect(store.rows().map((row) => row.name)).toEqual(['Bea']);
    });
  });

  describe('stage context (#170 step 1)', () => {
    it('case 25 — an inner feature receives the outer ctx, resolving a later outer slot’s link', () => {
      const store = makeStore(
        signal([...mockRows]),
        composeFeatures(fReadsParentOf('fReader')),
        fParentLink('fOuterLink')
      );

      expect(store.parentIds()).toEqual([null, 1, null]);
    });
  });

  describe('hooks', () => {
    it('case 15 — every inner setup runs, after the whole fold is composed', () => {
      const order: string[] = [];
      const seen: { value?: number } = {};
      const data = signal([...mockRows]);

      makeStore(
        data,
        composeFeatures(fSetup('s1', order), fSetup('s2', order), fSetupReadsZ(seen)),
        fZ()
      );

      expect(order).toEqual(['s1', 's2']);
      expect(seen.value).toBe(99);
    });

    it('case 16 — every inner onDestroy runs when the owning injector is destroyed', () => {
      const destroyed: string[] = [];
      const injector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));

      makeStoreIn(
        injector,
        signal([...mockRows]),
        composeFeatures(fDestroy('d1', destroyed), fDestroy('d2', destroyed))
      );

      expect(destroyed).toEqual([]);

      injector.destroy();

      expect(destroyed).toEqual(['d1', 'd2']);
    });

    it('case 17 — every inner onRowsRemoved fires with the removed ids', () => {
      const seen: string[] = [];
      const data = signal([...mockRows]);

      makeStore(data, composeFeatures(fRowsRemoved('r1', seen), fRowsRemoved('r2', seen)));

      data.update((rows) => rows.filter((row) => row.id !== 1));
      TestBed.tick();

      expect(seen).toEqual(['r1:1', 'r2:1']);
    });
  });
});
