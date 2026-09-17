# Step 11 — `filtering.mdx` prose and the green gate

**PR scope:** PR 1 of 1 (`#125`). **Depends on: Step 7, Step 8, Step 9.**
**Task type:** `docs`
**Stack:** angular
**Skills used:** — (main thread, no agent)
**Scaffolding agent:** none

## Files

| File | Line | Action |
|---|---|---|
| `libs/table/src/stories/filtering/filtering.mdx` | `:1-24`, `:38-49`, `:95-113`, `:159-194`, `:222+` | edit — rewrite two sections, delete one |
| — | — | verify — full typecheck ×2, full suite |

## Why This Step Exists

One file describes all three filtering stories, so it is the one place in this issue where four
parallel steps would collide. It is last for that reason, not because prose is an afterthought: the
MDX is what a reader meets before any code, and it currently opens by explaining a composition that
no longer exists.

It is also where the issue's acceptance is actually checked. Steps 7–10 each verify their own files
in isolation; nothing before this point has been able to run a clean whole-lib typecheck, because
the lib does not compile until every call site has landed.

## What To Do

1. **`## Client` (`:38-49`).** Replace the opening claim —
   *"`withFiltering({ predicates: () => [filters().matcher()] })` feeds a standalone
   `createFilters()` object into the pipeline's `filter` stage as one predicate term. The feature
   takes row predicates…"*. It becomes: the table owns the model; `withFiltering({ schema })` builds
   it at construction and its criteria narrow the `filter` stage. If the section carries a `<Source>`
   block, update the snippet to the shipped call — `withFiltering({ schema: clientInvoiceFilters })`,
   the hoisted `const` from Step 7, since that const is the story's R55 demonstration.

2. **`## Server` (`:95-113`).** Two claims to replace: *"No filtering feature is composed here"*
   (`:97`) and the `createFilters()`-feeds-the-request sentence (`:100`). It becomes:
   `withFiltering({ manual: true, schema })` — the model is built and exposed, the local stage is
   skipped, and `criteria()` drives the request through `resource({ params })`. Say why there is no
   construction cycle: `createTable` reads rows through a thunk inside a `computed()`, so the
   resource can read `table.filters().criteria()` and the table can read the resource's rows. That
   sentence is the refutation of R10 and the reason this whole epic exists — it should be in the
   docs a reader actually opens, not only in the spec.

3. **`## Predicates` (`:159-194`).** Delete the whole section, including its `<Canvas>` (`:169`),
   its `PredicateStories` import at the top of the file, and the six
   `filtering-predicates-source` radio inputs (`:174-194`). Step 9 deleted the story it documents.

4. **`## Shared across the three` (`:222+`).** Now shared across **two**. Re-read it end to end —
   a section written over three stories will have comparisons that no longer parse, not just a
   wrong number in the heading.

5. **Sweep the rest of `src/` for stale prose.** `mock.ts:3` describes row data *"passed to
   `createFilters()`"*. Grep for the four dead names across every comment and string under `src/`,
   including `.html` templates, and fix what Steps 7–9 left.

6. **Run the gate.** Both runs, both targets, plus the suite. This is the step that reports whether
   `#125` met its acceptance.

## Implementation Notes

- `docs/1-state/filters.md`, `docs/1-state/features/filtering.md`, `docs/0-product/filtering.md`,
  `docs/3-ui/stories.md`, `libs/table/CLAUDE.md` and ADR-0016 are **`#126`**. This step stops
  at the `src/` boundary — that is exactly where `#125`'s acceptance draws the line ("anywhere under
  `src/`").
- Step 9's PR note should already flag that `docs/0-product/filtering.md` and `docs/3-ui/stories.md`
  point at the deleted predicate story. Carry that forward into `#126` rather than fixing it here.
- Storybook MDX resolves its `of={}` references at build time against the story file. A leftover
  `PredicateStories` import fails the Storybook build, not the typecheck — grep, do not rely on the
  gate below to catch it.

## Risks / Watchouts

- **A green typecheck here is the first one in the issue.** If it is not clean, the error could
  belong to any of Steps 7–9. Attribute by path before assuming this step introduced it.
- **`ngc` aborts before the template phase on a `.ts` error.** A first run that reports only `.ts`
  errors has said nothing whatsoever about the six story-host templates this issue touches. Fix,
  then run again. A pass claimed off an aborted run is how `#94` shipped.
- Deleting a `<Canvas of={…}>` whose story export is already gone yields a Storybook-only failure
  that no static check reaches. Per the repo's standing rule, do not start Storybook to check —
  grep for `PredicateStories` and `Predicates` and state in the PR that a Storybook run is what
  remains to be verified by hand.

## Non-Goals

- Every doc under `libs/table/docs/` — `#126`.
- Relocating `src/filters/` — `#127`.
- Rewriting the MDX's structure. Two sections change their claims and one is deleted; the document's
  shape is not this issue's subject.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` **clean**, whole lib. Run twice; only the second, source-clean
      run says anything about templates.
- [ ] `nx run shared-table:typecheck-spec` **clean**. Run twice, same reason.
- [ ] Full spec suite green.
- [ ] `grep -rn "createFilters\|rowOf\|applyWhen\|RowToken\|predicates" libs/table/src/`
      returns nothing.
- [ ] No `<Canvas>`, import or heading in `filtering.mdx` refers to the predicate story.
- [ ] The server section states the resource wiring **and** why there is no construction cycle.
- [ ] Server story issues one request per criterion change with the debounce intact — re-verified
      here, since Step 8 verified it before the other call sites landed.

---
← [Step 10: Specs](step-10-specs.plan.md)
