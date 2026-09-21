# Step 1 — `withTree()`: the feature, the conditional `'tree'` stage and `state()`

**PR scope:** standalone. Ships alone — `withTree()` is additive and
`with-expansion.ts` is not touched, so nothing else has to move with
it. Deliberately one PR: every candidate split of this file leaves
module-private helpers with no caller.

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/api/features/with-tree.ts` (new)
- `libs/table/src/index.ts` (edit)

## Why This Step Exists

An app developer with hierarchical records has no way to say "these
are the children" that is separable from a detail panel. Today's
`withExpansion()` fuses both: one config, one open-id set, one
unconditional `'tree'` render-stage claim. `withTree()` is the row-tree
half, shipped first and additively so the panel can narrow later
(#121) without the two landing as one breaking change.

Contract: [ADR-0012](../../../../../../../adr/0012-split-expansion-into-panel-and-tree.md).
Types and behavior: [`3-architecture.md`](../../3-architecture.md)
§Types, §"The `'tree'` stage", §"Accessor failure". Verb semantics:
[`1-decisions.md`](../../1-decisions.md) D7.

## What To Do

Create `libs/table/src/api/features/with-tree.ts`.

### 1. Imports and re-export

```ts
import { computed, type Signal } from '@angular/core';
import type { Observable } from 'rxjs';
import { mapNodes, type RenderNode, type RenderNodeTransform } from '../../engine/render-stages';
import type { Feature, RowOf, TableFeatureSpec } from '../../engine/types';
import { createTableFeature } from '../create-table-feature';
import type { DerivedDict, RowId, TableStore, TrackByFn } from '../types';
import {
  createExpansionStore,
  type ExpansionChange,
  type ExpansionWriteOptions,
} from './expansion/state';

export type { ExpansionChange, ExpansionWriteOptions } from './expansion/state';
```

`ExpansionChange` is `{ added: readonly RowId[]; removed: readonly RowId[] }`
— **E18**, decided after this issue's body was written. `changed` emits
**once per write**, not once per id. #118 owns that type and that
emission rule; this step consumes them.

### 2. Public types

```ts
export interface WithTreeConfig<TRow> {
  /** Reads a row's nested children. Omitted: collapse-only — no row tree, and the
   *  `'tree'` render stage is not claimed. There is no `row.children` fallback (D2/E6). */
  childrenAccessor?: (row: TRow) => TRow[] | undefined;
  /** Renders the toggle independently of whether children are loaded — lazy children.
   *  Default: the accessor returned a non-empty array. */
  isExpandable?: (row: TRow) => boolean;
  /** Seeds the open set at construction. Emits nothing on `changed`. */
  initial?: readonly RowId[];
}

export interface TreeSlice {
  (): ReadonlySet<RowId>;
  /** One emission per write, carrying the whole symmetric difference (E18). */
  readonly changed: Observable<ExpansionChange>;
  /** `'all'` when every expandable row is open, `'none'` when none is — including
   *  "nothing is expandable", which is what a collapse-only instance always reads. */
  readonly state: Signal<'all' | 'some' | 'none'>;
  toggle(id: RowId, options?: ExpansionWriteOptions): void;
  /** Adds. Omitted `ids`: every expandable row found by the discovery walk. */
  expand(ids?: readonly RowId[], options?: ExpansionWriteOptions): void;
  /** Removes. Omitted `ids`: everything currently open. */
  collapse(ids?: readonly RowId[], options?: ExpansionWriteOptions): void;
  /** Atomic replace — the restore path. */
  set(ids: readonly RowId[], options?: ExpansionWriteOptions): void;
}

export interface TreeMembers {
  readonly tree: TreeSlice;
}

/** The slice of the store this feature reads, F-bounded so a factory body gets
 *  `input.rows(): RowOf<In>[]` with no cast. */
type TreeInput<In> = Pick<TableStore<RowOf<In>>, 'rows' | 'trackBy'>;
```

Keep the `'all' | 'some' | 'none'` union inline. It has one consumer
and needs no name of its own.

### 3. The ADR-0014 guards

Mirror `engine/grouping/render.ts`'s `reportAggregateError` and
`with-sorting.ts`'s `guardCompare` — same `console.error` + eslint
exemption shape.

```ts
interface ReportFlag {
  done: boolean;
}

function reportChildrenAccessorError(error: unknown): void {
  // eslint-disable-next-line no-console -- ADR-0014: floor reporting mechanism, no existing
  // runtime-degradation logging abstraction to reuse in this codebase yet.
  console.error(
    '[withTree] childrenAccessor threw. The affected row(s) render without children for ' +
      'this evaluation.',
    error
  );
}

function reportIsExpandableError(error: unknown): void {
  // eslint-disable-next-line no-console -- ADR-0014: see above.
  console.error(
    '[withTree] isExpandable threw. The affected row(s) render without a toggle for this ' +
      'evaluation.',
    error
  );
}

function guardChildren<TRow>(
  accessor: (row: TRow) => TRow[] | undefined,
  reported: ReportFlag
): (row: TRow) => TRow[] | undefined {
  return (row) => {
    try {
      return accessor(row);
    } catch (error) {
      if (!reported.done) {
        reported.done = true;
        reportChildrenAccessorError(error);
      }
      return undefined;
    }
  };
}

function guardIsExpandable<TRow>(
  isExpandable: (row: TRow) => boolean,
  reported: ReportFlag
): (row: TRow) => boolean {
  return (row) => {
    try {
      return isExpandable(row);
    } catch (error) {
      if (!reported.done) {
        reported.done = true;
        reportIsExpandableError(error);
      }
      return false;
    }
  };
}
```

### 4. Per-evaluation callback resolution

```ts
interface TreeCallbacks<TRow> {
  readChildren: (row: TRow) => TRow[] | undefined;
  canExpand: (row: TRow) => boolean;
}

/** One call per evaluation — per `renderRows()` run, per `expand()` walk, per `state()`
 *  read. Each callback gets its own dedupe flag, so a throwing accessor never mutes the
 *  `isExpandable` report. Never hoist the flags to module scope: that reports once per
 *  process instead of once per evaluation (ADR-0014). */
function resolveCallbacks<TRow>(config: WithTreeConfig<TRow>): TreeCallbacks<TRow> {
  const childrenReported: ReportFlag = { done: false };
  const expandableReported: ReportFlag = { done: false };

  const readChildren = config.childrenAccessor
    ? guardChildren(config.childrenAccessor, childrenReported)
    : (): TRow[] | undefined => undefined;

  const canExpand = config.isExpandable
    ? guardIsExpandable(config.isExpandable, expandableReported)
    : (row: TRow): boolean => hasNonEmptyChildren(readChildren(row));

  return { readChildren, canExpand };
}
```

The default `canExpand` closes over the **guarded** `readChildren`, so
an accessor throw resolves to `undefined` → `hasNonEmptyChildren` →
`false`. No chevron, one report, and no second report from the default
predicate.

### 5. The relocated stage machinery

Copy `hasNonEmptyChildren`, `toChildNode`, `buildTreeStage` and
`collectExpandableRowIds` from `with-expansion.ts` unchanged in shape.
`defaultChildrenAccessor` and `hasChildrenField` are **not** copied —
they are the `row.children` fallback D2/E6 removes.

Two changes against the originals: the callbacks arrive already
guarded, and `buildTreeStage` mints them inside the returned transform
rather than taking them as parameters.

```ts
function hasNonEmptyChildren<TRow>(children: TRow[] | undefined): children is TRow[] {
  return !!children && children.length > 0;
}

// Wraps a raw `TRow` child, recursively, as a nested `RenderNode` — the shape `mapNodes`
// expects, not a sibling to be flattened later.
function toChildNode<TRow>(
  row: TRow,
  trackBy: TrackByFn<TRow>,
  readChildren: (row: TRow) => TRow[] | undefined,
  canExpand: (row: TRow) => boolean
): RenderNode<TRow> {
  const children = readChildren(row);
  return {
    id: trackBy(row),
    kind: 'row',
    data: row,
    hasChildren: canExpand(row),
    children: hasNonEmptyChildren(children)
      ? children.map((child) => toChildNode(child, trackBy, readChildren, canExpand))
      : [],
  };
}

/**
 * The `'tree'` render stage. Passes a node a preceding stage already synthesized (a
 * `'group'` header, `data === null`) through untouched; for a data-backed node stamps
 * `hasChildren` and nests its children beneath it. Visibility is not this stage's concern —
 * `flattenVisible` hides descendants of an id missing from the unioned `expandedRows` set.
 */
function buildTreeStage<TRow>(
  trackBy: TrackByFn<TRow>,
  config: WithTreeConfig<TRow>
): RenderNodeTransform<TRow> {
  return (nodes) => {
    const { readChildren, canExpand } = resolveCallbacks(config);
    return mapNodes(nodes, (node) => {
      if (node.data === null) {
        return node;
      }
      const children = readChildren(node.data);
      return {
        ...node,
        hasChildren: canExpand(node.data),
        children: hasNonEmptyChildren(children)
          ? children.map((child) => toChildNode(child, trackBy, readChildren, canExpand))
          : node.children,
      };
    });
  };
}

// Collects the id of every expandable row, at any depth. Only recurses into rows whose
// children are already loaded: a lazy row still expands, but its own descendants cannot be
// discovered until fetched.
function collectExpandableRowIds<TRow>(
  rows: readonly TRow[],
  trackBy: TrackByFn<TRow>,
  readChildren: (row: TRow) => TRow[] | undefined,
  canExpand: (row: TRow) => boolean
): RowId[] {
  return rows.flatMap((row) => {
    if (!canExpand(row)) {
      return [];
    }
    const children = readChildren(row);
    const nested = hasNonEmptyChildren(children)
      ? collectExpandableRowIds(children, trackBy, readChildren, canExpand)
      : [];
    return [trackBy(row), ...nested];
  });
}

/** One discovery walk, with its own evaluation-scoped report flags. */
function discoverExpandableIds<TRow>(
  rows: readonly TRow[],
  trackBy: TrackByFn<TRow>,
  config: WithTreeConfig<TRow>
): RowId[] {
  const { readChildren, canExpand } = resolveCallbacks(config);
  return collectExpandableRowIds(rows, trackBy, readChildren, canExpand);
}
```

### 6. The feature body

```ts
function buildTreeSpec<TRow>(
  input: Pick<TableStore<TRow>, 'rows' | 'trackBy'>,
  config: WithTreeConfig<TRow>
): TableFeatureSpec<TRow, TreeMembers> {
  // No `onExpanded`: `everExpanded` is the panel's member, not the tree's (D3/E7).
  const store = createExpansionStore({ initial: config.initial });

  function toggle(id: RowId, options?: ExpansionWriteOptions): void {
    store.toggle(id, options);
  }

  function expand(ids?: readonly RowId[], options?: ExpansionWriteOptions): void {
    const target = ids ?? discoverExpandableIds(input.rows(), input.trackBy, config);
    store.setExpanded([...new Set([...store.expanded(), ...target])], options);
  }

  function collapse(ids?: readonly RowId[], options?: ExpansionWriteOptions): void {
    if (ids === undefined) {
      store.setExpanded([], options);
      return;
    }
    const removing = new Set(ids);
    store.setExpanded(
      [...store.expanded()].filter((id) => !removing.has(id)),
      options
    );
  }

  function set(ids: readonly RowId[], options?: ExpansionWriteOptions): void {
    store.setExpanded(ids, options);
  }

  const state = computed<'all' | 'some' | 'none'>(() => {
    const expandable = discoverExpandableIds(input.rows(), input.trackBy, config);
    if (expandable.length === 0) {
      return 'none';
    }
    const open = store.expanded();
    const openCount = expandable.filter((id) => open.has(id)).length;
    if (openCount === 0) {
      return 'none';
    }
    return openCount === expandable.length ? 'all' : 'some';
  });

  const tree: TreeSlice = Object.assign(computed(() => store.expanded()), {
    changed: store.changed,
    state,
    toggle,
    expand,
    collapse,
    set,
  });

  return {
    members: { tree },
    // Claimed only when an accessor was supplied — a collapse-only instance leaves the
    // single-claim stage free for a future claimant (D9/E13).
    renderStages: config.childrenAccessor
      ? { tree: buildTreeStage(input.trackBy, config) }
      : undefined,
    // Contributed unconditionally, accessor or not: a collapse-only instance is exactly what
    // hides a group header's members, and the walk needs a defined set to do it.
    expandedRows: computed(() => store.expanded()),
    onDestroy: () => store.destroy(),
    onRowsRemoved: (ids) => store.onRowsRemoved(ids),
  };
}
```

### 7. The overload set

Mirrors `withExpansion()`'s exactly — config / derive-first / config +
derive — so `withTree(withComputed(...))` compiles the same way.

```ts
/**
 * Adds a real row tree to a `createTable()`: expanding a parent reveals its children as rows
 * with the same columns, at any depth. Real-row parents only — every node is an entry in
 * flat `data()`; there is no path API and no levels API (D1/D11). Standalone: reads only the
 * store slice it needs. Claims the `'tree'` render stage **only** when `childrenAccessor` is
 * supplied; omitted gives a collapse-only instance, which still hides the descendants of a
 * collapsed id (a `withGrouping()` header, say) without claiming the stage.
 */
export function withTree<In extends TreeInput<In>, D extends DerivedDict>(
  derive: Feature<NoInfer<In> & TreeMembers, D>
): Feature<In, TreeMembers & D>;
export function withTree<In extends TreeInput<In>>(
  config?: WithTreeConfig<RowOf<In>>
): Feature<In, TreeMembers>;
export function withTree<In extends TreeInput<In>, D extends DerivedDict>(
  config: WithTreeConfig<RowOf<In>> | undefined,
  derive: Feature<NoInfer<In> & TreeMembers, D>
): Feature<In, TreeMembers & D>;
export function withTree(
  configOrDerive: WithTreeConfig<any> | Feature<any, any> = {},
  maybeDerive?: Feature<any, any>
): Feature<any, any> {
  const isDeriveFirst = typeof configOrDerive === 'function';
  const config: WithTreeConfig<any> = isDeriveFirst ? {} : configOrDerive;
  const derive = isDeriveFirst ? configOrDerive : maybeDerive;
  const factory = <In extends TreeInput<In>>(
    input: In
  ): TableFeatureSpec<RowOf<In>, TreeMembers> => buildTreeSpec(input, config);
  const feature: Feature<any, any> = derive
    ? createTableFeature(factory, derive)
    : createTableFeature(factory);
  return Object.assign(feature, { displayName: 'withTree' });
}
```

### 8. Barrel

In `libs/table/src/index.ts`, beside the `withExpansion` exports:

```ts
export { withTree } from './api/features/with-tree';
export type { WithTreeConfig, TreeMembers } from './api/features/with-tree';
export type { ExpansionChange, ExpansionWriteOptions } from './api/features/expansion/state';
```

`ExpansionWriteOptions` and `ExpansionChange` are exported from their
defining module, matching how the editing types are exported. Add
whichever of the two #118 did not already add — `TreeMembers` exposes
`Observable<ExpansionChange>`, so a consumer cannot type a subscriber
without it. Leave the `withExpansion` lines untouched.

## Implementation Notes

- **Why `expand(ids)` adds rather than replaces.** D7: "`collapse()`
  then `expand(ids)` is two writes with two emission passes" — the
  sentence only holds if `expand(ids)` is additive. A replacing
  `expand(ids)` would be `set(ids)` under a second name, and `set()`
  exists precisely because restore needs one atomic replace. Today's
  `expandAll(ids)` replaces; that is the behavior being retired, not
  the one to copy.
- **Why `expand()` on a collapse-only instance is a no-op.** The walk
  discovers nothing, the union with the current set is the current
  set, `setExpanded` sees an empty symmetric difference and emits
  nothing. The toolbar spelling for collapse-only grouping is
  `table.tree.expand(table.groupIds())`, which is the explicit-ids
  branch.
- **Why `state` is a `Signal` property, not a method.** The slice is a
  callable carrying properties; `state` is one of them, so a consumer
  writes `table.tree.state()`. It re-runs the discovery walk on every
  recompute by design — as a `computed()` that is once per
  `rows()`/open-set change, not once per template read.
- **Why the slice is `Object.assign` onto a real `computed()`.** Same
  reason `createWritableView()` does it: the result keeps Angular's
  reactive-node brand and stays a valid `Signal` anywhere one is
  expected. A plain function carrying properties does not.
- **Why `renderStages` may be `undefined`.** `compose-table.ts` guards
  the whole block with `if (spec.renderStages)`, so an absent stage
  map is never registered and `claimStage('tree')` is never called.

## Risks / Watchouts

- **Start by checking `expansion/state.ts`'s `changed` type.** If it
  still reads `Observable<RowId>`, #118 has not landed E18 and this
  step is not unblocked — stop and say so rather than writing
  `Observable<RowId>` into `TreeSlice` or defining `ExpansionChange`
  here. The type belongs to the store, not to this feature.
- **The known double-claim.** `withExpansion()` still claims `'tree'`
  unconditionally in this slice. Composing it with
  `withTree({ childrenAccessor })` throws at construction. That is the
  documented intermediate state, closed by #121 — do not "fix" it here
  by making `withExpansion()`'s claim conditional. No in-repo call
  site composes both.
- **Do not hoist the report flags.** A `ReportFlag` at module scope
  turns "once per evaluation" into "once per process", the exact
  failure ADR-0014's dedupe rule names. They are created inside
  `resolveCallbacks`, which is called inside the stage transform and
  inside each walk — never at spec-build time.
- **Do not resolve `canExpand` once at spec-build time.** The default
  predicate depends on the guarded accessor, whose guard is
  evaluation-scoped. Resolving it once would pin one flag for the
  lifetime of the table.
- **`TreeSlice` is exported from `with-tree.ts` but not from the
  barrel** — `TreeMembers` references it, so declaration emit resolves
  it through the source module. If the build complains, add it to the
  barrel rather than inlining the shape.
- **Member key vs. stage key.** Both are the string `'tree'`, but
  `claimMember` and `claimStage` are separate registries. No collision.
- The four copied helpers now exist in two files. Deliberate and
  scheduled: #121 deletes `with-expansion.ts`'s copies together with
  `defaultChildrenAccessor` and `hasChildrenField`.

## Non-Goals

- No edit to `with-expansion.ts` — not its config, not its stage
  claim, not its members. #121 owns that.
- No edit to anything under `engine/`. The feature contract, the
  render order, the flatten walk and the union are unchanged.
- No `everExpanded` on the tree (D3/E7), no levels API (D11/E15), no
  `getDataPath`, no `row.children` fallback (D2/E6).
- No JSDoc re-points on `with-grouping/feature.ts`, no story
  migration, no docs or decisions-log statuses — #120 and #122.
- No cycle guard on `childrenAccessor` (out of scope, tracked on
  #105).

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` clean — **run twice**; `ngc`
      aborts at the first `.ts` error before reaching templates.
- [ ] `nx run shared-table:typecheck-spec` clean.
- [ ] `npx nx lint shared-table` clean — the two `console.error` calls
      carry their `no-console` exemptions.

---
[Step 2: The inherited row-tree behavior](step-2-tree-behavior-spec.plan.md) →
