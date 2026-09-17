# Step 9 — Relocate the filters domain to its own top-level folder

**PR scope:** PR 2 of 3 (`#106`). **Depends on: Step 7.** **Blocks Step 10.**
**Task type:** `code`
**Stack:** angular
**Skills used:** `file-organization`
**Scaffolding agent:** `angular-implementer`

## Files

Moves — `src/filters/` becomes a sibling of `api/`, `engine/` and `directives/`. Per
[ADR-0004](../../../../../../../adr/0004-table-source-layout.md) the folder supplies the domain, so the
`filters.` prefix comes off inside it.

| From | To |
|---|---|
| `src/api/create-filters.ts` | `src/filters/create-filters.ts` |
| `src/api/create-filters.spec.ts` | `src/filters/create-filters.spec.ts` |
| `src/api/filters.types.ts` | `src/filters/types.ts` |
| `src/api/filters/evaluator.ts` | `src/filters/evaluator.ts` |
| `src/api/filters/matchers.ts` | `src/filters/matchers.ts` |
| `src/api/filters/matchers.spec.ts` | `src/filters/matchers.spec.ts` |
| `src/api/filters/recorder.ts` | `src/filters/recorder.ts` |
| `src/api/filters/rules.ts` | `src/filters/rules.ts` |
| `src/api/filters/state.ts` | `src/filters/state.ts` |
| `src/api/filters/state.spec.ts` | `src/filters/state.spec.ts` |
| `src/api/filters/validate.ts` | `src/filters/validate.ts` |

Import updates — every file outside the domain that names a moved path:

| File |
|---|
| `src/index.ts` (`:87`, `:88`, `:89-99`, `:100-107`) |
| `src/api/features/with-filtering.spec.ts` (`:4`, `:6`, `:10`) |
| `src/stories/composition/derived-state/derived-state-story-host.component.ts` (`:3`, `:7`) |
| `src/stories/filtering/client-filtering/client-filtering-story-host.component.ts` (`:3`, `:11`) |
| `src/stories/filtering/selection-filtering/selection-filtering-story-host.component.ts` (`:3`, `:4`) |
| `src/stories/filtering/server-filtering/server-filtering-story-host.component.ts` (`:3`, `:4`) |
| `src/stories/filtering/fixtures/utils.ts` (`:1`) |
| `src/stories/grouping/fixtures/schema.ts` (`:1`, `:2`, `:3`) |

## Why This Step Exists

Step 7 made the two domains independent in code. The layout still says otherwise: the filters
domain sits inside `api/`, which reads as "part of the table's public surface" and is now simply
false. Moving it out makes the boundary visible in the directory listing, before anyone tries to
enforce it with a lint rule.

Sequenced last among the code changes, deliberately. It touches every file in the domain and would
conflict with every other step's diff if done earlier. Nothing about it changes behavior.

## What To Do

1. `git mv` each file per the table above, so history follows. Specs move with their sources.
2. Rewrite the **intra-domain** relative imports. Files now sit one level shallower and in one flat
   folder, so `'../filters.types'` becomes `'./types'`, `'./filters/evaluator'` becomes
   `'./evaluator'`, and `'../../engine/types'` becomes `'../engine/types'`. Work through each moved
   file; do not rely on a single find-and-replace.
3. Rewrite the **external** import paths in the eight files listed above. In `index.ts` this is a
   path-only edit for now — the same symbols, in the same three blocks. Step 10 collapses those
   blocks into one wholesale re-export.
4. Delete the now-empty `src/api/filters/` directory.

## Implementation Notes

- `git mv` rather than delete-and-create, in its own commit, so the move and any subsequent edit
  are separable in review. Rename detection is what keeps this diff readable.
- Only `filters.types.ts` → `types.ts` loses a prefix. `create-filters.ts` keeps its name — the
  prefix invariant strips the *domain* from the filename, and `create-` is the factory verb, not
  the domain.
- `src/api/types.ts` already exists and is a different file. After the move, `src/filters/types.ts`
  and `src/api/types.ts` are siblings-by-concern in different domains — that is the intended shape,
  not a collision, but it is exactly the pair a careless relative import will confuse.
- The three story fixture files import rules and matchers directly rather than through `index.ts`.
  Update them to the new paths; do not opportunistically reroute them through the barrel in this
  step.
- Check `libs/shared/table/project.json` and any `tsconfig*.json` for path globs naming
  `api/filters` before assuming the move is invisible to the build.

## Risks / Watchouts

- **This step conflicts with anything else in flight inside the domain.** Land it alone; rebase
  rather than merge if something else touched `api/filters/` first.
- A missed relative import inside a moved file surfaces as a `tsc` error, which is the cheap
  failure. A missed import that happens to still resolve — `../types` reaching `api/types.ts`
  instead of `filters/types.ts` — compiles and is wrong. Grep the moved files for `'../types'`
  after the rewrite and confirm every hit is intentional.
- Documentation still cites the old paths at this point. That is expected and Step 11–13 own it;
  do not fix docs here.

## Non-Goals

- Adding `src/filters/index.ts` or changing what the public barrel exports — Step 10.
- Extracting the domain to a separate npm package. This step makes that a move rather than a
  rewrite; do it when there is a second consumer, not before.
- Any behavior change, any rename beyond the `filters.` prefix, any file split.

## Acceptance Checks

- [ ] `src/filters/` is a sibling of `api/`, `engine/` and `directives/`, holding all 11 files
- [ ] `src/api/filters/` no longer exists and `src/api/` holds no filters file
- [ ] Filenames inside the domain carry no `filters.` prefix
- [ ] Specs sit beside their sources
- [ ] `git log --follow` resolves for at least one moved file — the move was recorded as a rename
- [ ] Every previously exported filters symbol is still exported from `index.ts`, under the same name
- [ ] `npx tsc -p libs/shared/table/tsconfig.lib.json --noEmit` and `…/tsconfig.spec.json --noEmit` are clean
- [ ] `npx nx test shared-table` passes with no spec file edited beyond its import lines

---
← [Step 8: ADR-0016](step-8-adr-0016.plan.md) | [Step 10: Give the filters domain its own barrel](step-10-filters-barrel.plan.md) →
