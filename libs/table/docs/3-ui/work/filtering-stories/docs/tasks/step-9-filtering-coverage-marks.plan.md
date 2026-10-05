---
title: 'Step 9 — re-derive 0-product/filtering.md coverage marks'
type: task-step
plan: ../../1-gap-analysis.md
node: F
---

# Step 9 — re-derive `0-product/filtering.md` coverage marks

**PR scope:** Docs only.

**Task type:** docs

**Skills used:** audit-docs

**Depends on:** Step 4, Step 5, Step 6
**Parallel-safe with:** Step 10

**Scaffolding agent:** — (main thread)

## Files

- `libs/table/docs/0-product/filtering.md` (edit)
- `libs/table/docs/3-ui/work/filtering-stories/1-gap-analysis.md` (edit — status line)

## Why This Step Exists

Node F. The ✅/🟡 marks cannot be re-derived until the three stories exist. The product doc also
carries three stale claims to fix in the same pass.

## What To Do

1. Re-derive every story's mark **from the shipped stories**, not from this plan's predictions. ✅
   only where the story demonstrates the behavior _including its failure path_.
2. Fix §8.1's **S3 and S4** rows — both resolved: `create-filters.ts` plus `api/filters/` ship with
   spec coverage, and `with-filtering.ts` is the v2.0 adapter over it (`createFilterEvaluator`,
   `manual` mode), not the shape it replaces.
3. Update **OQ-1**'s status — Step 4 closes the pure-UI half (the match count renders from
   `totalRowCount()`); the derived-signal half, if still open, stays open and says so.
4. Fix **§9**'s stale claim that `status.md` has no row for `capability: filters` — it does now.
5. Update the frontmatter `status:` block and `date:`; flip `1-gap-analysis.md`'s `status:` from
   "open — proposal, nothing here built yet" to built, naming what shipped and what stayed deferred.

Marks that must stay explicit rather than quietly ✅:

- 2.4's late-default race is covered **only** by the server story (Step 5), not the client one.
- 4.2's widen-on-throw is covered, with the console report surfaced on canvas.
- Anything in "Left out on purpose" stays ❌ with its stated reason.

## Implementation Notes

- Re-derive from `src/`, never from a sibling doc — the rule this plan's own revision enforces.
- Product voice stays product voice.

## Risks / Watchouts

- Don't credit the `selection-filtering/` rows to the selection plan; they are measured here, and
  the selection plan's own doc step references them (that plan does not re-count them).

## Non-Goals

- No `1-state/` edits beyond what Step 7 already did.

## Acceptance Checks

- [ ] Every product story carries a mark derived from a rendered story.
- [ ] §8.1 S3/S4, OQ-1 and §9 all corrected.
- [ ] `1-gap-analysis.md` status reflects what shipped.

---

← [Step 8: architecture.md U5](step-8-architecture-u5-method-names.plan.md) | [Step 10: stories.md registration](step-10-stories-doc-registration.plan.md) →
