# Step 5 — Barrels: drop the standalone surface, add `FiltersPath`

**PR scope:** PR 1 of 1 (`#90`). **Depends on: Step 4.** **Blocks Step 6.**
**Task type:** `code`
**Stack:** angular
**Skills used:** `file-organization`
**Scaffolding agent:** `angular-implementer`

## Files

| File                              | Line    | Action                                                           |
| --------------------------------- | ------- | ---------------------------------------------------------------- |
| `libs/table/src/filters/index.ts` | `:1-27` | rewrite — the domain's surface after the model moved             |
| `libs/table/src/index.ts`         | `:1-3`  | edit — the header comment's claim about the filters domain       |
| `libs/table/CLAUDE.md`            | —       | edit — the `filters/index.ts` row and the `filters/` layout line |

## Why This Step Exists

Last of the source steps because a barrel is a statement about a surface, and the surface is not
settled until Step 4 finishes auditing it. Writing it earlier means writing it twice.

`src/index.ts:89` re-exports `./filters` wholesale (the one-barrel-per-domain decision from `#72`),
so this step edits the domain barrel and the public surface follows. Only the header comment in
`src/index.ts` needs touching, and only because it describes what the delegation means.

## What To Do

1. `filters/index.ts` drops `createFilters`, `rowOf`, `RowToken` and `applyWhen`.
2. It adds `FiltersPath` to its type exports — a consumer needs it to annotate a hoisted schema
   arrow (`const invoiceFilters = (path: FiltersPath<Invoice>) => ({ ... })`), which is the whole
   reason no `filterSchema()` helper ships (R55).
3. It keeps: `Filters`, `FilterNode`, `FilterOptions`; the rules `anyOf`, `contains`, `equals`,
   `filter`, `hasAny`, `hasNone`, `inDateRange`, `inRange`; the matchers `hasAnyOf`, `hasNoneOf`,
   `isContaining`, `isEqual`, `isInDateRange`, `isInRange`.
4. It must **not** export the model builder, `evaluator.ts`, `state.ts` or `validate.ts`. The
   existing header comment already says those are internal precisely because they are unlisted —
   update it for the builder, which is newly in that category.
5. `RangeCriterion` / `DateRangeCriterion` from `rules.ts`: check whether they are currently
   reachable and keep that answer unchanged. A consumer typing an `inRange` criterion needs them;
   if they were exported before, they stay exported.
6. Update `libs/table/CLAUDE.md`. Two places state the old surface as fact and become
   false here: the `filters/index.ts` row in the file table ("`createFilters` and `rowOf`, four
   types … the nine rules") and the `src/` layout block's "the standalone `createFilters()`
   domain". Both are invariants/conventions, not status — they belong in that file and must be
   corrected, not deleted.
7. Update `src/index.ts:1-3`. It describes the barrel's relationship to the filters domain; after
   this issue, filtering reaches a consumer through `withFiltering` (already exported at `:14`) and
   the domain barrel supplies rules and types only.

## Implementation Notes

- List every symbol explicitly. The existing comment warns against `export *` from
  `./create-filters`, `./rules` or `./matchers` — that warning is why this file stays maintainable,
  so keep it (retargeted at the builder's new filename).
- `AnyRule` and `StateOf` appear in `withFiltering`'s own public signature. Check whether they must
  be exported for that signature to be nameable by a consumer; if TS requires it, export them as
  types with a comment marking them signature-support, not a consumer API.

## Risks / Watchouts

- **This is the step that breaks the repo.** Every story host and fixture importing `createFilters`
  fails from here. That is the issue's stated contract — it "does not stay green on its own" — so
  the acceptance check is a _scoped_ typecheck, not a repo-wide one. Do not patch call sites to get
  green; that work is `#91`.

## Non-Goals

- Migrating call sites.
- Moving files between `api/` and `engine/` — spec step 10, later issue.

## Acceptance Checks

- [ ] No `createFilters`, `rowOf`, `RowToken` or `applyWhen` reachable from `src/index.ts`.
- [ ] `FiltersPath` is exported, and a hoisted schema const annotated `(path: FiltersPath<Invoice>)`
      compiles against a table built on `Invoice`.
- [ ] The model builder, `evaluator.ts`, `state.ts` and `validate.ts` are not reachable from either
      barrel.
- [ ] `nx run shared-table:typecheck` reports no error originating in `src/filters/*.ts`,
      `src/api/features/with-filtering.ts` or either barrel. Errors under `src/stories/**` are
      expected here and belong to `#91`. Run twice.

---

← [Step 4: Member audit](step-4-member-audit.plan.md) | [Step 6: Inference probe](step-6-inference-probe.plan.md) →
