# Step 8 — ADR-0016: the filter model is the consumer's, the table takes a predicate list

**PR scope:** PR 1 of 3 (`#71`). **Depends on: Step 7.**
**Task type:** `docs`
**Stack:** angular
**Skills used:** —
**Scaffolding agent:** none (main thread)

## Files

| File                                                                  | Action |
| --------------------------------------------------------------------- | ------ |
| `libs/shared/table/docs/adr/0016-filtering-takes-a-predicate-list.md` | create |

`0016` is the next free number — `0001`–`0008` and `0010`–`0015` exist, `0009` is absent and stays
absent.

## Why This Step Exists

The ADR lands with the contract rather than with the documentation in PR 3, because this is the PR
where the contract becomes real. One of its four points is a **public type-behavior change**, not a
refactor, and a change of that class must be recorded in the commit that makes it, not two PRs
later.

## What To Do

Follow the shape of the sibling ADRs in `docs/adr/` — `0014-runtime-error-policy.md` is the closest
in kind (a cross-cutting policy with rejected alternatives). Cover exactly these four points:

1. **The filter model is the consumer's; the table takes a predicate list.** `withFiltering` accepts
   `predicates: () => readonly ((row: TRow) => boolean)[]` and imports nothing from the filters
   domain. Wiring the two is ordinary composition the consumer writes:
   `withFiltering({ predicates: () => [this.filters().matcher()] })`. Rejected: keeping
   `filters` as a second accepted input "for convenience" — it re-establishes the import and the
   type parameter, which is the whole cost being removed.
2. **One term is the error-isolation unit.** Per row is rejected: it yields a half-filtered set —
   some rows tested, some skipped — and puts a `try` in the hot loop. Per pass is rejected: one
   throwing term returns every row unfiltered, which is the silent, unrecoverable direction. A
   throwing term is dropped for that pass and reported once, by its index. Consistent with
   ADR-0014; the index-based report is the floor for **anonymous**
   terms — a term produced by `matcher()` already reports under its own filter key from inside the
   evaluator.
3. **AND is the only combinator the table may assume.** Each term narrows further. OR lives inside
   a term — `anyOf` in the filter model, or a hand-written predicate — because the table has no
   vocabulary for expressing which terms group with which.
4. **The row-type rejection is a public type-behavior change.** `TRow` was phantom on `Filters`:
   `Filters<OtherRow>` and `Filters<Row>` were the same type once `TState` matched, so a filter set
   built for an unrelated row type compiled and then read fields that did not exist — silently, with
   an empty or unfiltered table and no error at any level. `matcher(): (row: TRow) => boolean` puts
   `TRow` in the type body, so the mismatch is now a compile error. Structural compatibility is
   preserved: an identically shaped row type, or a wider one carrying extra fields, still works.
   Only genuinely unrelated row types are rejected. Note the consequence for the separately-specced
   inferred-criterion-map work: its planned `TRow` branding member is dropped as dead work, since
   `matcher()` consumes `TRow` already.

## Implementation Notes

- Link the spec and the decision record rather than restating them:
  `../1-state/work/decouple-filters/spec.md` and
  `../1-state/work/with-filtering/migration-decouple-filters-from-table.md` (both relative to
  `docs/adr/`, where the new file lives).
- Reference the epic and this issue: `#67`, `#71`.
- Match the frontmatter of the neighbouring ADRs exactly — read `0015` and copy its key set.
- Per the repo's own convention, decision rationale belongs here and **not** in source JSDoc. Do not
  add a D-number or an ADR paragraph to `with-filtering.ts` while writing this.

## Risks / Watchouts

- Do not describe the folder move (`#72`) or the doc split (`#73`) as done — neither has landed
  when this ADR is written. Reference the layout only as a consequence recorded elsewhere, or omit
  it.
- Point 4 is the one a reader will arrive at from a compile error in their own code. Write its
  "what to do about it" plainly: annotate the filter set with the row type the table actually holds.

## Non-Goals

- Rewriting `docs/1-state/features/filtering.md` or `docs/1-state/filters.md` — Steps 11 and 12.
- Regenerating `docs/status.md` — Step 13 owns the roll-up, after the doc frontmatter is correct.
- Re-deciding any of the four points. All four are settled in the spec and the architecture doc.

## Acceptance Checks

- [ ] `docs/adr/0016-filtering-takes-a-predicate-list.md` exists
- [ ] All four points are covered, each with the alternative it rejects where one was considered
- [ ] The row-type flip is stated as a public type-behavior change, with the structural-compatibility carve-out
- [ ] Frontmatter matches the sibling ADRs
- [ ] No source file is edited by this step

---

← [Step 7: Delete the coupled filtering surface](step-7-delete-coupled-surface.plan.md) | [Step 9: Relocate the filters domain](step-9-relocate-filters-domain.plan.md) →
