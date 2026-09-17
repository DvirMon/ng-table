# Step 2 — `RenderRow.parentId` + both synthesizing stages stamp it

**PR scope:** The field on the public row type, plus the two emit sites that populate it. Purely
additive — nothing reads the field yet.
**Parallel-safe with:** Step 1.
**Task type:** `code`
**Skills used:** `angular-developer`
**Scaffolding agent:** `angular-implementer`

## Files

| File | Action |
|---|---|
| `libs/shared/table/src/api/types.ts` | edit — add `parentId?: RowId` to `RenderRow` |
| `libs/shared/table/src/engine/grouping.ts` | edit — `emitGroupRows` stamps it on nested headers and leaves |
| `libs/shared/table/src/api/features/with-expansion.ts` | edit — `expandRow` / `toChildRenderRow` stamp it on tree children |

## Why This Step Exists

The missing parent link is the root cause the whole epic addresses. Landing the field and its two
producers before anything consumes it keeps the change reviewable on its own: this PR is
provably behavior-neutral, because no code path branches on the new field.

Independent of Step 1 — D1 fixes the field's shape, and the ADR's open questions are all about the
*prune*, none about the field.

## What To Do

### `api/types.ts`

Add to `RenderRow<TRow>`, beside the other optional feature-contributed fields (currently
`groupKey`, `aggregates`, `isExpanded`, `hasChildren`, `sourceIndex` at lines 51-63):

```ts
// The id of the render row this one was synthesized beneath — the group header for a cluster
// member, the parent row for a tree child. Set by the synthesizing stage at emit time;
// `undefined` on a top-level row and whenever nothing nests. Opaque: never parsed back apart,
// since a group id's separators differ from a tree id's.
readonly parentId?: RowId;
```

Match the surrounding comment style — these are `//` maintainer comments, not JSDoc.

### `engine/grouping.ts` — `emitGroupRows` (lines 208-238)

The header's own id is already in scope as `id` (line 219). Two call sites need it threaded:

- The recursive call for nested headers (line 236) — `emitGroupRows` takes a new `parentId`
  parameter, and each header it emits carries the one it was handed.
- The leaf map (line 237) — `node.items.map(item => ({ ...item, depth: depth + 1 }))` becomes
  `({ ...item, depth: depth + 1, parentId: id })`.

Top-level headers get `undefined`, so the new parameter is optional or takes `undefined` at the
entry call in `buildGroupRenderRows` (line 275).

**Leave the `isExpanded` gate at line 232 exactly as it is.** Grouping keeps pruning in this slice
(D6) — deleting it is #99.

### `api/features/with-expansion.ts` — the tree stage

`toChildRenderRow` (around line 69) builds a child render row from a `TRow` and a depth. It needs
the parent's id. The caller — `expandRow`'s `children.flatMap(...)` — has `row.id` in scope, so
either thread it as a parameter or spread it at the call site. Prefer the parameter: it keeps the
"a child always knows its parent" invariant in one place rather than relying on every caller to
remember the spread.

`expandRow`'s early return for `row.data === null` (pass-through of a `'group'` header produced by
the preceding stage) stays untouched — those rows already carry the `parentId` grouping gave them,
and re-stamping would overwrite a correct value with a wrong one.

**Leave the `!self.isExpanded` gate as it is** — same reason as grouping (D6).

## Implementation Notes

The field is populated on create, never assigned in a second pass. Both emit sites already hold the
parent's id at the moment they emit; if an implementation finds itself building a lookup map, it
has taken a wrong turn.

`parentId` is a `RowId`, which is `string | number`. A group id is a `string` built by
`toGroupId`; a tree parent id comes from `trackBy`, so it can be either. No narrowing anywhere.

## Risks / Watchouts

- **Do not parse a group id.** `engine/grouping.ts:19` centralizes id construction in
  `buildGroupPath` / `toGroupId` specifically to prevent a second construction site; the mirror
  rule is no deconstruction site. Prior art records a live upstream bug from exactly this.
- **Do not touch either expansion gate.** This step must be behavior-neutral; a green test suite is
  the evidence, and changing a gate here would make that evidence meaningless.
- `emitGroupRows` is recursive with six parameters already. Adding a seventh positional is
  acceptable here (it matches the file's existing style) but check it reads clearly at the
  recursive call.

## Non-Goals

- No prune, no `RENDER_ORDER` change, no `collapsedRows` slot.
- No tests — Step 6 covers `parentId` assertions and the compile-time optionality check.
- No deletion of `readExpandedRows` (that is #99).

## Acceptance Checks

- [ ] `RenderRow.parentId?: RowId` exists with a maintainer comment matching the file's style.
- [ ] A cluster member carries its header's id; a nested header carries its parent header's id.
- [ ] A tree child carries its parent row's id, in the same field.
- [ ] A top-level header and a flat ungrouped row both have `parentId === undefined`.
- [ ] Neither expansion gate changed (`grouping.ts:232`, `expandRow`'s `!self.isExpanded`).
- [ ] `nx run shared-table:typecheck` clean — template-aware; re-run after fixing any `.ts` error, since `ngc` aborts before the template phase.

---
← [Step 1: ADR-0017](step-1-adr.plan.md) | [Step 3: `collapsedRows` slot](step-3-collapsed-rows-slot.plan.md) →
