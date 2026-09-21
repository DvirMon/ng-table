# Step 1 — `withExpansion()` narrows to the detail panel

**PR scope:** ships alone. **Parallel-safe with: Step 3** (docs).
**Step 2 depends on this one** — it targets the new API this step
introduces.

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/api/features/with-expansion.ts` (rewrite)
- `libs/table/src/engine/types.ts` (edit — one JSDoc comment)
- `libs/table/src/api/types.ts` (edit — one comment)
- `libs/table/src/index.ts` (edit — barrel)

## Why This Step Exists

[#101](https://github.com/DvirMon/ng-table/issues/101) splits one
feature that used to cover two distinct shapes (master/detail panel,
tree-grid sub-rows) into two. `withTree()` — the tree half — already
shipped in [#119](https://github.com/DvirMon/ng-table/issues/119),
built on the shared `createExpansionStore()` factory from #118. This
step is the other half: `withExpansion()` keeps its name and its
member key, but sheds everything tree-specific and becomes pure
open/closed id tracking for a detail panel.

**The correction to ADR-0012 that actually matters:** the panel
declares **no** `renderStages` and — unlike today — **no**
`expandedRows` on its feature spec, so it contributes nothing to the
union `engine/flatten.ts`'s `flattenVisible` walk reads
(D8/E12, `2-spec.md` §"`withExpansion()` — the detail panel"). Today,
composing `withExpansion()` with a group/tree feature means an open
panel can silently reveal rows — this step is what removes that
possibility, not a rename.

Both slices land as one ADR-0015 slice each (D6/E10) — `table.expansion`
mirrors `table.tree`'s shape exactly: a callable slice carrying
properties, one claimed member key (`expansion`), same shape `value`,
`columns`, `grouping`, `editing` already ship.

## What To Do

### 1. `with-expansion.ts` — full rewrite

**Config** shrinks to persistence only, no longer generic in `TRow`:

```ts
export interface WithExpansionConfig {
  initial?: readonly RowId[];
}
```

**Delete entirely:** `childrenAccessor`, `isExpandable`,
`defaultChildrenAccessor()`, `hasChildrenField()`,
`hasNonEmptyChildren()`, `isRowIdArray()`, `toChildNode()`,
`buildTreeStage()`, `collectExpandableRowIds()`, the `expandAll`
overload pair, `toggleExpanded`, `collapseAll`, `rowExpanded`, the
`mergeMap`/`from` rxjs imports, the `renderStages: { tree: ... }`
return field, and the `expandedRows` field on the returned
`TableFeatureSpec`. None of it survives the split — it's owned by
`with-tree.ts` now.

**New public surface** — one callable slice, same shape as
`with-tree.ts`'s `TreeSlice` (read that file first as the pattern to
mirror):

```ts
export interface ExpansionSlice {
  (): ReadonlySet<RowId>;
  readonly everExpanded: Signal<ReadonlySet<RowId>>;
  /** One emission per write, carrying the whole symmetric difference. */
  readonly changed: Observable<ExpansionChange>;
  toggle(id: RowId, options?: ExpansionWriteOptions): void;
  /** Adds. Omitted `ids`: every row in `rows()` — the panel has no
   *  discovery walk, unlike the tree's `expand()`. */
  expand(ids?: readonly RowId[], options?: ExpansionWriteOptions): void;
  /** Removes. Omitted `ids`: everything currently open. */
  collapse(ids?: readonly RowId[], options?: ExpansionWriteOptions): void;
  /** Atomic replace — the restore path. */
  set(ids: readonly RowId[], options?: ExpansionWriteOptions): void;
}

export interface ExpansionMembers {
  readonly expansion: ExpansionSlice;
}
```

**Re-export `ExpansionChange` alongside `ExpansionWriteOptions`** at
the top of the file — `with-tree.ts` line 7-13 does exactly this;
`with-expansion.ts` today only re-exports `ExpansionWriteOptions`.
This is what the E19 acceptance criterion ("`ExpansionChange` is
re-exported from `withExpansion()`'s public surface, same as
`withTree()`") means.

**Factory body** (`buildExpansionSpec` → keep the name, gut the
contents):

- Keep `createExpansionStore({ initial: config.initial, onExpanded })`
  and the `everExpanded` accumulation signal exactly as today
  (lines 160-180 of the current file) — this machinery is unchanged,
  only its shape on the returned members changes. Per spec: `initial`
  seeds `everExpanded` as well as the open set, same as today.
- `expand(ids, options)`: target is `ids ?? input.rows().map(input.trackBy)`
  (every row in `rows()`, not a discovery walk — the panel has no
  `childrenAccessor`), unioned with the currently-open set, written via
  `store.setExpanded([...new Set([...store.expanded(), ...target])], options)`
  — same union shape `with-tree.ts`'s `expand()` uses.
- `collapse(ids, options)`: `undefined` → `store.setExpanded([], options)`;
  explicit ids → filter them out of the current set. Copy
  `with-tree.ts`'s `collapse()` verbatim (it's row/id-set logic, not
  tree-specific).
- `set(ids, options)`: `store.setExpanded(ids, options)` — new verb,
  didn't exist on the old API.
- `toggle(id, options)`: `store.toggle(id, options)`.
- Build the slice the same way `with-tree.ts` does:
  `Object.assign(computed(() => store.expanded()), { everExpanded: everExpanded.asReadonly(), changed: store.changed, toggle, expand, collapse, set })`.

**Return shape:**

```ts
return {
  members: { expansion },
  onDestroy: () => store.destroy(),
  onRowsRemoved: (ids) => store.onRowsRemoved(ids),
};
```

No `renderStages`, no `expandedRows` field — both gone.

**`withExpansion()`'s own overload signatures and JSDoc**: update the
type parameters (no more `RowOf<In>` config generic — `WithExpansionConfig`
takes no `TRow`), and rewrite the top-level JSDoc to describe the
panel, not the tree-capable feature ("Adds open/closed id tracking for
a detail panel — no row synthesis, no render stage" or similar; see
`with-tree.ts`'s JSDoc for the sibling's phrasing).

### 2. `engine/types.ts` — `TableFeatureSpec.expandedRows` JSDoc

Currently: "Unlike every other slot, contributions from **multiple
features** accumulate rather than single-claim." After this step,
`withTree()` is the only contributor (`withExpansion()` no longer
declares this field at all) — reword to say the slot still accumulates
by design, but has one library contributor today, not "multiple
features."

### 3. `api/types.ts` — `isExpanded` comment

Same correction, in the comment above `readonly isExpanded?: boolean;`
(lines 56-58): it currently reads "unioned `expandedRows` slot," which
was true when both features could contribute. Name the contributor
correctly — one feature (`withTree()`) today, same union mechanism.

### 4. `index.ts` — barrel

Add `ExpansionMembers` to the existing `WithExpansionConfig` type
export line, matching how `TreeMembers` is exported alongside
`WithTreeConfig`:

```ts
export type { WithExpansionConfig, ExpansionMembers } from './api/features/with-expansion';
```

`ExpansionChange`/`ExpansionWriteOptions` are already exported from
`./api/features/expansion/state` (line 44) — leave that line as-is,
it covers both features.

## Implementation Notes

- `with-tree.ts` is the pattern to copy the slice-construction shape
  from — same `Object.assign(computed(...), {...})` idiom, same
  `ExpansionWriteOptions` plumbing, same `createExpansionStore()`
  dependency. The panel's factory is simpler: no `resolveCallbacks`,
  no `guardCallback`, no discovery walk, no `state` tri-state member
  (D5/E9 — that's tree-only, the panel's one-line equivalent is a call
  site's own `expansion().size === rows().length`, not a shipped
  member).
- `everExpanded`'s accumulation logic (the `onExpanded` hook passed to
  `createExpansionStore()`, the local `signal(new Set<RowId>())`, the
  silent seed from `store.expanded()` at construction) is the one
  piece of the old factory body that survives untouched — just move it
  into the new shape.
- Don't reach for `mergeMap`/`from` (rxjs) at all — those existed only
  to adapt `store.changed` back to a per-id `rowExpanded` stream, which
  no longer exists (E19 drops the adapter).

## Risks / Watchouts

- **This is a breaking change, deliberately, once.** Every symbol
  in `2-spec.md`'s "Breaking changes" table
  (`expandedRows`/`toggleExpanded`/`expandAll`/`collapseAll`/`everExpanded`/
  `rowExpanded`) is gone from `withExpansion()`'s public surface after
  this step. The one in-repo consumer of the old tree-shaped API (the
  collapsible-grouping story) already migrated to `withTree()` in
  [#120](https://github.com/DvirMon/ng-table/issues/120) — confirm with
  `grep -rn "toggleExpanded\|expandAll\|collapseAll\|rowExpanded" libs/table/src`
  that nothing else in `src/` still calls the removed verbs before
  finishing this step.
- **Don't let `expand()`'s "every row in `rows()`" become a discovery
  walk.** The panel has no `childrenAccessor` and no concept of nested
  data — `input.rows()` is the flat array only. Reaching for
  `with-tree.ts`'s `discoverExpandableIds` here would be reintroducing
  the tree half by accident.
- **`onRowsRemoved` prunes only the open set, not `everExpanded`** —
  same exemption the old code already had (ADR-0006). Don't add
  pruning to `everExpanded`; that would be a behavior change, not a
  rename.

## Non-Goals

- No changes to `with-tree.ts` or `expansion/state.ts` — both already
  shipped in #118/#119 and are correct as-is.
- No story/template changes — #120 already migrated the one consumer.
- `docs/status.md` / `llms.txt` regeneration is Step 3's concern (and
  flagged there for the user to run, not this step's).

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` clean.
- [ ] `WithExpansionConfig` is `{ initial?: readonly RowId[] }`, no
      longer generic in `TRow`. `childrenAccessor` and `isExpandable`
      are gone.
- [ ] `withExpansion()`'s feature spec declares no `renderStages` and
      no `expandedRows`.
- [ ] `table.expansion` is a callable slice: `()`, `.everExpanded`,
      `.changed` (`Observable<ExpansionChange>`), `.toggle`, `.expand`,
      `.collapse`, `.set` — no `expandedRows`, `toggleExpanded`,
      `expandAll`, `collapseAll`, or `rowExpanded` anywhere on it.
- [ ] `expand()` with no ids adds every id in `rows()`, unioned with
      what's already open — not a discovery walk.
- [ ] `ExpansionChange` is re-exported from `with-expansion.ts`
      itself, same as `with-tree.ts` does.
- [ ] `grep -rn "toggleExpanded\|expandAll\|collapseAll\|\.rowExpanded\b" libs/table/src`
      returns nothing outside `with-tree.ts`'s own history/comments
      (there should be zero live call sites).

---
[Step 2: `with-expansion.spec.ts` narrows to the panel](step-2-with-expansion-spec-narrows-to-panel.plan.md) →
