# Step 1 test plan — tree-links: resolve parent links, degrade broken ones

Step: [step-1-tree-links.plan.md](step-1-tree-links.plan.md)
Spec file: `libs/table/src/engine/tree-links.spec.ts`

Pure vitest, no `TestBed`: `engine/` is pure (libs/table CLAUDE.md). Layout follows `engine/rows.spec.ts`: one `describe` per export, small rows written inline as `{ id, parent }`, and `trackBy = (r) => r.id`. There is no tree fixture in `table.mock.ts`, and each case needs its own specific broken shape, so the rows stay inline.

## Stubs (red phase)
- `export type BrokenLinkKind = 'self' | 'absent' | 'cycle';` (type only, no stub body)
- `export interface TreeLinks { readonly parentById: ReadonlyMap<RowId, RowId | null>; readonly broken: Readonly<Record<BrokenLinkKind, readonly RowId[]>>; }` (type only)
- `export function resolveTreeLinks<TRow>(rows: readonly TRow[], ctx: { parentOf: ParentLink<TRow>; trackBy: TrackByFn<TRow> }): TreeLinks` — throws `not implemented: resolveTreeLinks`

## Seams — in red-green order
### A. Valid links → each row maps to its declared parent; roots map to `null`; no broken links
- Test: `it('maps every row to its declared parent and roots to null')`
- Asserts: rows `r(null)`, `c1(r)`, `g1(c1)` → `parentById` equals `Map{ r→null, c1→r, g1→c1 }`, and `broken` equals `{ self: [], absent: [], cycle: [] }`.
- Why this seam: the base case. It catches a helper that drops root rows from the map, or reports broken links on clean data. A false report would make Step 2 warn on every evaluation.
- Order reason: independent. Every other seam builds on it.
### B. Child listed before its parent → still a valid link, not `absent`
- Test: `it('resolves a parent that appears later in input order')`
- Asserts: rows `c1(r)`, `r(null)` → `c1→r`, and `broken.absent` is `[]`.
- Why this seam: catches a single-pass check that asks "have I seen this parent yet?" instead of checking the full id set. Real data is often not ordered parents-first, and a sort upstream can reorder it.
- Order reason: builds on A (the valid-link path).
### C. Parent id `0` → a real link, not a root
- Test: `it('treats a falsy parent id such as 0 as a link')`
- Asserts: rows `0(null)`, `1(0)` → `1→0`, with no broken links.
- Why this seam: `RowId` is `string | number`. A truthiness check like `if (!parentId)` would turn the children of row 0 into roots, and no report would show it.
- Order reason: builds on A.
### D. Self-parent → that row becomes a root and is reported under `self`; its children keep their link
- Test: `it('degrades a self-parented row to root and keeps its children')`
- Asserts: rows `a(a)`, `a1(a)` → `a→null`, `a1→a`, `broken.self` equals `['a']`, and `absent` and `cycle` are empty.
- Why this seam: catches a missing self-check (which would end in an infinite ancestor walk, or be misfiled as a one-node cycle). It also catches a fix that cuts off the subtree. D4 requires "subtree intact".
- Order reason: builds on A.
### E. Parent id missing from the row list → the row becomes a root and is reported under `absent`; its subtree stays intact
- Test: `it('degrades a row whose parent is absent to root and keeps its subtree')`
- Asserts: rows `o(ghost)`, `o1(o)` → `o→null`, `o1→o`, and `broken.absent` equals `['o']`.
- Why this seam: catches passing a dangling id through. Step 2's nesting would then drop the row, and hiding data is the direction we cannot recover from (D4). It also catches reporting the child `o1` as well, which would over-report.
- Order reason: builds on A and B (the membership check that B pins against the full id set).
### F. Cycle → the first row of the cycle in input order becomes a root and is reported under `cycle`; the rest keep their links
- Test: `it('breaks a cycle at its first row in input order')`
- Asserts: rows listed as `b(a)`, `a(b)`. Input order differs from id sort order. Result: `b→null`, `a→b`, and `broken.cycle` equals `['b']`.
- Why this seam: catches an unbroken cycle (infinite walk in Step 2). It also catches breaking at the wrong row: by id sort, by the last row seen, or at both rows (which would split the subtree).
- Order reason: builds on D. A self-parent is the one-node cycle, and D must already have taken it out of this path.
### G. Row whose ancestor chain enters a cycle → keeps its link and is not reported
- Test: `it('keeps links of rows hanging off a cycle')`
- Asserts: rows `a(b)`, `b(a)`, `d(a)` → `a→null`, `b→a`, `d→a`, and `broken.cycle` equals `['a']`.
- Why this seam: catches cycle detection that marks every row whose ancestor walk revisits a node. That would move `d` to the root and report it, even though `d`'s own link is fine.
- Order reason: builds on F.
### H. Mixed broken kinds, several per kind → each id listed only under its own kind, in input order
- Test: `it('groups broken links by kind in input order')`
- Asserts: rows `s2(s2)`, `x(ghost)`, `s1(s1)`, `p(q)`, `q(p)` → `broken` equals `{ self: ['s2', 's1'], absent: ['x'], cycle: ['p'] }`.
- Why this seam: the caller reports once per kind, from these lists. This catches overwriting instead of accumulating, and filing one kind's ids under another.
- Order reason: builds on D, E and F.

## Types phase (after green)
None — no public type surface in this step. (`engine/tree-links.ts` is internal and not re-exported from `index.ts`. `TRow` is inferred from `rows` with no conditional or mapped types, so there is nothing to pin with `expectTypeOf`.)

## Not tested
- `parentOf` throwing or returning `undefined` — out of scope for this step. The caller (withTree, Step 2) passes a total `ParentLink` that already maps both to `null`.
- Reporting (console, dedupe once per evaluation) — not this helper's concern. It only returns the lists. Reporting is tested through the `createTable()` store in Step 2 (spec seam 1).
- Nesting into `RenderNode`s, depth, `hasChildren` — Step 2.
- Duplicate row ids — out of scope, #156.
- Empty row list — no branch of its own. A and H already cover the empty `broken` shape and the map-building loop.
- Long chains, or performance on deep trees — nothing new in the logic beyond A. Timing tests catch no logic bug.
- Each `broken` array being readonly — a compile-time property, not behaviour.

## Decisions (resolved in review, 2026-09-29)
- Return shape: `parentById` Map + always-present `broken` record (user approved).
- Kind literals: `'self' | 'absent' | 'cycle'`; Step 2 adds the throw report.
- Parameters: `(rows, { parentOf, trackBy })`, matching `resolveIndex` in `engine/rows.ts`.
