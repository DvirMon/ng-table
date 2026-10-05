# Step 4 — Expansion end-to-end: the lazy override and the C4 flip

**PR scope:** One PR. `Depends on: Step 1`
`Parallel-safe with: Step 2, Step 3, Step 5, Step 6, Step 7`

**Task type:** `test`
**Stack:** `angular`
**Skills used:** `unit-test`
**Scaffolding agent:** `test-implementer`

## Files

| Path                                                 | Action |
| ---------------------------------------------------- | ------ |
| `libs/table/src/api/features/with-expansion.spec.ts` | edit   |

## Why This Step Exists

This file already asserts at the highest seam — through
`table.renderRows()` on a live `createTable()` — so the migration
should leave most of it alone. It is the proof that the two named
behaviour diffs, and only those two, reached a consumer.

## What To Do

1. **Run it unchanged first** and record every failure. Only the C4
   diff should fail. Anything else failing is a Step 1 bug, not a
   spec to update — report it rather than editing the assertion.
2. **C4 — the childless-data-row flip.** Today `buildTreeStage`
   stamps `isExpanded: expanded.has(row.id)` on every data row,
   childless ones included. Now a childless row's `isExpanded` is
   `undefined`. Update the affected assertions and add one case that
   states the flip directly: a flat table with `withExpansion()`
   composed and nothing expandable has `isExpanded === undefined` on
   every row.
3. **C3 — the lazy `hasChildren` override.** New case: a row whose
   `childrenAccessor` returns `[]` but whose `isExpandable` returns
   `true` renders with `hasChildren: true`, so a template can show
   its toggle before the children are fetched. Toggling it open adds
   no rows; supplying the children afterwards makes them appear at
   `depth + 1`.
4. **The `'tree'` stage reads no state (user story 7).** Add or
   adjust a case proving visibility now comes from the walk: with
   `withExpansion()` composed and nothing expanded, nested rows are
   absent; after one `toggleExpanded`, exactly that subtree's direct
   children appear.
5. **`mapNodes` reach through group nodes (C1).** Compose
   `withGrouping()` and `withExpansion()` together and assert a data
   row nested under a group header still gets its own children
   nested. This is the capability today's version does not have, so
   it is a new case, not an adjusted one.

## Implementation Notes

- The store-level `createTable(...)` + `renderRows()` pattern already
  in this file is the model for the two-feature case; keep it.
- Assert on visible rows, depths and `parentId` through
  `renderRows()` — that is this file's domain, unlike Step 3's.
- `everExpanded`, `rowExpanded` emissions, `expandAll` / `collapseAll`
  and `onRowsRemoved` pruning are untouched by this migration. If one
  of their cases fails, it is a Step 1 regression.

## Risks / Watchouts

- **Do not update an assertion to match observed output.** The gate
  on #107 is "exactly the D2 and C4 diffs and no others". An
  assertion that changed for a third reason is a bug you just wrote
  down as expected behaviour.
- The two-feature case is where D1a shows up at a consumer level: a
  group header in a table that _does_ compose `withExpansion()` gets
  a real `isExpanded`. That is the intended win (user story 13) — not
  a regression.

## Non-Goals

- The grouping-only D1a case (`isExpanded` stays `undefined` with no
  expansion feature composed) — Step 2 owns it at the walk, and the
  existing grouping feature spec covers it end-to-end.
- Detail panels: never were render rows, gated through
  `everExpanded`, unaffected.
- Duplicate row ids across subtrees (X2) — ADR-0020 D5 owns it.

## Acceptance Checks

- [ ] `nx test shared-table` passes for this file.
- [ ] `nx run shared-table:typecheck-spec` clean on a second,
      source-clean run.
- [ ] A C3 lazy-override case and a C4 flip case both exist and are
      named as such.
- [ ] A grouping + expansion case asserts children nested under a
      group header.
- [ ] The PR body lists every assertion that changed and ties each to
      D2 or C4.

---

← [Step 3: Grouping's node tree](step-3-grouping-render-spec.plan.md) | [Step 5: core.spec and the wording sweep](step-5-core-spec-and-sweep.plan.md) →
