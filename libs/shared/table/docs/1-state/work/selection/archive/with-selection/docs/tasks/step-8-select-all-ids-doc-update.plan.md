---
title: "Step 8 — selection.md: selectAllIds() shipped"
type: task-step
issue: 64
---

# Step 8 — `selection.md`: `selectAllIds()` shipped

**PR scope:** Parallel-safe with Step 6 and Step 7 (documents an already-settled decision, D59 —
doesn't read `selection.utils.ts` or its spec).

**Task type:** docs

**Skills used:** none — handled directly, no agent

**Scaffolding agent:** none — main thread

## Files

- `libs/shared/table/docs/1-state/features/selection.md` (edit)

## Why This Step Exists

`selection.md`'s `## selectAllIds() helper` section currently ends "Not yet coded" (D59's
proposed-but-unbuilt state). This step brings the doc back in sync with shipped code, the same
way `filtering.md` was synced after #62.

## What To Do

1. In the `## selectAllIds() helper` section's closing paragraph, replace:
   > Implementable today against the shipped `TableStore` surface — not blocked on
   > `createFilters()`. Not yet coded; see D59 for the proposed file placement and what it
   > deliberately does not solve (page-scoped select-all; the read-side "are all visible rows
   > selected" signal, routed to
   > [`work/computed-state-mechanism/1-intake.md`](../../../../../core/archive/computed-state-mechanism/1-intake.md)).

   with wording stating it ships at `api/features/selection.utils.ts` (Step 6), citing D59, and
   keeping the "what it deliberately does not solve" pointer (page-scoped select-all; the
   read-side signal routed to `computed-state-mechanism`) — that scope boundary doesn't change
   just because the code landed.
2. Leave frontmatter (`spec: drilled`, `code: partial`) untouched — other rows in `## Not
   Shipped` (persistence, group-header select-all, etc.) still make `partial` correct for the
   capability as a whole. Don't flip it to `shipped`.
3. Leave `## Not Shipped` and `## Open Questions` untouched — `selectAllIds()` was never listed
   as its own row in either.

## Implementation Notes

- Match the existing prose style/citation format exactly (bold lead-ins where the doc already
  uses them, decision-letter citations, relative links).
- Don't re-derive `docs/status.md` — it's generated (`npm run table:status`), never hand-edited;
  this step doesn't touch frontmatter so there's nothing to regenerate from.

## Risks / Watchouts

- Don't silently mark `code: shipped` — that's a claim about the whole `withSelection()`
  capability, not just this helper, and isn't this issue's call to make.
- Don't touch `3-spec.md` — the issue's acceptance criteria don't name it, unlike #63's Step 5;
  `selectAllIds()` was never sketched there (only in `selection.md`).

## Non-Goals

- Not updating `docs/status.md` (generated, not hand-edited).
- Not resolving any `## Open Questions` — none of them concern `selectAllIds()`.

## Acceptance Checks

- [ ] `## selectAllIds() helper`'s closing paragraph reflects shipped code, citing D59.
- [ ] "What it deliberately does not solve" (page-scoped select-all; the read-side signal)
  pointer is preserved.
- [ ] Frontmatter (`spec`, `code`) unchanged.
- [ ] `## Not Shipped` / `## Open Questions` unchanged.

---
← [Step 7: selectAllIds() unit tests](step-7-select-all-ids-tests.plan.md)
