# Step 3 — Grouping's render spec asserts the node tree

**PR scope:** One PR. `Depends on: Step 1`
`Parallel-safe with: Step 2, Step 4, Step 5, Step 6, Step 7`

**Task type:** `test`
**Stack:** `angular`
**Skills used:** `unit-test`
**Scaffolding agent:** `test-implementer`

## Files

| Path                                            | Action |
| ----------------------------------------------- | ------ |
| `libs/table/src/engine/grouping/render.spec.ts` | edit   |

## Why This Step Exists

The grouping stage no longer produces `depth` or `parentId` — the
walk does. A spec asserting them here would be asserting another
module's facts, and would survive exactly the refactor that was
supposed to cut the seam (user story 25).

## What To Do

1. **Move the position assertions out.** Lines 86, 101 and 146 carry
   the `depth` / `parentId` expectations. Delete them here; Step 2's
   `flatten.spec.ts` owns them. Do not weaken them into a comment.
2. **Assert the tree the stage builds** in their place:
   - one `kind: 'group'` header node per **admitted** cluster;
   - its members sit in that header's `children`, not as following
     siblings;
   - a **non-admitted** cluster's items are inlined at the parent's
     level — no header node wraps them, and nothing recurses into its
     `children`;
   - nested grouping levels produce headers inside headers.
3. **Keep unchanged:** aggregates, label resolution (explicit →
   matching column → raw field name), the throwing-`aggregateFn`
   fallback and its once-per-column reporting, cluster ordering, and
   the "group stage must run first" throw.
4. **D2 — a header carries no `hasChildren` at all now.** Where the
   spec asserted `hasChildren: true` off `items.length > 0`, assert
   the header's `children` array instead. The stamped flag is the
   walk's, and it is tested in Step 2.

## Implementation Notes

- Keep the local input helper. Building the input through a helper
  rather than a live store is why this file stays a unit seam; the
  spec's Testing Decisions names it as prior art to preserve.
- The seed the stage receives is still flat — every node has
  `data !== null` and `children: []`. Build fixtures that way.
- If Step 1 renamed `buildGroupRenderRows` to
  `buildGroupRenderNodes`, follow the rename here and rename the
  describe block. Check the Step 1 PR body before starting.

## Risks / Watchouts

- Asserting the whole node object with `toEqual` will couple this
  file to fields it does not own. Assert the shape of `children` and
  the header's own `id` / `kind` / `groupKey` / `aggregates`.
- A non-admitted cluster used to be re-stamped with the parent's
  `depth` and `parentId` on the way out. Now it is a plain splice of
  the items into the parent's level — assert the splice, not a
  stamp that no longer happens.

## Non-Goals

- `depth`, `parentId`, `hasChildren` resolution and `isExpanded` —
  all Step 2's.
- End-to-end assertions through `renderRows()` — Step 4's.
- Any change to `engine/grouping/clusters.ts` or its spec; the
  cluster builders are generic over the item type and did not move.

## Acceptance Checks

- [ ] `nx test shared-table` passes for this file.
- [ ] `nx run shared-table:typecheck-spec` clean on a second,
      source-clean run.
- [ ] `grep -n "depth\|parentId" libs/table/src/engine/grouping/render.spec.ts`
      returns nothing.
- [ ] Every previously passing grouping assertion other than the
      moved ones still passes, with the D2 change as the only diff.

---

← [Step 2: The engine IR seam pair](step-2-flatten-and-fold-specs.plan.md) | [Step 4: Expansion end-to-end](step-4-expansion-spec.plan.md) →
