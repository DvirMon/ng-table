---
title: "Step 5 — docs: rowsOf on the grouping contract"
type: task-step
issue: 65
---

# Step 5 — docs: `rowsOf` on the grouping contract

**PR scope:** Markdown only. **Parallel-safe with Step 4.**

**Task type:** docs

**Depends on:** Step 3

**Scaffolding agent:** none (main thread)

## Files

- `libs/shared/table/docs/1-state/work/with-grouping/3-spec.md` (edit)
- `libs/shared/table/docs/1-state/features/grouping.md` (edit)
- `libs/shared/table/docs/0-product/grouping.md` (edit)

## Why This Step Exists

`rowsOf` came from the product pass (D16), after `3-spec.md` was written — it appears in the
decisions doc and the product doc's prose, but in no contract surface. Shipping it without that
leaves the spec describing a smaller API than the code.

## What To Do

### 1. `3-spec.md`

- **Public surface:** add to the `GroupingMembers<TRow>` block:
  ```ts
  readonly rowsOf: (group: RenderRow<TRow>) => readonly TRow[];   // D16, D16.1
  ```
- **Decisions:** one bullet for D16 — group header is a view over rows, library ships no cascade,
  rows-not-ids, leaves-not-children, resolved by id, reads `renderRows()`. Link D16/D16.1 rather
  than restating the rejected alternatives.
- **Testing Decisions → Coverage:** add the `rowsOf` lines (depth, stale header, post-filter,
  missing group returns `[]`, cascade recipe never puts a `group:` id in `selectedRows`).

### 2. `features/grouping.md`

Its superseded banner lists what shipped per issue. Add `rowsOf` (#65) to the shipped list and
name the group row count as `rowsOf(group).length`, superseding any "count has nowhere to live"
framing. Leave `spec:`/`code:` frontmatter as-is unless the whole feature's maturity changed —
and never hand-edit `docs/status.md`; it is generated (`npm run table:status`, left for the user
to run).

### 3. `0-product/grouping.md`

- S12 row: `rowsOf()` **shape** shipped; only the call-site form (ADR-0015) stays open — flat
  `table.rowsOf(g)` as shipped.
- Update the §X-G1 / OQ-1 prose from "we expose" to shipped, keeping the consumer cascade snippet
  accurate against the real member name.

## Implementation Notes

- No decision narration in source JSDoc — rationale stays in these docs, the code comments stay at
  "what it does + the constraint" (already written that way in Steps 2–3).
- Don't restate D16's rejected alternatives in three places; the decisions doc owns them, the spec
  links.

## Risks / Watchouts

- **Don't mark ADR-0015 decided.** It is still `proposed`; this work ships flat and is explicitly
  not the decision.
- `features/grouping.md` still carries pre-D3 single-level prose under its banner. Adding `rowsOf`
  is not the trigger to rewrite that file — that is the spec's own "Documentation updates this
  work owes" item, not this issue's.

## Non-Goals

- No `docs/status.md` regeneration in this PR (the user runs `npm run table:status`).
- No ADR-0015 resolution.
- No directive-layer doc for group-checkbox wiring (UI stream, separate work).

## Acceptance Checks

- [ ] `3-spec.md` Public surface, Decisions and Coverage all mention `rowsOf`.
- [ ] `features/grouping.md` banner lists `rowsOf` as shipped under #65.
- [ ] `0-product/grouping.md` S12 reflects "shape shipped, call-site form open".
- [ ] No markdown link in the edited files points at a missing anchor or file.

---
← [Step 4: Tests](step-4-tests.plan.md)
