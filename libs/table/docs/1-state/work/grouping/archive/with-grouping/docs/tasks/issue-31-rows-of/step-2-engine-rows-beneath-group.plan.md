---
title: 'Step 2 — rowsBeneathGroup() pure engine walk'
type: task-step
issue: 65
---

# Step 2 — `rowsBeneathGroup()` pure engine walk

**PR scope:** One pure function in `engine/grouping.ts`, nothing wired. **Parallel-safe with
Step 1.**

**Task type:** code

**Skills used:** angular-developer, file-organization

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/engine/grouping.ts` (edit)

## Why This Step Exists

`rowsOf` is two separable things: _where the render rows come from_ (Step 1/3) and _which of them
sit beneath a header_ (this step). The second is a pure `RenderRow[] → TRow[]` walk with no
signals and no Angular — so it belongs in `engine/`, gets plain `vitest` cases, and stays out of
the feature factory (`CLAUDE.md`: pure engine code needing a harness landed in the wrong file).

Decision: `../../../2-decisions.md` D16 / D16.1.

## What To Do

Add to `engine/grouping.ts`, alongside the other cluster walks:

```ts
/**
 * Every leaf row beneath a group header, at any depth — D16's "leaf rows, not immediate
 * children". Resolves by `id`, never object identity (D16.1): `renderRows()` rebuilds its
 * objects each pass, so a header held across renders is a stale object carrying a stable id.
 * An id matching no current header returns `[]` (D14 runtime degrade).
 */
export function rowsBeneathGroup<TRow>(rows: readonly RenderRow<TRow>[], groupId: RowId): TRow[] {
  const start = rows.findIndex((row) => row.kind === 'group' && row.id === groupId);
  if (start === -1) {
    return [];
  }
  const headerDepth = rows[start].depth;
  const leaves: TRow[] = [];
  for (let i = start + 1; i < rows.length && rows[i].depth > headerDepth; i++) {
    const row = rows[i];
    if (row.kind !== 'group' && row.data !== null) {
      leaves.push(row.data);
    }
  }
  return leaves;
}
```

`RowId` joins the existing `import type { … } from '../api/types'` line.

## Implementation Notes

- **Why a contiguity walk and not a second `buildClusters()` pass.** `emitGroupRows` already
  emitted headers immediately followed by their nested headers and leaves, contiguous at every
  depth, with `depth` incrementing per level. Re-deriving the tree would duplicate the
  path-id construction (`group:${path}`) in a second place — two walks that must agree on ids is
  exactly the drift `buildGroupRenderRows` avoided by reusing `buildClusters`.
- **Terminate on `depth <= headerDepth`, not on the next `kind: 'group'`.** A nested header is a
  _descendant_, so the walk must pass through it (skipping it as a value) and keep going.
- Signature takes `RowId`, not `RenderRow` — the public member takes the header (D16.1 settled
  `RenderRow` for the call site) and passes `group.id` down. Keeping the engine at the id means
  the pure function has no opinion about the parameter-ergonomics call.
- Returns `TRow[]`; the member's return type narrows it to `readonly TRow[]`. Don't add a
  `freeze`/copy — the array is freshly built per call.

## Risks / Watchouts

- **`withExpansion()`'s `'tree'` render stage runs after `'group'`** and can insert child rows at
  `depth > parent`. Those are `kind: 'row'` descendants of the group, so they are included — that
  is correct under "every leaf beneath it, at any depth", not a bug to guard against.
- Don't filter on `sourceIndex` to detect synthetic rows; `data !== null` is the documented
  discriminator (`api/types.ts`), and a future render stage could synthesize a row with data.

## Non-Goals

- No member wiring, no `GroupingMembers` change (Step 3).
- No tests in this step (Step 4) — the function is exported, so it is reachable from
  `engine/grouping.spec.ts` when that lands.
- No caching/memoization. D16 accepts O(n) per call and names a consumer-side `computed()` as the
  recipe; a library cache is explicitly rejected there.

## Acceptance Checks

- [ ] `rowsBeneathGroup()` exported from `engine/grouping.ts`, pure — no signal read, no Angular
      import added.
- [ ] Returns leaves at any depth beneath the header, skipping nested `kind: 'group'` rows.
- [ ] Unknown id returns `[]`, no throw.
- [ ] `tsc --noEmit` passes with no new errors.

---

← [Step 1: renderRows on TableCore](step-1-core-render-rows.plan.md) | [Step 3: rowsOf member](step-3-rows-of-member.plan.md) →
