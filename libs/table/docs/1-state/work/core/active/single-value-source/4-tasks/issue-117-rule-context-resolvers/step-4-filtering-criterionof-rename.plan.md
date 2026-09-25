# Step 4 — Filtering: rename `valueOf` → `criterionOf`

**PR scope:** standalone, independent of Steps 1–3. **Depends on:**
none. **Parallel-safe with:** Steps 1, 2, 3, 5.

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/engine/filters/types.ts` (edit —
  `FilterValueOfContext`)
- `libs/table/src/engine/filters/evaluator.ts` (edit —
  `buildValueOfContext`)
- `libs/table/src/api/features/with-filtering/types.ts` (edit — doc
  comments only)
- `libs/table/src/api/features/with-filtering/feature.spec.ts`,
  `feature.types.spec.ts` (edit — every `ctx.valueOf(` call site in a
  `FilterOptions.when`)

## Why This Step Exists

ADR-0027 Rule 3: filtering's existing `FilterValueOfContext.valueOf`
answers "what did the user ask for?" (a criterion) — the *bound*
register — which collides in name with the new *unbound*
`valueOf(path, row)` (Step 1) that answers "what does the data say?" The
issue's own acceptance criterion requires the old name **gone, not
deprecated**.

## What To Do

1. **`engine/filters/types.ts`.** Rename the `FilterValueOfContext`
   interface member: `valueOf<K extends string = string>(path:
   FilterHandle<unknown, K, unknown>): unknown` →
   `criterionOf<K extends string = string>(path: FilterHandle<unknown,
   K, unknown>): unknown`. Update the interface's own doc comment
   (currently: "Context `FilterOptions.when` reads other filters'
   current criterion values through, not row data") to name
   `criterionOf` explicitly.

2. **`engine/filters/evaluator.ts`.** Rename the exported function
   `buildValueOfContext` → `buildCriterionOfContext` (it builds a
   `FilterValueOfContext`, and the member it implements is now
   `criterionOf`) and its object literal's method key `valueOf(handle)
   {...}` → `criterionOf(handle) {...}`. Update the one call site in
   `narrowingRecords()` (`buildValueOfContext<TRow>(internal)` →
   `buildCriterionOfContext<TRow>(internal)`).

3. **`with-filtering/types.ts`.** `FilterOptions.when`'s doc comment and
   any prose referencing `ctx.valueOf` inside this file's header
   comment — update to `ctx.criterionOf`.

4. **Specs.** Grep `libs/table/src` for `\.valueOf\(` inside any
   `FilterOptions.when` usage (`with-filtering/feature.spec.ts`,
   `feature.types.spec.ts`, and any story/fixture under
   `libs/table/src/stories/filtering/**` or
   `libs/table/src/stories/**` using a filter `when`) and rename to
   `.criterionOf(`. Use:
   `rg -n "\.valueOf\(" libs/table/src --glob '*.ts' --glob '*.html'` to
   find every call site, then narrow to ones inside a `when:` filter
   option (don't touch Step 1's new unbound `valueOf` once Step 1
   lands — if this step runs in parallel before Step 1 merges, there
   will be no `valueOf` calls from Step 1 yet, so every hit found by
   this grep at this point in time belongs to filtering).

## Implementation Notes

- This is a pure rename — no behavior change. Every existing filtering
  test's assertions stay the same; only the method name at the call
  site changes.

## Risks / Watchouts

- If this step's implementer runs after Steps 1–3 have already landed
  `valueOf` elsewhere, the grep in step 4 above will also match those —
  filter matches to only `FilterOptions.when` / `FilterValueOfContext`
  call sites, not grouping's or sorting's new `ctx.valueOf`.

## Non-Goals

- No change to `FilterRuleRecord`, matchers, or any filtering
  behavior — naming only.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` clean and
      `nx run shared-table:typecheck-spec` clean.
- [ ] `rg -n "FilterValueOfContext" libs/table/src` shows no remaining
      `valueOf` member — only `criterionOf`.
- [ ] Every existing filtering spec passes unchanged in behavior.

---
← [Step 3: Sorting `sortFn` reads `ctx.valueOf`](step-3-sorting-sortfn.plan.md) | [Step 5: Column rules `stateOf`](step-5-columns-stateof.plan.md) →
