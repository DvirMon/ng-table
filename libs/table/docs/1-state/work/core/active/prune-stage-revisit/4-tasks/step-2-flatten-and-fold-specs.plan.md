# Step 2 — The engine IR seam pair: flatten and fold specs

**PR scope:** One PR. `Depends on: Step 1`
`Parallel-safe with: Step 3, Step 4, Step 5, Step 6, Step 7`

**Task type:** `test`
**Stack:** `angular`
**Skills used:** `unit-test`
**Scaffolding agent:** `test-implementer`

## Files

| Path                                          | Action  |
| --------------------------------------------- | ------- |
| `libs/table/src/engine/flatten.spec.ts`       | **new** |
| `libs/table/src/engine/render-stages.spec.ts` | rewrite |

## Why This Step Exists

These two files are one move, not two. The visibility cases living in
`render-stages.spec.ts` today are exactly the cases `flatten.spec.ts`
inherits — splitting the pair across two steps is how a case gets
duplicated in both files or dropped from both.

`flatten.spec.ts` is the answer to user story 24: one file where "why
is this row hidden" is asked.

## What To Do

### `engine/flatten.spec.ts` (new)

Owns the **entire** visibility rule. Plain `vitest`, no `TestBed` —
`flattenVisible` is pure. Cover:

- **Descent.** An open node yields its children; a closed node does
  not. Transitive: a grandchild is absent when the grandparent is
  closed, even when the parent's own id is in `expanded`.
- **`depth`.** Derived from nesting position; a child is
  `parent.depth + 1`, at every level.
- **`parentId`.** Derived from position; a root node's is
  `undefined`.
- **`hasChildren` resolution.** `children.length > 0` by default; an
  explicit `hasChildren: true` wins on a node with `children: []`
  (the lazy row, C3); an explicit `false` wins on a node that has
  children.
- **Descent is `isOpen` alone.** A node with `hasChildren: true` and
  `children: []` yields nothing extra — and a node with
  `hasChildren: false` but a non-empty `children` array, when open,
  still yields them.
- **`isExpanded` stamping (D1 / D1a).** Stamped only when
  `expanded !== undefined` **and** the node has children. Three
  cases: `expanded === undefined` ⇒ `undefined` on every row,
  headers included, everything visible; a contributed set ⇒ `true` /
  `false` per membership on nodes with children; a leaf ⇒
  `undefined` either way.
- **X1 — zero contributors vs. empty set.** `undefined` shows every
  nested row; `new Set()` hides every nested row. These are the two
  cases inherited verbatim from `render-stages.spec.ts` (its `D5`
  case and its "currently-empty contributed set" case).

### `engine/render-stages.spec.ts` (rewrite)

Keeps only three concerns:

- **Fold order** — stages run in `RENDER_ORDER` regardless of
  registration order. Assert `trace` equals `[...RENDER_ORDER]`
  directly; the `CLAIMABLE_RENDER_STAGES` comparison and its
  explanatory comment go away with the constant.
- **Pass-through** — an unregistered stage is skipped; no stages
  registered returns the input reference; each stage's output threads
  into the next.
- **`mapNodes` reach** — a `fn` applied through `mapNodes` reaches a
  node nested two levels under another stage's output, proving C1/C2.
  Post-order: assert `fn` saw already-mapped children, by producing a
  value that depends on them — never by asserting a call order or a
  call count.

**Delete, do not port:** the
`documents the emit-order contract` case. The hazard it documented no
longer exists. Deleting it is an explicit acceptance criterion on
#107, so do not soften it into a comment.

## Implementation Notes

- The existing fake-stage helpers carry over directly: a
  trace-pushing transform and a minimal row literal become a
  trace-pushing node transform and a minimal node literal.
- Assert what the walk **produces**, never how it walks. No recursion
  order, no call counts, no intermediate array identity — except the
  one existing identity assertion that a zero-stage fold returns its
  input reference, which is a contract, not a walk detail.
- `mapNodes` gets no spec file of its own; its reach case lives here.

## Risks / Watchouts

- The easiest wrong test here is one that asserts `isExpanded: false`
  where D1a says `undefined`. Write the zero-contributor case first
  and let it fix the shape of the others.
- Do not re-assert grouping's or expansion's behaviour from these
  files. If breaking an assertion would require editing
  `grouping/render.ts` or `with-expansion.ts`, it belongs in Step 3
  or Step 4.

## Non-Goals

- Recursion depth limits and cyclic `children` (C5) — out of scope.
- Anything reached through a live `createTable()`. Both files stay
  pure unit seams.

## Acceptance Checks

- [ ] `nx test shared-table` passes for both files.
- [ ] `nx run shared-table:typecheck-spec` clean on a second,
      source-clean run.
- [ ] `grep -n "emit-order\|emission order" libs/table/src/engine/render-stages.spec.ts`
      returns nothing.
- [ ] `flatten.spec.ts` has a case for each of: descent, `depth`,
      `parentId`, `hasChildren` override, `isExpanded` under a
      contributed slot, `isExpanded` under zero contributors, and the
      X1 pair.

---

← [Step 1: The IR migration](step-1-node-ir-migration.plan.md) | [Step 3: Grouping's node tree](step-3-grouping-render-spec.plan.md) →
