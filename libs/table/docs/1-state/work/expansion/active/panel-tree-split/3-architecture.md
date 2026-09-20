---
title: Architecture — panel/tree split
type: architecture
capability: expansion
ticket: "101"
date: 2026-09-20
audience: developers
---

# Architecture — panel/tree split (#101)

Consumed immediately by `/to-issues` and `/to-tasks`. Paths, types and snippets are exact
against `libs/table/src` as of 2026-09-20 (post-#107/#108). Spec: [`2-spec.md`](2-spec.md).

## Settled — not open for relitigation

| | Settled |
|---|---|
| D1/E5 | `withTree()` takes real-row parents only. No `getDataPath`, no invented parents |
| D2+D9/E6+E13 | `childrenAccessor` is **optional**, with **no `row.children` fallback**. Omitted ⇒ collapse-only ⇒ the `'tree'` stage is not claimed |
| D3/E7 | `everExpanded` lives on `withExpansion()`, not in the shared store |
| D5/E9 | `state()` (`'all' \| 'some' \| 'none'`) is a `withTree()` member, shipped here |
| D6/E10 | Both features ship as ADR-0015 slices — `table.expansion`, `table.tree`. Other features stay flat until #50 |
| D7/E11 | `setExpanded` is internal. Public: `toggle` / `expand` / `collapse` / `set`; omitted `ids` = all |
| D8/E12 | `withGrouping()` is static. `withExpansion()` declares **no** `expandedRows` on its spec |
| D10/E14 | `initial` ships here, seeded in the factory |
| D11/E15 | `withTree()` has no levels API, ever |
| D12/E16 | A throwing `childrenAccessor` degrades to "no children", reported once per evaluation, in production too |

G6 needs no fix: `indexById` is built from `config.data()`, and under D1/D2 every tree node
is an entry there.

## Current source — what each file does today

| File | Today | After |
|---|---|---|
| `api/features/with-expansion.ts` | everything: config, store, verbs, `'tree'` stage, union contribution | panel only |
| `api/features/expansion/state.ts` | — | **new**: `createExpansionStore()` |
| `api/features/with-tree.ts` | — | **new**: tree config, stage, discovery walk, `state()` |
| `engine/core.ts` | unions `expandedSources` into `expanded`, feeds `flattenVisible` | unchanged code; one library contributor instead of one-or-two |
| `engine/flatten.ts` | the only reader of expansion state; stamps `depth`, `parentId`, `isExpanded` | unchanged |
| `engine/render-stages.ts` | `RENDER_ORDER = ['group', 'tree']`, `mapNodes`, `RenderNode` | unchanged |
| `engine/compose-table.ts` | `claimMember()` per member key; `expandedRows` accumulates | unchanged |
| `api/features/with-grouping/feature.ts` | static clustering + `groupIds()`; JSDoc names `expandAll(table.groupIds())` | JSDoc re-points at `table.tree.expand(...)` |
| `api/features/editing/state.ts` | the factory precedent to mirror | unchanged |

Nothing in `engine/` changes shape. This is an `api/features/` split plus a docs pass.

## Types

### `api/features/expansion/state.ts` (new)

```ts
export interface ExpansionWriteOptions {
  /** `false` suppresses `changed` emissions for this write — restore, server sync. */
  emitEvent?: boolean;
}

export interface ExpansionStoreOptions {
  initial?: readonly RowId[];
  /** Called with ids newly added to the set by any write. `withExpansion()` uses it to
   *  accumulate `everExpanded`; `withTree()` passes nothing. Mirrors `EditingStoreOptions.onWrite`. */
  onExpanded?: (ids: readonly RowId[]) => void;
}

export interface ExpansionStore {
  readonly expanded: Signal<ReadonlySet<RowId>>;
  readonly changed: Observable<RowId>;
  /** The only writer of the signal. Emits once per id whose membership changed — added or
   *  removed — which is what preserves E3 across all four public verbs. */
  setExpanded(ids: readonly RowId[], options?: ExpansionWriteOptions): void;
  toggle(id: RowId, options?: ExpansionWriteOptions): void;
  /** Prunes via `pruneByIds()` (ADR-0006). Never touches `everExpanded` — the feature owns it. */
  onRowsRemoved(ids: readonly RowId[]): void;
  /** Completes `changed`. Wired to the feature's `onDestroy`. */
  destroy(): void;
}

export function createExpansionStore(options?: ExpansionStoreOptions): ExpansionStore;
```

Takes no store slice — unlike `createEditingStore()` it reads no rows. Both `expand()`
denominators (`rows()` on the panel, the discovery walk on the tree) are resolved by the
feature, which then calls `setExpanded` with concrete ids.

### `api/features/with-expansion.ts` (narrowed)

```ts
export interface WithExpansionConfig {
  initial?: readonly RowId[];
}

export interface ExpansionSlice {
  (): ReadonlySet<RowId>;
  readonly everExpanded: Signal<ReadonlySet<RowId>>;
  readonly changed: Observable<RowId>;
  toggle(id: RowId, options?: ExpansionWriteOptions): void;
  /** Omitted `ids`: every row in `rows()`. */
  expand(ids?: readonly RowId[], options?: ExpansionWriteOptions): void;
  /** Omitted `ids`: everything currently open. */
  collapse(ids?: readonly RowId[], options?: ExpansionWriteOptions): void;
  /** Atomic replace — the restore path. */
  set(ids: readonly RowId[], options?: ExpansionWriteOptions): void;
}

export interface ExpansionMembers {
  readonly expansion: ExpansionSlice;
}
```

`WithExpansionConfig` stops being generic in `TRow` — nothing in it reads a row. Keep the
type name; consumers importing it keep compiling, they just lose two fields.

The returned spec declares `members` and `onRowsRemoved` and `onDestroy`. It declares
**no** `renderStages` and **no** `expandedRows` (D8).

### `api/features/with-tree.ts` (new)

```ts
export interface WithTreeConfig<TRow> {
  /** Omitted: collapse-only — no row tree, and the `'tree'` render stage is not claimed. */
  childrenAccessor?: (row: TRow) => TRow[] | undefined;
  /** Renders the toggle independently of whether children are loaded — lazy children.
   *  Default: the accessor returned a non-empty array. */
  isExpandable?: (row: TRow) => boolean;
  initial?: readonly RowId[];
}

export interface TreeSlice {
  (): ReadonlySet<RowId>;
  readonly changed: Observable<RowId>;
  /** `'all'` when every expandable row is open, `'none'` when none is (including "nothing is
   *  expandable"), `'some'` otherwise. Reflects the row tree only — a collapse-only instance
   *  reads `'none'`, since group ids are not discoverable from an accessor. */
  readonly state: Signal<'all' | 'some' | 'none'>;
  toggle(id: RowId, options?: ExpansionWriteOptions): void;
  /** Omitted `ids`: every expandable row found by the discovery walk. */
  expand(ids?: readonly RowId[], options?: ExpansionWriteOptions): void;
  collapse(ids?: readonly RowId[], options?: ExpansionWriteOptions): void;
  set(ids: readonly RowId[], options?: ExpansionWriteOptions): void;
}

export interface TreeMembers {
  readonly tree: TreeSlice;
}

type TreeInput<In> = Pick<TableStore<RowOf<In>>, 'rows' | 'trackBy'>;
```

Overload set mirrors `withExpansion()`'s exactly (config / derive-first / config + derive),
so `withTree(withComputed(...))` compiles the same way.

### Slice construction

A slice is a callable carrying properties, built the way `createWritableView()` builds one —
`Object.assign` onto a real `computed()`, so it stays a valid `Signal` anywhere one is
expected:

```ts
const expansion: ExpansionSlice = Object.assign(
  computed(() => store.expanded()),
  { everExpanded: everExpanded.asReadonly(), changed: store.changed, toggle, expand, collapse, set }
);
```

`claimMember()` then sees one key per feature — `expansion`, `tree` — and the two features
compose.

## Behavior notes that decide code

### Emission

`setExpanded(next)` emits once per id in the symmetric difference of `expanded()` and
`next`. That single rule reproduces all three of today's behaviors: `toggle` emits the one
id, `expand(ids)` emits only newly opened ids, `collapse()` emits every previously open id.

### `everExpanded`

Accumulated in `withExpansion()` via `ExpansionStoreOptions.onExpanded`, never pruned by
`onRowsRemoved` (its member doc already says why). `initial` seeds it on the panel
and not on the tree.

### The `'tree'` stage

Moves from `with-expansion.ts` unchanged in shape — `buildTreeStage`, `toChildNode`,
`hasNonEmptyChildren`, `collectExpandableRowIds` all relocate to `with-tree.ts`. Two
changes:

1. Declared **conditionally**: `renderStages: childrenAccessor ? { tree: buildTreeStage(...) } : undefined`.
2. The accessor is wrapped before use (below). `defaultChildrenAccessor` and
   `hasChildrenField` are **deleted**, not moved.

### Accessor failure (ADR-0014)

Wrap once per evaluation, with an evaluation-scoped dedupe set — the shape
`buildGroupRenderRows`'s `reportedColumns` already uses:

```ts
function guardAccessor<TRow>(
  accessor: (row: TRow) => TRow[] | undefined,
  reported: { done: boolean }
): (row: TRow) => TRow[] | undefined {
  return (row) => {
    try {
      return accessor(row);
    } catch (error) {
      if (!reported.done) {
        reported.done = true;
        console.error('[withTree] childrenAccessor threw; the row renders without children.', error);
      }
      return undefined;
    }
  };
}
```

The `reported` flag is created inside the stage transform (one per `renderRows` evaluation)
and inside each discovery walk (one per `expand()` / `state()` read) — never module-level,
which would report once per process.

`isExpandable` is a consumer callback too and takes the same guard, defaulting to `false`
(no chevron) on a throw.

## File layout

```
api/features/
├── expansion/
│   └── state.ts            ← new: createExpansionStore(), ExpansionStore, ExpansionWriteOptions
├── with-expansion.ts       ← narrowed: panel slice only
├── with-tree.ts            ← new: tree slice, 'tree' stage, discovery walk
├── editing/state.ts        ← the precedent, unchanged
├── with-row-edit.ts
└── with-optimistic.ts
```

Flat siblings beside a concern folder, exactly as editing already is. `with-tree.ts` stays a
single file until it outgrows one; `with-columns-schema/` is the shape to adopt if it ever
does.

Specs sit beside their features: `with-expansion.spec.ts` (existing, narrowed),
`with-tree.spec.ts` (new). `expansion/state.ts` gets no spec, matching `editing/state.ts`.

## Call-site checklist

**Library source**

- [ ] `index.ts` — add `withTree`, `WithTreeConfig`, `TreeMembers`, `ExpansionWriteOptions`;
      keep `withExpansion`, `WithExpansionConfig`, `ExpansionMembers`.
- [ ] `engine/types.ts` — `TableFeatureSpec.expandedRows` JSDoc cites ADR-0012 for the
      accumulating slot; note that the panel feature no longer contributes.
- [ ] `api/types.ts:56` — the `isExpanded` comment describes "the unioned `expandedRows`
      slot"; still true, but name the contributor correctly.
- [ ] `api/features/with-grouping/feature.ts:68` — `groupIds()` JSDoc names
      `expandAll(table.groupIds())`; re-point at `table.tree.expand(table.groupIds())`.

**Specs**

- [ ] `api/features/with-expansion.spec.ts` — narrow to the panel; delete tree cases; add the
      no-stage, no-union and `initial` cases.
- [ ] `api/features/with-tree.spec.ts` — new; inherits the tree cases with an explicit
      accessor.
- [ ] `api/features/with-grouping/feature.spec.ts` — ~15 sites compose `withExpansion()`
      (848, 1059–1271, 1295–1333, 2297–2440). Collapse-behavior cases move to
      `with-tree.spec.ts`; the type-level case at 1295–1333 (`expandedRows` visible to a
      trailing derive only when composed first) becomes `tree`/`expansion`.
- [ ] `engine/core.spec.ts:221`, `engine/compose-table.spec.ts:176` — the union tests build
      their own fake contributors, so they stay; re-read the comments naming `withExpansion()`.

**Stories**

- [ ] `stories/grouping/grouping-collapsible/grouping-collapsible-story-host.component.ts` —
      `withExpansion()` → `withTree()`; `expandAllGroups()` → `table.tree.expand(table.groupIds())`;
      `collapseAllGroups()` → `table.tree.collapse()`; class JSDoc rewritten.
- [ ] `...-story-host.component.html:40` (copy), `:66`, `:113` — `table.toggleExpanded(row.id)`
      → `table.tree.toggle(row.id)`. `row.isExpanded` bindings at `:77`, `:79`, `:109`, `:111`
      are unchanged (#108 stamps it for group headers too).
- [ ] `stories/grouping/grouping.mdx:422-427` — the `expandAll()`/`groupIds()` paragraph.

**Site**

- [ ] `apps/site/src/app/pages/home/home.content.ts:39` — "withSorting() and withExpansion()"
      still reads correctly; check the surrounding claim once the barrel changes.

**Docs** (the owed list in `2-spec.md`)

- [ ] ADR-0012 corrections + `accepted`; ADR-0015 slice table; `features/expansion.md` split;
      `features/grouping.md`; `1-state/prd.md` stories 10/23/31; `1-state/architecture.md`;
      `1-state/state-persistence.md` (names the multi-id write this issue ships);
      `docs/decisions/expansion.md` statuses; `libs/table/CONTEXT.md` glossary if it names
      `expandedRows`.
- [ ] `npm run llms` regenerated, `npm run llms:check` clean.

## Verification

- `nx run shared-table:typecheck` clean on a **second, source-clean run** — `ngc` stops at
  the first `.ts` error and never reaches templates, and the collapsible story's template is
  exactly what changes here.
- The story templates are the only in-repo consumer of the removed verbs, so a green
  template-aware typecheck is the migration's real gate.

## Open questions

1. **`state()` on a collapse-only instance.** It reads `'none'` because the denominator
   comes from the discovery walk and group ids are not discoverable. A collapsible-grouping
   toolbar that wants tri-state computes it at the call site from `groupIds()` and `tree()`.
   Acceptable, or does `withTree()` need an explicit denominator input? Not blocking — the
   member ships either way.
2. **`ReadonlySet` narrowing.** Today `expandedRows` is `Signal<Set<RowId>>`; the slices
   above read `ReadonlySet<RowId>`, matching `withSelection()`. Type-level breaking for
   anyone who mutated the returned set (nobody should have). Confirm at slicing time.
3. **Does `withExpansion()` keep an `isExpandable`-style gate?** No config field is proposed
   — every row can hold a panel. If a consumer wants to suppress the affordance, that is
   markup. Recorded so `/to-issues` does not rediscover it.
