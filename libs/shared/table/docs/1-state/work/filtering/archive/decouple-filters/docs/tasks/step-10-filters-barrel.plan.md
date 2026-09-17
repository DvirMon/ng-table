# Step 10 — Give the filters domain its own barrel; the public barrel delegates to it

**PR scope:** PR 2 of 3 (`#106`). **Depends on: Step 9.** **Blocks Step 11, Step 12.**
**Task type:** `code`
**Stack:** angular
**Skills used:** `file-organization`
**Scaffolding agent:** `angular-implementer`

## Files

| File | Line | Action |
|---|---|---|
| `libs/shared/table/src/filters/index.ts` | — | create — the domain's public surface |
| `libs/shared/table/src/index.ts` | `:1-3` | edit — the header's "only definition" claim |
| `libs/shared/table/src/index.ts` | `:87-104` | replace — three hand-listed blocks become one wholesale re-export |

## Why This Step Exists

Step 9 moved the domain. This step is the API-surface decision that move was for: the filters
domain defines its own public surface, and the library's barrel re-exports it wholesale.

The alternative — carving out an explicit filters block in the public barrel with a comment noting
it re-exports a sibling domain — was considered and rejected. Delegating to the domain's own barrel
makes the eventual package extraction a **move** rather than a rewrite, and it keeps the public
barrel from being the place where a second domain's surface is maintained by hand.

It also fixes a claim the public barrel currently makes about itself. `index.ts:1-3` says it is
"the only definition of the consumer surface — `api/`, `engine/` and `directives/` have no barrels
of their own". Once `filters/` has one, that is false.

## What To Do

1. Create `src/filters/index.ts` exporting exactly what `index.ts:87-104` exports today, no more:
   - `createFilters` (from `./create-filters`)
   - types `Filters`, `FilterNode`, `FilterOptions` (from `./types`)
   - the nine rules `anyOf`, `applyWhen`, `contains`, `equals`, `filter`, `hasAny`, `hasNone`,
     `inDateRange`, `inRange` (from `./rules`)
   - the six matchers `hasAnyOf`, `hasNoneOf`, `isContaining`, `isEqual`, `isInDateRange`,
     `isInRange` (from `./matchers`)
2. Replace `index.ts:87-104` with `export * from './filters';`.
3. Rewrite the header comment at `:1-3`. It should say that this file defines the table's own
   consumer surface and re-exports the filters domain's barrel wholesale, and that `api/`,
   `engine/` and `directives/` still have no barrels of their own — so anything under those three
   that is not listed here is internal.

## Implementation Notes

- **`export *` is the point.** Listing symbols individually in `src/filters/index.ts` and then
  star-exporting that file keeps one hand-maintained list, in the domain that owns it. Do not
  star-export `./create-filters`, `./rules` and `./matchers` from the domain barrel — that would
  silently widen the public surface to every internal helper those files export, including
  `createFilterEvaluatorFrom` and the recorder internals.
- `evaluator.ts`, `recorder.ts`, `state.ts` and `validate.ts` are **not** in the domain barrel.
  After this step, "not listed in `src/filters/index.ts`" is the enforceable statement that they
  are internal.
- Position in `index.ts` is cosmetic and was left open in the architecture doc. Put the
  `export * from './filters'` line where the block it replaces sits (after the schema exports), so
  the diff stays readable.
- Two barrels now exist, but there is still exactly one definition per domain — the invariant is
  one barrel per domain, not one per repo.

## Risks / Watchouts

- **A symbol dropped here disappears from the library's public API silently** — `export *` will not
  warn. Diff the pre-change `index.ts:87-104` against the new `src/filters/index.ts` symbol by
  symbol; there are 19 of them.
- Check for a name collision between the filters barrel and the rest of `index.ts` before
  star-exporting: `filter` (the general rule) is a common enough identifier that a future clash is
  plausible even if there is none today. A collision under `export *` is a compile error, so `tsc`
  will catch it — but the fix is to rename in the domain, not to fall back to hand-listing.
- `src/stories/**` fixtures import rules and matchers by deep path, not through the barrel. They
  keep working and are out of scope; do not reroute them here.

## Non-Goals

- Widening or narrowing the public surface. Same 19 symbols in, same 19 out.
- Adding barrels to `api/`, `engine/` or `directives/`.
- Extracting the domain to a package.
- Any documentation edit — PR 3 owns every document, including the public-API table in
  `docs/1-state/filters.md` that this step makes stale.

## Acceptance Checks

- [ ] `src/filters/index.ts` exists and lists its symbols explicitly
- [ ] `src/index.ts` re-exports it with `export * from './filters'` rather than listing symbols
- [ ] All 19 previously exported filters symbols are still exported under the same names
- [ ] `evaluator`, `recorder`, `state` and `validate` export nothing through either barrel
- [ ] The public barrel's header no longer claims to be the only definition of the consumer surface
- [ ] `npx tsc -p libs/shared/table/tsconfig.lib.json --noEmit` is clean
- [ ] `npx nx test shared-table` passes
- [ ] A consumer app still compiles against the library unchanged — `npx tsc -p apps/demo/tsconfig.app.json --noEmit`

---
← [Step 9: Relocate the filters domain](step-9-relocate-filters-domain.plan.md) | [Step 11: Rewrite the feature's spec for the predicate list](step-11-feature-spec-predicate-list.plan.md) →
