# Step 4 — G76 split specs

**PR scope:** standalone. **Depends on:** Step 1.
**Parallel-safe with:** Step 2, Step 3

**Task type:** test

**Skills used:** unit-test

**Scaffolding agent:** test-implementer

## Files

- `libs/table/src/schema/validate.spec.ts` (edit)
- `libs/table/src/api/features/with-grouping/feature.spec.ts`
  (edit — next to `:640-726`)

## Why This Step Exists

Issue #132 acceptance criterion: "G76's split holds:
grouping's construction-path throw is now dev-only;
grouping's writer-path throw still fires in a production
build. Both asserted."

Step 1 made that split structural. This step proves it from
outside: first through the shared body, then through
`withGrouping`.

## What To Do

### 1. `validate.spec.ts`

- Fix `:15-16` for the E12 message. Assert that it no longer
  mentions a `columns` array. Match on label and id, not on
  the full string.
- With `ngDevMode = false`, `assertDeclarationsAreKnown`
  does not throw on an unknown id.
- With `ngDevMode = false`, the ungated writer export (named
  in Step 1's hand-off) still throws.

### 2. `with-grouping/feature.spec.ts`

Under `ngDevMode = false`, restored in a `finally`:

- **Construction is dev-only.** `withGrouping({ initial:
  ['nope'] })` builds without throwing. This is the same
  setup as `:640-648`.
- **Writer still throws.** `store.grouping.update(
  addGroupLevel('nope'))` throws
  `/\[withGrouping\].*"nope"/`. This is the same setup as
  `:680-690`.

Keep the existing dev-mode cases (`:648`, `:663`, `:678`,
`:690`, `:719`, `:1754`) unchanged. They are the "throws in
dev" half.

## Implementation Notes

- Reuse the `ngDevMode` get/set helper from
  `columns.spec.ts:14-23`. If Step 3 moved it into a shared
  test helper, import it from there, and don't write a
  third copy.
- Build the "writer still throws" store under
  `ngDevMode = false` too. Otherwise the test doesn't show
  a production build.

## Risks / Watchouts

- Leaving `ngDevMode = false` set leaks into later cases.
  Always use `try`/`finally`.

## Non-Goals

- The columns-side checks (Step 3).
- G72's degrade path in `groupingLevels`. It is unchanged.

## Acceptance Checks

- [ ] Under `ngDevMode = false`, grouping's construction
      does not throw on an unknown level.
- [ ] Under `ngDevMode = false`, grouping's writer throws on
      an unknown level.
- [ ] `validate.spec.ts` covers the message change and both
      exports under `ngDevMode = false`.
- [ ] `nx run shared-table:typecheck-spec` clean.
- [ ] The touched spec files pass.

---
← [Step 3: Construction-check specs](step-3-construction-check-specs.plan.md) | [Step 5: Record it](step-5-record-it.plan.md) →
