# Step 9 — Restore green

**PR scope:** PR 2 of 2 (`#111`). **Depends on: Steps 1, 2, 3, 4, 5, 6, 7, 8.**
**Task type:** `chore`
**Stack:** angular
**Skills used:** —
**Scaffolding agent:** none (main thread)

## Files

| File | Action |
|---|---|
| — | verification only; any edit here is a residue fix belonging to whichever step left it |

## Why This Step Exists

`#110` and `#111` share a branch and the build is green **only at the end of this step**. Until now
no step could prove anything beyond its own files, for two reasons:

1. `ngc` **aborts at the first `.ts` error and never reaches the template phase.** Every step 1–8
   ran against a tree with known `.ts` errors elsewhere, so no run so far has checked a single
   `.html` file. `server-filtering-story-host.component.html` binds `searchForm` fields by name and
   Step 4 moved that form's schema — a template-only break there is invisible until now. This is
   not hypothetical: [#94](https://github.com/DvirMon/acme/issues/94) shipped exactly this class of
   bug from this exact directory.
2. `create-filters.spec.ts` failing to compile takes the **whole suite** down, not just its own
   file. Nothing before Step 6 could run a test.

## What To Do

1. **Run the typecheck to a source-clean pass, then run it again.**

   ```bash
   nx run shared-table:typecheck
   ```

   The first clean-looking run means only "no `.ts` errors". Run it a second time from a source-clean
   tree and confirm *that* run is clean — only the second run has seen the templates. If run 1
   reports `.ts` errors, fix them and start the count over.

2. **Run the library's tests.**

   ```bash
   nx test shared-table
   ```

3. **Confirm nothing survived.** No hand-written criterion map should remain anywhere in `src/`:

   ```bash
   rg 'FilterState' libs/shared/table/src
   ```

   Expected: zero hits. The five exported aliases (`ClientInvoiceFilterState`,
   `ServerInvoiceFilterState`, `SelectionInvoiceFilterState`, `CompositionFilterState`,
   `DealFilterState`) and the four spec-local ones (`InvoiceFilterState` ×2, `BrokenFilterState`,
   `TypedInvoiceFilterState`) are all deleted. `buildFilterState` in `src/filters/state.ts` is an
   unrelated internal function — it is not a criterion map and it stays.

4. **Confirm every call site took a carrier.**

   ```bash
   rg 'createFilters<' libs/shared/table/src
   ```

   Expected: zero hits. Every call infers both parameters.

5. **Open every filtering, grouping and composition story in Storybook and compare against `HEAD`.**
   Rendered output and controls must be identical. A story that behaves differently means the
   rewrite is wrong, not that the story needs updating.

6. Record any residue found — which step left it, and what the fix was — in this issue's
   `progress.md` deviations table.

## Implementation Notes

- The two `rowOf()` sites are the server filtering host (Step 4) and `createDealFilters()`
  (Step 5). Every other site passes real rows. Spot-check that split holds — it is
  [#111](https://github.com/DvirMon/acme/issues/111)'s second acceptance criterion and the reason
  `rowOf()` has a reader-facing home at all.
- The working tree carries unrelated uncommitted changes to the grouping tab strip
  (`grouping-static-story-host.component.{ts,html}`, `grouping-static.stories.ts`,
  `grouping-story.css`). A typecheck or story failure in those files is not this issue's.

## Risks / Watchouts

- **A green first typecheck run is the trap, not the goal.** It is exactly what a source error
  produces. Two consecutive clean runs, or one clean run from a tree that was already source-clean.
- Storybook is a manual check with no automated gate behind it. `#112` adds the type seam; nothing
  covers rendered output. Do not treat a green suite as proof the stories are unchanged.

## Non-Goals

- `create-filters.types.spec.ts` — `#112`.
- `docs/1-state/filters.md`, `libs/shared/table/CLAUDE.md`, the design record, and R44's wording in
  `design-options-hybrid-api.md` — `#113`.
- Fixing anything in the uncommitted grouping tab-strip work.

## Acceptance Checks

- [ ] Two consecutive `nx run shared-table:typecheck` runs, the second from a source-clean tree,
      both clean — so the template phase actually ran
- [ ] `nx test shared-table` passes in full
- [ ] `rg 'FilterState' libs/shared/table/src` returns nothing
- [ ] `rg 'createFilters<' libs/shared/table/src` returns nothing
- [ ] Exactly two `rowOf()` call sites in `src/`: the server filtering host and `createDealFilters()`
- [ ] Every filtering, grouping and composition story renders and behaves as it did at `HEAD`
- [ ] `src/api/features/with-filtering.ts` is unmodified across the whole issue

---
← [Step 8: `with-filtering.spec.ts`](step-8-with-filtering-spec.plan.md)
