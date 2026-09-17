# Architecture — #132 `RenderRow.parentId` + engine-owned prune stage

Companion to [`spec-132.md`](spec-132.md). Consumed by `/to-tasks`; paths and types are exact as
of 2026-09-16.

## Settled — not open for relitigation

| # | Decision | Source |
|---|---|---|
| D1 | `RenderRow.parentId?: RowId`, populated on create by the synthesizing stage | spec D1, `plan.md` B1 |
| D2 | Prune is an engine-owned terminal pass, not a feature slot | spec D2 |
| D3 | Collapse state stays in the feature; engine holds a read-only `Signal` | spec D3 |
| D4 | The collapsed-set slot **accumulates** (union), unlike every other slot | spec D4, ADR-0012 §3/§5 |
| D5 | No contributor ⇒ no-op prune ⇒ everything visible | spec D5 |
| D6 | Grouping keeps its own prune in this slice; double-prune is idempotent | spec D6, `plan.md` B-intro |

D4 is the one that changed during grilling. `plan.md` B2 left it open and leaned toward a
single-claim slot; ADR-0012 decisions 3 and 5 force union. See "Why union" below.

## Current source, as it stands

| File | Line(s) | What is there now |
|---|---|---|
| `src/api/types.ts` | 32-64 | `RenderRow<TRow>` — `id`, `depth`, `kind`, `data`, `index`, plus optional `groupKey`, `aggregates`, `isExpanded`, `hasChildren`, `sourceIndex` |
| `src/engine/render-stages.ts` | 8 | `RENDER_ORDER = ['group', 'tree', 'paginate'] as const` |
| `src/engine/render-stages.ts` | 23-32 | `runRenderStages(rows, stages)` — `reduce` over `RENDER_ORDER`, `stages[stage]?.(current) ?? current` |
| `src/engine/core.ts` | 40 | `const renderStages: RenderStages<TRow> = {}` |
| `src/engine/core.ts` | 64-73 | `renderRows` computed — `runRenderStages(seedRenderRows(rows()), renderStages)`, then central `index` + `sourceIndex` stamping |
| `src/engine/types.ts` | 53-68 | `TableFeatureSpec<TRow, Members>` — `members`, `stages`, `renderStages`, hooks |
| `src/engine/compose-table.ts` | 103-110 | Render-stage registration; per-named-stage single-claim via `SlotRegistry` |
| `src/engine/slots.ts` | — | `SlotRegistry` — every single-occupancy collision message lives here |
| `src/engine/grouping.ts` | 208-238 | `emitGroupRows()` — depth-first walk; `isExpanded = expandedRows === undefined \|\| expandedRows.has(id)`; `nested = !isExpanded ? [] : …` |
| `src/engine/grouping.ts` | 248-275 | `buildGroupRenderRows(rows, grouping, columns, groupOrder?, expandedRows?)` |
| `src/api/features/with-grouping.ts` | 28-45 | `isExpandedRowsSignal()` + `readExpandedRows(store)` — the duck-typed cross-feature read |
| `src/api/features/with-expansion.ts` | 83-110+ | `buildTreeStage(trackBy, expandedRows, childrenAccessor, isExpandable)`; `expandRow()` gates children on `self.isExpanded` |
| `src/api/create-table-feature.ts` | 62, 88 | `PIPELINE_BEHAVIOR_KEYS = ['stages', 'renderStages', 'columnRules']` — a derive block may not declare these |

Two facts worth pinning because they shape the work:

- **`runRenderStages` has no store access.** It takes `(rows, stages)` only. The collapsed sets
  must therefore reach it as a third argument from `engine/core.ts`, not via a store read.
- **`emitGroupRows` already holds the parent id at emit time.** Line 219's `id` is the header's
  id; the recursive call on line 236 and the leaf map on line 237 are exactly where `parentId`
  is stamped. No lookup is introduced.

## Why union, not single-claim

ADR-0012 (`docs/adr/0012-split-expansion-into-panel-and-tree.md`, **proposed**, 2026-09-03):

- **Decision 3** — `withExpansion()` and `withTree()` each call `createExpansionStore()`
  **independently**, own instances. The Alternatives table rejects a shared instance: *"a
  tree-expanded row and an open detail panel are semantically different states that should not
  collide in one set."*
- **Decision 5** — *"Group collapse delegates to `withExpansion()`, not `withTree()`."* So the
  panel feature holds group-header open ids and **is** a prune contributor, even though it
  synthesizes no rows.
- **Verification plan, line 144-145** — composing `[withExpansion(), withTree()]` must construct
  without throwing.

Two independent sets, both hiding descendants, both required to coexist. A single-claim slot
throws on the ADR's own acceptance case. Union is forced, not chosen.

Monotonicity makes union total: a contributed set only hides descendants of ids it contains;
nothing can un-hide another contributor's rows, so no precedence rule is needed.

## Types and contracts

### `RenderRow` (`src/api/types.ts`)

```ts
export interface RenderRow<TRow> {
  readonly id: RowId;
  readonly depth: number;
  readonly kind: RowKind;
  readonly data: TRow | null;
  readonly index: number;

  // NEW. The id of the render row this one was synthesized beneath — the group header for a
  // cluster member, the parent row for a tree child. Set by the synthesizing stage at emit
  // time; `undefined` on a top-level row and whenever nothing nests. Opaque: never parsed
  // back apart (a group id's separators differ from a tree id's).
  readonly parentId?: RowId;

  readonly groupKey?: { columnId: string; value: unknown };
  readonly aggregates?: Record<string, unknown>;
  readonly isExpanded?: boolean;
  readonly hasChildren?: boolean;
  readonly sourceIndex?: number;
}
```

### The accumulating slot (`src/engine/types.ts`)

```ts
export interface TableFeatureSpec<TRow, Members extends object = {}> {
  members?: Members;
  stages?: PipelineStages<TRow>;
  renderStages?: RenderStages<TRow>;

  // NEW. Ids whose descendants are hidden. Read-only — the engine never writes a feature's
  // state. UNLIKE every other slot this one accumulates rather than single-claims: ADR-0012
  // gives the panel and tree features independent open-id sets and requires both to compose.
  // Union semantics; hiding is monotonic so no precedence rule exists.
  collapsedRows?: Signal<ReadonlySet<RowId>>;

  // …existing hooks
}
```

`create-table-feature.ts:62` — `collapsedRows` is a pipeline-behaviour key like
`stages`/`renderStages`, so add it to `PIPELINE_BEHAVIOR_KEYS`: a derive block must not declare
it.

### The stage order (`src/engine/render-stages.ts`)

```ts
export const RENDER_ORDER = ['group', 'tree', 'prune', 'paginate'] as const;

export type RenderStage = (typeof RENDER_ORDER)[number];
```

`'prune'` is in the array so the order stays one declaration, but it is **engine-owned**: a
feature declaring `renderStages.prune` must throw. Two options for enforcing that, to settle in
the ADR — reject the key in `compose-table.ts:103-110`'s registration loop, or keep `RENDER_ORDER`
as the execution order and exclude `'prune'` from the `RenderStages` key union via
`Exclude<RenderStage, 'prune'>`. The second is compile-time and preferred; it keeps the single
declaration while making the slot unclaimable in the type.

### `runRenderStages` signature change

```ts
export function runRenderStages<TRow>(
  rows: Omit<RenderRow<TRow>, 'index'>[],
  stages: RenderStages<TRow>,
  collapsed: ReadonlySet<RowId>      // NEW — already unioned by the caller; empty ⇒ no-op
): Omit<RenderRow<TRow>, 'index'>[]
```

The `reduce` runs `pruneCollapsedDescendants(current, collapsed)` when it reaches `'prune'`,
rather than looking the stage up in `stages`.

### The prune itself

One pass, `O(n)` given the parent chain is walked against a set of ids already emitted above:

```ts
function pruneCollapsedDescendants<TRow>(
  rows: Omit<RenderRow<TRow>, 'index'>[],
  collapsed: ReadonlySet<RowId>
): Omit<RenderRow<TRow>, 'index'>[] {
  if (collapsed.size === 0) return rows;
  const hidden = new Set<RowId>();
  return rows.filter((row) => {
    const hasHiddenParent =
      row.parentId !== undefined &&
      (hidden.has(row.parentId) || collapsed.has(row.parentId));
    if (hasHiddenParent) {
      hidden.add(row.id);
      return false;
    }
    return true;
  });
}
```

Single pass is correct because both synthesizing stages emit a parent immediately before its
descendants (`emitGroupRows` is depth-first; `expandRow` appends children inline), so a parent is
always seen before any child. That ordering invariant belongs in the ADR — it is what makes the
ancestor walk `O(1)` per row instead of a chain climb.

## File layout

| File | Action | What |
|---|---|---|
| `docs/adr/0017-engine-owned-descendant-prune.md` | **create** | The ADR. Supersedes ADR-0011 in part; closes D11; cites `prior-art.md`; states the ADR-0012 relationship both ways; records the parent-before-child emit invariant and the `'prune'` unclaimability mechanism |
| `docs/1-state/work/with-grouping/2-decisions.md` | edit | Mark D11 (line ~163) superseded by the new ADR |
| `docs/adr/0011-chained-render-stages.md` | edit | Note partial supersession |
| `src/api/types.ts` | edit | Add `parentId?: RowId` with its comment (D1) |
| `src/engine/types.ts` | edit | Add `collapsedRows?: Signal<ReadonlySet<RowId>>` to `TableFeatureSpec` |
| `src/engine/render-stages.ts` | edit | `'prune'` in `RENDER_ORDER`; `RenderStages` keyed on `Exclude<RenderStage, 'prune'>`; `runRenderStages` third arg; `pruneCollapsedDescendants` |
| `src/engine/compose-table.ts` | edit | Collect `spec.collapsedRows` into an array on the handle (no `SlotRegistry` claim — this slot accumulates) |
| `src/engine/core.ts` | edit | `collapsedSources: Signal<ReadonlySet<RowId>>[]` on `TableCoreHandle`; union computed; pass into `runRenderStages` at line 66 |
| `src/engine/grouping.ts` | edit | `emitGroupRows` stamps `parentId` on nested headers (line 236) and leaves (line 237); keep the existing `isExpanded` gate (D6) |
| `src/api/features/with-expansion.ts` | edit | `toChildRenderRow` / `expandRow` stamp `parentId: row.id`; declare `collapsedRows` — the complement of `expandedRows` over expandable ids, or `expandedRows` inverted at the prune's read; settle in the ADR |
| `src/api/create-table-feature.ts` | edit | Add `'collapsedRows'` to `PIPELINE_BEHAVIOR_KEYS` (line 62) and pass through (line 88) |
| `src/engine/render-stages.spec.ts` | edit/create | Prune position vs `'paginate'`; empty-set no-op; union of two sets |
| `src/api/types.types.spec.ts` | create or edit | `parentId` optional; top-level row satisfies `RenderRow` without it |
| `src/api/features/with-grouping.spec.ts` | edit | `parentId` on members and nested headers; existing cases unchanged |
| `src/api/features/with-expansion.spec.ts` | edit | `parentId` on tree children; existing cases unchanged |
| `src/engine/compose-table.spec.ts` | edit | Two features contributing `collapsedRows` construct without throwing |

Naming note: `pruneCollapsedDescendants` lives in `render-stages.ts` beside `runRenderStages`,
not in its own file — it is the one engine-owned stage and has no state of its own. If a second
engine-owned stage ever lands, promote both then (`.claude/rules/file-organization.md`: promote
on evidence).

## Open questions for the ADR

1. **The `collapsedRows` polarity.** `withExpansion()` stores *expanded* ids. The prune wants
   *collapsed* ones. Inverting needs the universe of expandable ids, which the panel feature will
   not have post-ADR-0012. Cleanest: the contributed signal is `expandedRows` and the prune's rule
   is "hide when the parent is a known expandable id **not** in the set" — but that needs the
   expandable universe too. Alternative: grouping headers are collapsed-by-default only when
   expansion is composed (today's `expandedRows === undefined` branch, `grouping.ts:232`), so the
   polarity question is really "what does absence mean". Settle before writing D3's signature —
   this is the one thing that could change the slot's type.
2. **`'prune'` unclaimability mechanism** — type-level `Exclude` vs runtime rejection. Preference
   above is type-level; confirm it survives `RenderStages` being derived from `RENDER_ORDER`.
3. **ADR number** — `0017` assumed (0016 is the highest existing). Confirm no parallel branch has
   taken it.

Question 1 is the only one that can move the file layout. `/to-tasks` should sequence the ADR
step first and gate the `engine/types.ts` edit on it.
