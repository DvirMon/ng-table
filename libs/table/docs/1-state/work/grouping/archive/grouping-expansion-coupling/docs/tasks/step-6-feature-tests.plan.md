# Step 6 — Feature + compile-time tests: `parentId` on both paths

**PR scope:** Consumer-seam coverage that both synthesizing features stamp the parent link, plus
the compile-time optionality assertions.
**Depends on:** Step 2 (produces `parentId`), Step 4 (the prune must already be in place, so these
run against the final pipeline).
**Parallel-safe with:** Step 5.
**Task type:** `test`
**Skills used:** `unit-test`
**Scaffolding agent:** `test-implementer`

## Files

| File                                                        | Action                                          |
| ----------------------------------------------------------- | ----------------------------------------------- |
| `libs/shared/table/src/api/features/with-grouping.spec.ts`  | edit — `parentId` on members and nested headers |
| `libs/shared/table/src/api/features/with-expansion.spec.ts` | edit — `parentId` on tree children              |
| `libs/shared/table/src/api/types.types.spec.ts`             | create — compile-time optionality               |

## Why This Step Exists

Step 5 proves the prune mechanism at the engine seam. This step proves the two producers feed it
correctly, at the seam a consumer actually uses: compose the real features via the real factory,
read `renderRows()`.

The compile-time file exists because `parentId`'s optionality is a type fact with no runtime
expression — `undefined` at runtime is indistinguishable from a field that was never optional.

## What To Do

### `with-grouping.spec.ts`

Follow the file's existing composition style. Add to the existing describe blocks rather than
creating a parallel structure.

- A cluster member's `parentId` is its header's `id`.
- A nested header's `parentId` is its parent header's `id`, at two levels of grouping.
- A top-level header has `parentId === undefined`.
- An ungrouped table's rows all have `parentId === undefined`.
- **A collapsed group still hides its members** — the existing behavior, now going through two
  prunes. If this case already exists, leave it untouched; it is the regression guard.
- A collapsed group nested inside a collapsed group stays hidden when only the outer one opens.

Take ids from the emitted header rows themselves. **Never construct or parse a `group:` id in a
test** — that creates the second construction site `engine/grouping.ts:19` exists to prevent, and
a test that hard-codes an id shape will break when the shape changes for unrelated reasons.

### `with-expansion.spec.ts`

- A tree child's `parentId` is its parent row's `id`, at depth 1 and depth 2.
- A top-level row has `parentId === undefined`.
- Existing tree assertions (`r1 → c1 → g1`, `depth` 1 and 2) pass **unedited**.

### `api/types.types.spec.ts` (new)

Model it on `src/filters/create-filters.types.spec.ts` — the existing compile-time assertion file
in this library. `expectTypeOf` / `@ts-expect-error` only, no runtime behavior.

- A `RenderRow` literal without `parentId` satisfies the type.
- `parentId` is `RowId | undefined`, not `RowId`.
- Assigning a non-`RowId` to it is a `@ts-expect-error`.

**These assertions are only enforced by `nx run shared-table:typecheck-spec`.** The test runner
executes the file without checking it, so a green `nx test` proves nothing about this file. The
acceptance check below reflects that.

## Implementation Notes

Use `table.mock.ts` fixtures rather than inlining new row data. If a fixture with a nesting shape
does not exist, add it there — not inline in a spec.

Assert on observable output only: which rows come back and what their visible fields are. Do not
assert that a particular stage produced a row, or how hiding happened. This slice's whole claim is
that hiding moved with nothing observable changing, so a test that can detect the move is testing
the wrong thing.

## Risks / Watchouts

- **No existing case may be edited.** Both feature specs must pass unedited — the primary
  acceptance criterion for #98. A failure means Step 2 or Step 4 is wrong, not the test.
- **Do not hard-code a group id.** Read it off the emitted header.
- `types.types.spec.ts` is a new file in `api/`. Confirm `tsconfig.spec.json`'s include actually
  covers it before relying on the check — a compile-time assertion file that nothing typechecks is
  worse than none, because it reads as coverage.
- The spec typecheck is a **separate target** from the lib one. Both must be run; a green lib
  typecheck says nothing about a spec file, since `tsconfig.lib.json` excludes `*.spec.ts`.

## Non-Goals

- No engine-seam assertions — Step 5.
- No assertions about the slot's internal shape or about which party owns the prune.
- No pagination.

## Acceptance Checks

- [ ] `parentId` asserted on cluster members, nested headers, and tree children at two depths.
- [ ] `undefined` asserted on top-level headers, top-level rows, and flat ungrouped rows.
- [ ] Collapsed-group and nested-collapsed-group hiding still asserted.
- [ ] No test constructs or parses a `group:` id.
- [ ] `api/types.types.spec.ts` exists, modeled on `filters/create-filters.types.spec.ts`.
- [ ] Every pre-existing case in both feature specs passes **unedited**.
- [ ] `nx test shared-table` green.
- [ ] `nx run shared-table:typecheck-spec` clean — the only thing that enforces the type assertions.

---

← [Step 5: Engine tests](step-5-engine-tests.plan.md) | [Step 7: Mark D11 and ADR-0011 superseded](step-7-supersede-records.plan.md) →
