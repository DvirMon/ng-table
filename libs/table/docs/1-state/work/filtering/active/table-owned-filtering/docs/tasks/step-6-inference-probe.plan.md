# Step 6 — Rewrite the compile-time probe for `StateOf` inference

**PR scope:** PR 1 of 1 (`#90`). **Depends on: Step 5.**
**Task type:** `test`
**Stack:** angular
**Skills used:** `unit-test`
**Scaffolding agent:** `test-implementer`

## Files

| File | Line | Action |
|---|---|---|
| `libs/table/src/filters/create-filters.types.spec.ts` | `:1-322` | rewrite — probes `withFiltering`'s object schema, not `createFilters` |
| `libs/table/src/filters/create-filters.spec.ts` | — | edit — only what the construction-throw changes force |

## Why This Step Exists

Issue `#90`'s acceptance demands the inference be asserted **with a compiled probe, not a runtime
test** — every rule (`equals`, `contains`, `inRange`, `inDateRange`, `hasAny`, `hasNone`, `filter`,
`anyOf`) must produce exactly its criterion type through `StateOf`. A runtime test cannot observe
that; the criterion map exists only at compile time.

Its own step, and a `test` step, because `/implement` routes on `Task type` — folding a probe into a
`code` step means the testing conventions never load, and this file is the one place in the domain
where a wrong assertion passes silently.

The existing file is the right shape and the wrong subject: it probes `createFilters(rows, schema)`,
the carrier, and `applyWhen` — all deleted by Steps 1–3. Rewrite rather than patch.

## What To Do

1. Retarget the file. The subject is `withFiltering(config, schema)` composed into a real
   `createTable`, since `RowOf<In>` is now what supplies `TRow` — a probe against the builder alone
   would not exercise the inference path a consumer actually takes. Rename the file to match its new
   subject (`with-filtering.types.spec.ts` under `filters/`, or beside the feature — the implementer
   picks, and says which in the PR).
2. Keep the two scaffolding devices that still earn their place:
   - `typecheckOnly(assertions)` — typechecks a body that would throw at construction.
   - the shared `Invoice` / `Ticket` row interfaces, for the cross-row rejection case.
   Delete `rowsArray`, `ticketPath`-as-carrier-probe and every `rowOf()` case.
3. Assert, one `it` per claim:
   - Each of the eight rules infers its criterion exactly through `StateOf` — `equals` →
     `TRow[K] | null`, `contains` → `string`, `inRange` → `RangeCriterion`, `inDateRange` →
     `DateRangeCriterion`, `hasAny`/`hasNone` → `readonly TItem[]`, `filter` → its predicate's
     `TCriterion`, `anyOf` → its first child's criterion.
   - The schema object's **keys** become the state keys verbatim — no derivation, no widening to
     `string`.
   - `path` completes on the table's row keys only; a key not on `Invoice` is a compile error
     (`@ts-expect-error`).
   - `anyOf` still rejects a child built from a different row (`Ticket`) and a child with a
     mismatched criterion. These are the homogeneity checks Step 2 preserved — the probe is what
     proves they survived the key-parameter removal.
   - `table.filters` is `Filters<Invoice, StateOf<S>>`; the no-schema overload contributes no
     `filters` member at all.
4. In `create-filters.spec.ts`, fix only what the construction-time changes force: the schema guard
   now demands an object (message naming the object form), the duplicate-key throw is gone, the
   duplicate-path throw stays. Leave the evaluation, degradation and state tests alone — their
   subject did not change.

## Implementation Notes

- **`nx run shared-table:typecheck-spec` is what enforces this file.** The vitest runner executes
  `expectTypeOf` and `@ts-expect-error` without typechecking either, so a green test run proves
  nothing here. The existing file says so in its header comment; carry that comment over.
- A `@ts-expect-error` that stops being an error is itself an error, which is the property making
  the rejection cases real. Do not soften one to a comment.
- Per `unit-test`: no runtime assertion belongs in this file. If a claim can be observed at runtime,
  it belongs in `create-filters.spec.ts` instead.

## Risks / Watchouts

- **`anyOf`'s criterion borrow is the easiest thing to break silently.** It borrows criterion *and*
  row type from the first child; a regression makes the group's criterion `unknown`, which
  `expectTypeOf` will accept against a loose assertion. Assert the exact type, never
  `toMatchTypeOf`.
- A probe written against the builder rather than through `createTable` will pass while the
  consumer-facing inference is broken — `RowOf<In>` is the link under test.

## Non-Goals

- Migrating the story-host specs or fixtures — `#91`.
- Runtime coverage of `when` gating. Step 1's acceptance covers it; if a runtime test is wanted it
  goes in `create-filters.spec.ts`, not here.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck-spec` clean. Run twice — a `.ts` error aborts `ngc` before the
      template phase.
- [ ] `nx run shared-table:typecheck` reports no error originating in `src/filters/**` or
      `src/api/features/with-filtering.ts`. Errors under `src/stories/**` remain expected (`#91`).
- [ ] Every one of the eight rules has an exact-criterion assertion.
- [ ] No `createFilters`, `rowOf` or `applyWhen` referenced in any spec under `src/filters/`.
- [ ] The cross-row and mismatched-criterion `anyOf` rejections are `@ts-expect-error` cases that
      genuinely error.

---
← [Step 5: Barrels](step-5-barrels.plan.md) | [Step 7: Client-filtering host](step-7-client-filtering-host.plan.md) →
