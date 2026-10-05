---
step: 2
type: code
commit: feat
depends_on: [1]
files:
  - libs/table/src/api/features/with-tree.ts
  - libs/table/src/api/features/with-tree.spec.ts
  - libs/table/src/table.mock.ts
---

# Step 2 — `withTree({ parentId })` nests flat rows

This step adds a `parentId` accessor to `withTree()` and nests
flat rows into the tree using Step 1's helper.
It leaves the `parentOf` / `descendantsOf` reads and removing
`childrenAccessor` to later steps.

Decisions: [D1](../../1-decisions.md), [D4](../../1-decisions.md), [D9](../../1-decisions.md), [D11](../../1-decisions.md), [E13](../../1-decisions.md), [ADR-0014](../../../../../../../adr/0014-runtime-error-policy.md), [ADR-0028](../../../../../../../adr/0028-tree-parent-link-slot.md).

## Do

- Add to `WithTreeConfig`:

  ```ts
  parentId?: (row: TRow) => RowId | null | undefined;
  ```

  `null` and `undefined` both mean root. `childrenAccessor`
  stays for now; existing nested tests are untouched.

- With `parentId` set, contribute `parentLink` as a total
  function: a throw or an `undefined` return both map to
  `null`. This contribution never reports.
- With `parentId` set, claim the `'tree'` render stage. That
  stage resolves links over its own input nodes with
  `resolveTreeLinks` and nests by parent id. Sibling order
  follows the stage's input order. Group headers
  (`data === null`) pass through unchanged; nesting happens
  inside each header's member list.
- Only the `'tree'` stage reports. Report once per broken-link
  kind per evaluation — a throwing `parentId`, a self-parent,
  an absent parent, and a cycle each report separately, through
  the existing `console.error` floor (dev and production
  alike, per ADR-0014).
- `hasChildren` uses `isExpandable` when given, otherwise "this
  row has a child in the input".
- `expand()` with no ids, and `state()`, discover expandable
  rows from flat `input.rows()` when `parentId` is set. They
  degrade the same way the tree stage does, but never report —
  only the tree stage reports.
- Omitting `parentId` claims neither the stage nor the link —
  collapse-only composition is unchanged.
- Add `makeFlatRows()` to `src/table.mock.ts` (per lib
  `CLAUDE.md`, mock data doesn't live inline in a spec).

Usage:

```ts
createTable(rows, { trackBy: 'id', columns }, withTree({ parentId: (row) => row.parentId }));
```

## Watch out

- Until #168 lands, a filter that drops a parent makes its
  children report as `absent`.
- Type checks for `parentId` go in the spec's existing
  `describe('types')` block, not a new one.

## Out of scope

- `parentOf` / `descendantsOf` reads — Step 3.
- Removing `childrenAccessor` — Step 5.
- Filter context rows (#168).
- Roots-only grouping (#170).

## Done when

- [ ] Seams A through O in `step-2-with-tree-parent-id.test-plan.md` pass.

---

← [Step 1: tree-links: resolve parent links, degrade broken ones](step-1-tree-links.plan.md) | [Step 3: tree reads — parentOf / descendantsOf, and removeRow(id[])](step-3-tree-reads.plan.md) →
