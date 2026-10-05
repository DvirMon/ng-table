---
title: 'Step 3 — rowsOf member on withGrouping()'
type: task-step
issue: 65
---

# Step 3 — `rowsOf` member on `withGrouping()`

**PR scope:** The public surface. Needs the core seam (Step 1) and the walk (Step 2).

**Task type:** code

**Skills used:** angular-developer, file-organization, typescript-conventions

**Depends on:** Step 1, Step 2

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/api/features/with-grouping.ts` (edit)

## Why This Step Exists

This is the whole of the library's group-selection surface (D16): the consumer gets the leaf rows,
and owns every cascade — the library ships no `groupSelects` equivalent. Tri-state needs nothing
new; `selectionStateOf(ids)` already returns `'none' | 'some' | 'all'`.

Decision: `../../../2-decisions.md` D16 / D16.1. Spec: `../../../3-spec.md`, "Public surface".

## What To Do

### 1. Widen the core slice this feature reads

```ts
type GroupingInput<TRow> = Pick<TableCore<TRow>, 'columns' | 'renderRows'>;
```

### 2. Declare the member

```ts
export interface GroupingMembers<TRow> {
  readonly grouping: WritableView<string[], GroupingUpdater<TRow>>;
  /** Leaf rows beneath a group header, at any depth — post-filter by construction, since
   * `filter` precedes `group` in `PIPELINE_ORDER`. Resolved by `group.id`, so a header from an
   * earlier render pass still works; a group that no longer exists returns `[]`. Reads
   * `renderRows()`, so it composes inside a `computed()`. D16/D16.1. */
  readonly rowsOf: (group: RenderRow<TRow>) => readonly TRow[];
}
```

### 3. Wire it in the factory, and return it in `members`

```ts
const rowsOf = (group: RenderRow<TRow>): readonly TRow[] =>
  rowsBeneathGroup(core.renderRows(), group.id);

return {
  members: { grouping, rowsOf },
  // stages / renderStages unchanged
};
```

Imports: `rowsBeneathGroup` from `../../engine/grouping`, `RenderRow` added to the existing
`import type … from '../types'`.

## Implementation Notes

- **Flat `table.rowsOf(g)`, not `table.grouping.rowsOf(g)`.** [ADR-0015](../../../../../../../../adr/0015-feature-member-namespacing.md)
  is `proposed` and explicitly **not blocking** (issue #31): it decides where every feature's
  behavior members hang, and if namespacing wins, all features move together. Ship flat now.
- `SlotRegistry.claimMember` picks up the new key automatically — no registry edit, and a second
  feature claiming `rowsOf` throws at construction (ADR-0007), which is the desired outcome.
- **No `index.ts` change.** `GroupingMembers` is already exported; `rowsOf` rides on it.
- No `onRowsRemoved` (ADR-0006): `rowsOf` holds nothing. That is the point of deriving on call —
  the rejected `rowIds` field on every group `RenderRow` is what would have needed pruning.
- Reading `core.renderRows()` **inside** the function body is what makes it reactive. Do not hoist
  it to a `const` at factory time, and do not wrap `rowsOf` in a `computed()` — it takes an
  argument; the consumer's own `computed()` is the memo (D16's accepted O(n) cost).

## Risks / Watchouts

- **Returning ids is wrong, not a shortcut.** D16 settled rows-not-ids on the asymmetry: row→id is
  `trackBy(row)`, pure and total; id→row needs engine-internal `indexById`. Selection pays one
  `.map(table.trackBy)`.
- **Do not match on object identity.** `renderRows().find(r => r === group)` returns `[]` for a
  group plainly on screen. Step 2's function already resolves by id — just don't add an identity
  pre-check "as a fast path".
- Don't validate that the argument is `kind: 'group'` and throw — a non-group row simply matches
  no header and returns `[]`, which is the D14 degrade this contract asks for.

## Non-Goals

- No selection cascade, no `groupSelects`-style config, no group row count field. The count is
  `rowsOf(group).length` (D16, closes `0-product/grouping.md` S1).
- No library-side cache keyed by group id.
- No namespacing refactor (ADR-0015).

## Acceptance Checks

- [ ] `table.rowsOf(header)` returns every leaf beneath the header, at any depth.
- [ ] A header captured from an earlier `renderRows()` pass resolves correctly.
- [ ] A header whose cluster no longer exists returns `[]`, no throw.
- [ ] Called inside a `computed()`, it recomputes when data / filter / grouping change.
- [ ] `tsc --noEmit` passes with no new errors.

---

← [Step 2: rowsBeneathGroup() engine walk](step-2-engine-rows-beneath-group.plan.md) | [Step 4: Tests](step-4-tests.plan.md) →
