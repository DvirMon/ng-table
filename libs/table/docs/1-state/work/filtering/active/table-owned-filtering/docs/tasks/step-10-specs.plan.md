# Step 10 — Migrate `state.spec.ts`, rewrite `with-filtering.spec.ts`

**PR scope:** PR 1 of 1 (`#91`). **Parallel-safe with: Step 7, Step 8, Step 9.**
**Task type:** `test`
**Stack:** angular
**Skills used:** `unit-test`
**Scaffolding agent:** `test-implementer`

## Files

| File                                                 | Line     | Action                                        |
| ---------------------------------------------------- | -------- | --------------------------------------------- |
| `libs/table/src/filters/state.spec.ts`               | `:1-30`  | edit — construction preamble only             |
| `libs/table/src/api/features/with-filtering.spec.ts` | `:1-302` | rewrite — 10 of 18 cases assert a deleted API |

## Why This Step Exists

These two files are the only specs still importing `createFilters` and `rowOf`, so **the suite is
red on import**, not on assertion — vitest transpiles without typechecking, so the failure is a
runtime `undefined is not a function` in two files and says nothing useful about what broke. This
step is what returns the suite to green, and it is independent of every story step: it imports
nothing from `src/stories/`.

Issue `#91`'s spec list is stale on three counts, verified against the tree:

- `create-filters.types.spec.ts` no longer exists — `#90` Step 6 rewrote it as
  `api/features/with-filtering.types.spec.ts` (304 LOC). Nothing to do.
- `create-filters.spec.ts` is **already migrated** (773 LOC, `buildFilterModel` + object schema).
  Nothing to do.
- The "delete the assertions for `applyWhen`, `as`, `rowOf` and the duplicate-key throw" work is
  already done in those two files. What remains is only what is listed above.

The two remaining files are very different jobs and are in one step only because they are one
concern — they must not be described as one edit.

## What To Do

### A. `state.spec.ts` — a preamble swap, nothing more

`:22-25` is the whole of it:

```ts
function build<S extends Record<string, AnyRule>>(schema: (path: FiltersPath<Invoice>) => S) {
  return buildFilterModel<Invoice, S>(schema);
}
```

Copy the shape from `create-filters.spec.ts:44-50`, including its note that `buildFilterModel` needs
no injection context — `state.ts` builds only `signal`/`computed`/`linkedSignal`.

- Every array-literal schema in the file becomes an object literal, keyed by whatever `as:` or the
  derived key used to produce. Twenty-seven cases; the assertions themselves do not change.
- **Keep `TestBed` where a `form()` is involved** — the four `describe` blocks from `:179` onward
  bind Signal Forms and do need a context. Only the bare-model helper loses it.
- **Keep the `dirty()` case (`:128`).** `@internal` means "not part of the consumer contract", not
  "deleted" — it is still on `FiltersRoot` (`filters/types.ts:64`) and source reconciliation is
  precisely what this file owns. If it is dropped here it is untested anywhere.

### B. `with-filtering.spec.ts` — a rewrite

Ten of eighteen cases assert `predicates`, which no longer exists. They are not deletable as a
group: most assert a _behaviour_ that survives and only its _input_ changed. Rewrite case by case:

| Current (`:line`)                                                 | Becomes                                                                                                                                              |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `narrows rows() with a plain predicate` `:60`                     | narrows `rows()` from a schema criterion                                                                                                             |
| `combines separate predicate terms with AND` `:72`                | two criteria narrow conjunctively                                                                                                                    |
| `never narrows while the term list is empty` `:89`                | never narrows while every criterion is empty                                                                                                         |
| `recomputes when a signal read inside the thunk changes` `:114`   | re-narrows when a criterion — and separately, a rule's `source` — changes                                                                            |
| `calls the thunk once per pass, not once per row` `:136`          | **one `matcher()` per stage evaluation, not per row** (`with-filtering.ts:64-66` states this; a counting rule predicate proves it)                   |
| `manual mode skips without calling the thunk` `:175`              | `manual: true` skips the stage although the model still builds and `filters` is still exposed                                                        |
| `drops a throwing term for the pass` `:192`                       | ADR-0014 at feature level: a throwing rule predicate stops narrowing for that evaluation, siblings unaffected                                        |
| `drops a term throwing on a later row from the whole pass` `:221` | same, from a row past the first — the per-_evaluation_, not per-_row_, boundary                                                                      |
| `composes with a filter model through matcher()` `:251`           | **delete** — that composition is the feature now, so this asserts nothing                                                                            |
| `withFiltering({ predicates }) alone contributes {}` `:273`       | `withFiltering()` and `withFiltering({ manual: true })` with no schema contribute `{}` — `TableStore<Row>` recovered exactly, never widened to `any` |

Cases at `:48`, `:101`, `:150`, `:286` survive with only their construction rewritten.

**Then add the member cases the issue asks for.** Eight members, asserted _through a composed
store_, since that is the only place `RowOf<In>` supplies `TRow`:

- Root: `filters().value` is writable and fans out; `filters().criteria()` omits empties;
  `filters().isActive()`; `filters().reset()` vs `reset(null)`.
- Per key: `filters.status().value`; `filters.status().criterion()` is `undefined` when empty;
  `filters.status().isActive()`; `filters.status().reset()`.

Assert what `create-filters.spec.ts` cannot: that the member reaches the store under its declared
name and narrows the pipeline. Do **not** restate criterion semantics here — that file owns them.

## Implementation Notes

- Compile-time inference belongs to `with-filtering.types.spec.ts`, which already covers all eight
  rules through `StateOf`. Anything in this step that would be a second `expectTypeOf` over the same
  claim goes there instead, or nowhere.
- `contributes no members beyond the core store surface` (`:101`) asserts `'predicates' in store`
  is false (`:110`). Replace with `'filters' in store` being false for the no-schema overload — the
  claim is the same and the symbol still exists.
- Feature-level degradation and rule-level degradation are different scopes. `evaluator.ts` dedupes
  reports per record per evaluation; this file asserts the stage keeps producing rows, not the
  console message's text.

## Risks / Watchouts

- **Rewriting a test to match the implementation.** The predicate cases encode real claims — AND
  composition, once-per-pass, per-evaluation error scope. Re-derive each from the claim, not from
  reading `with-filtering.ts` and asserting what it does. A case that cannot be restated without the
  implementation in hand is a case that should be deleted, and said so in the PR.
- `state.spec.ts`'s twenty-seven schema literals are mechanical, which is exactly when a key gets
  quietly renamed. The old key came from `as:` or from the path; check each against the assertion
  below it.
- The suite cannot be run to completion while Steps 7–9 are outstanding if any story file is
  transitively imported by a spec. Neither of these two files imports from `src/stories/` — confirm
  that holds before concluding a failure belongs to another step.

## Non-Goals

- `create-filters.spec.ts`, `matchers.spec.ts`, `with-filtering.types.spec.ts` — already correct.
- Adding runtime coverage for `when`. `#90` Step 1's acceptance covers it in
  `create-filters.spec.ts`.
- Story-host specs. There are none.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck-spec` clean. Run twice — a `.ts` error aborts `ngc` before the
      template phase.
- [ ] `npx vitest run libs/table/src/filters/state.spec.ts libs/table/src/api/features/with-filtering.spec.ts`
      green.
- [ ] No `createFilters`, `rowOf`, `applyWhen` or `predicates` in any file under
      `libs/table/src/**/*.spec.ts`.
- [ ] All eight members have a case in `with-filtering.spec.ts`, asserted through a composed store.
- [ ] The once-per-evaluation case fails if `with-filtering.ts` is changed to call `matcher()`
      inside the `rows.filter` callback — if it does not, it is not testing the claim.
- [ ] `state.spec.ts` keeps its `dirty()` and its four Signal-Form `describe` blocks.

---

← [Step 9: Remaining call sites](step-9-remaining-call-sites.plan.md) | [Step 11: MDX prose and the green gate](step-11-mdx-and-green-gate.plan.md) →
