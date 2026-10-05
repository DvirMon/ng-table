# Authoring a table feature

For an in-house team adding a `with-*()` feature to `@ngp/table`. Everything here
is imported from `@ngp/table`; nothing needs a deep import.

## 1. The `with-*()` shape

An outer config function returns `createTableFeature((store, ctx) => spec)`. The
row type is recovered from the store as `RowOf<In>`, never written at the call
site.

```ts
export function withX(config: WithXConfig = {}) {
  const feature = createTableFeature(<In extends TableStore<any>>(store: In, ctx) =>
    buildXSpec<RowOf<In>>(store, ctx, config),
  );
  return Object.assign(feature, { displayName: 'withX' });
}
```

The spec (`TableFeatureSpec`) has these keys, all optional:

| Key             | Purpose                                                               |
| --------------- | --------------------------------------------------------------------- |
| `members`       | Signals and methods merged onto the public store                      |
| `stages`        | Row transforms on the pipeline (`filter → group → sort`)              |
| `renderStages`  | `RenderNode` transforms over the pipeline output                      |
| `setup`         | Runs once every feature is composed, in the owner's injection context |
| `onRowsRemoved` | Called with ids that just left `data`                                 |

## 2. The exported surface

A feature author imports only these from `@ngp/table`:

- **Building:** `createTableFeature`, `composeFeatures`
- **Types:** `TableFeatureSpec`, `Feature`, `Shape`, `RowOf`, `StageContext`
- **Writable state:** `WritableView`, `createWritableView`
- **Row ids:** `pruneByIds`, `resolveIndex`
- **Render stages:** `RenderNode`, `mapNodes`
- **Stage declaration:** `stageSchema`, `stage`
- **Registries** (extended by `declare module`): `PipelineStageRegistry`,
  `RenderStageRegistry`, `ColumnRuleEntry`, `ColumnRuleRegistry`

Anything not listed in the package barrel is internal.

## 3. Claiming vs declaring a stage

A stage is recorded inside `stageSchema(layer, callback)`. `layer` is
`'pipeline'` (transforms rows) or `'render'` (transforms `RenderNode`s). Each
`stage()` call either claims or declares:

```ts
renderStages: stageSchema('render', (s) => {
  stage(s.tree, { run });                                            // claim a built-in anchor
  stage(s.tree, { name: 'pin', placement: 'after', run: pinRows });  // declare a new stage
}),
```

- **Claim** — no `name`. Your `run` takes the built-in anchor's own slot.
  Two features claiming the same anchor is an error.
- **Declare** — a `name` and a `placement` (`'before'` or `'after'`) relative to
  the anchor handle. The stage is new; the built-in order does not change.

Register the new key first, so `s.pin` is a legal handle and the `name` type-checks:

```ts
declare module '@ngp/table' {
  interface RenderStageRegistry {
    pin: true;
  }
}
```

The anchors are fixed: pipeline `filter`, `group`, `sort`; render `group`,
`tree`. A declared stage can itself be the anchor for another stage.

Set `synthesizesRows: true` on a render stage that adds rows not present in the
data (group headers, for example). It must land at or after `'group'`.

## 4. What throws and what is reported

| When                       | What                                                                                                            | Behavior                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Construction (dev)         | Unknown anchor, a cycle, a duplicate name or claim, an ambiguous tie, `synthesizesRows` placed before `'group'` | Throws, naming both parties                                                    |
| Runtime, every environment | Duplicate row ids in a stage's output; a made-up real-row id                                                    | Reported once per stage per evaluation; the output is passed through unchanged |

An ambiguous tie is two stages whose relative order the anchors don't fix
(both placed after the same anchor, say). Fix it by
anchoring one stage on the other. A row counts as made up when it carries a row
id the stage's input never had and `data` is not `null` — a synthesized row
(`data === null`) is exempt.

A runtime failure never throws: one bad record must not blank the table.

## 5. `RenderNode` and `mapNodes`

A render stage receives and returns `readonly RenderNode<TRow>[]`. A node
carries its `children`. To nest a row under another, place it in that node's
`children` with `mapNodes` — never push it in as a sibling. `mapNodes` maps
every node post-order, so your function sees a node whose children are already
mapped, and the engine owns the recursion.

## 6. `onRowsRemoved` and `pruneByIds`

A feature that stores row ids declares `onRowsRemoved` and prunes its own state.
The engine never reaches into feature state. It fires for every removal,
including a full `data.set()` replacement.

```ts
onRowsRemoved: (ids) => pinned.update((set) => pruneByIds(set, ids)),
```

`pruneByIds` takes a `Set` or a `Map` and returns the same reference when
nothing changed.

## 7. `displayName`

Set it so a collision message names the feature:

```ts
Object.assign(feature, { displayName: 'withX' });
```

The message then reads `feature 3 (withX)` rather than a bare position.

## 8. The inert-stage contract

A stage with nothing to do returns its input array unchanged — the same
reference. This is a documented contract; the engine does not assert it.

## 9. Testing a feature on its own

Build a table with your feature in a spec and assert on the rows it produces:

```ts
const store = TestBed.runInInjectionContext(() =>
  createTable(signal(rows), { trackBy: 'id', columns }, withX())
);
expect(store.renderRows().map((r) => r.id)).toEqual([...]);
```

`with-selection/feature.spec.ts` is the prior art.

## 10. Worked example: `withRowPinning`

A feature that keeps a set of pinned ids and hoists their rows to the top.

```ts
import { signal, type Signal } from '@angular/core';
import {
  createTableFeature,
  pruneByIds,
  stage,
  stageSchema,
  type RenderNode,
  type RowId,
  type RowOf,
  type TableFeatureSpec,
  type TableStore,
} from '@ngp/table';

declare module '@ngp/table' {
  interface RenderStageRegistry {
    pin: true;
  }
}

export interface RowPinningMembers {
  readonly pinnedRows: Signal<ReadonlySet<RowId>>;
  pin(id: RowId): void;
  unpin(id: RowId): void;
}

function buildRowPinningSpec<TRow>(): TableFeatureSpec<TRow, RowPinningMembers> {
  const pinned = signal<ReadonlySet<RowId>>(new Set());

  const hoistPinned = (nodes: readonly RenderNode<TRow>[]): readonly RenderNode<TRow>[] => {
    const ids = pinned();
    if (ids.size === 0) return nodes; // inert: same reference
    const isPinned = (node: RenderNode<TRow>): boolean => ids.has(node.id);
    return [...nodes.filter(isPinned), ...nodes.filter((node) => !isPinned(node))];
  };

  return {
    members: {
      pinnedRows: pinned,
      pin: (id) => pinned.update((set) => new Set(set).add(id)),
      unpin: (id) =>
        pinned.update((set) => {
          const next = new Set(set);
          next.delete(id);
          return next;
        }),
    },
    renderStages: stageSchema<TRow>('render', (s) => {
      stage(s.tree, { name: 'pin', placement: 'after', run: hoistPinned });
    }),
    onRowsRemoved: (ids) => pinned.update((set) => pruneByIds(set, ids)),
  };
}

export function withRowPinning() {
  const feature = createTableFeature(<In extends TableStore<any>>(_store: In) =>
    buildRowPinningSpec<RowOf<In>>(),
  );
  return Object.assign(feature, { displayName: 'withRowPinning' });
}
```

What it shows:

- **State and members** — a `signal<ReadonlySet<RowId>>` with `pin`/`unpin`.
- **A declared stage** — `pin`, placed after `'tree'`, registered through
  `RenderStageRegistry`.
- **The inert path** — with nothing pinned, the stage returns its input as-is.
- **Cleanup** — `onRowsRemoved` prunes removed ids with `pruneByIds`.
- **A name** — `displayName` for collision messages.
