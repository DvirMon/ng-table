---
step: 1
type: code
commit: feat
depends_on: []
files:
  - libs/table/src/engine/tree-links.ts (new)
  - libs/table/src/engine/tree-links.spec.ts (new)
---

# Step 1 — `tree-links`: resolve parent links, degrade broken ones

This step adds a pure engine helper that maps every row to its
parent id and reports broken links by kind.
It leaves nesting into `RenderNode`s, reporting to the console,
and the throwing-callback case to Step 2.

Decisions: [D4](../../1-decisions.md), [D12](../../1-decisions.md), [ADR-0014](../../../../../../../adr/0014-runtime-error-policy.md), [ADR-0028](../../../../../../../adr/0028-tree-parent-link-slot.md).

## Do

- Add `engine/tree-links.ts`. Pure logic, no Angular, no
  signals. Not exported from `index.ts`.
- Shape:

  ```ts
  export type BrokenLinkKind = 'self' | 'absent' | 'cycle';

  export interface TreeLinks {
    readonly parentById: ReadonlyMap<RowId, RowId | null>;
    readonly broken: Readonly<Record<BrokenLinkKind, readonly RowId[]>>;
  }

  export function resolveTreeLinks<TRow>(
    rows: readonly TRow[],
    ctx: { parentOf: ParentLink<TRow>; trackBy: TrackByFn<TRow> },
  ): TreeLinks;
  ```

  Object-param shape matches `resolveIndex` in `engine/rows.ts`.

- Resolve each row's parent over the given row list. A
  self-parent, a parent id absent from the list, or a cycle
  (the first row of the cycle in input order) maps that row to
  `null` and files its id under the matching `broken` kind. Its
  own subtree keeps its links.
- Every other row keeps its declared link, whether or not its
  parent appears before it in `rows`.

## Watch out

- A falsy row id such as `0` is a real parent — never test
  parent presence with plain truthiness.
- Parents can appear after their children in `rows`; don't
  assume input order is parent-before-child.
- A row hanging off a cycle (its ancestor chain reaches a
  cyclic node, but it isn't part of the cycle itself) keeps its
  own link and is never reported.

## Out of scope

- Nesting rows into `RenderNode`s — Step 2.
- Reporting to the console — Step 2.
- A `parentOf` that throws or returns `undefined` — the caller
  passes a total `ParentLink` (Step 2's contribution).
- Duplicate row ids (#156).

## Done when

- [ ] The eight seams in `step-1-tree-links.test-plan.md` pass.

---

[Step 2: `withTree({ parentId })` nests flat rows](step-2-with-tree-parent-id.plan.md) →
