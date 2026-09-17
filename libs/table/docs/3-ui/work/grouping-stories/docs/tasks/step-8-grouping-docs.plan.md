---
title: "Step 8 — re-derive grouping coverage marks and register the cluster in stories.md"
type: task-step
plan: ../../1-gap-analysis.md
---

# Step 8 — re-derive grouping coverage marks, register the cluster in `stories.md`

**PR scope:** Docs only. No source change.

**Task type:** docs

**Skills used:** audit-docs

**Depends on:** Step 4, Step 5, Step 6, Step 7
**Parallel-safe with:** —

**Scaffolding agent:** — (main thread)

## Files

- `libs/table/docs/0-product/grouping.md` (edit)
- `libs/table/docs/3-ui/stories.md` (edit)
- `libs/table/docs/3-ui/work/grouping-stories/1-gap-analysis.md` (edit — status line)

## Why This Step Exists

A coverage mark cannot flip before the story that demonstrates it renders. The product doc still
carries "Every story in this document is ❌, verified 2026-09-10" plus a 2026-09-13 correction note;
once Steps 4–7 land, most of those become ✅ and the rest need an explicit, stated reason.

## What To Do

1. **`0-product/grouping.md`** — re-derive every story's mark **from the shipped stories**, not from
   this plan's predictions. ✅ only where the story demonstrates the behavior *including its failure
   path*; 🟡 where the mechanism ships and the affordance does not; ❌ unchanged where nothing
   renders. Replace the blanket ❌ paragraph and the superseded correction note with the new state.
   Named exceptions that must stay explicit, not silently marked covered:
   - 2.2 expand-all — shipped as an honest regression (S4/S5, OQ-3).
   - 2.3 initial expansion depth — still blocked on S6.
   - 4.1 / 4.2 blank and object group keys — regression demos (S7/S8), the story is the bug report.
   - 4.4's third criterion — a dropped level is still unannounced (the missing half of D14).
   Update the frontmatter `status:` block and `date:`.
2. **`3-ui/stories.md`** — add the `grouping/fixtures/*` cluster to the shared-fixtures table and
   the three new folders to Reference implementations. The doc currently describes the set as "the
   8 stories in `src/stories/`" — correct the count.
3. **`1-gap-analysis.md`** — flip `status:` from "open — proposal, nothing here built yet" to
   built, naming which nodes shipped and which stayed tracked (C3, C4, C5).
4. If any frontmatter `status`/`code` field moves, regenerate the registry: `npm run table:status`.
   **Do not run it as part of an automated step — state that it is pending and let the user run
   it.**

## Implementation Notes

- Marks are re-derived from `src/`, never trusted from a sibling doc — that is the rule this plan's
  own revision was written to enforce.
- Keep the product doc in the product voice ("As a person…"); do not import spec vocabulary.

## Risks / Watchouts

- Do not mark X-G1 covered beyond what Step 6 renders: the cascade is consumer-owned, so the story
  proves the *recipe*, not a library guarantee.

## Non-Goals

- No edits to `1-state/` docs — issue #60 step 6 owns those, including the `applyGroup(path, …)`
  correction in `tier-3-feature-config.md`.

## Acceptance Checks

- [ ] Every product story in `0-product/grouping.md` carries a mark derived from a rendered story.
- [ ] `3-ui/stories.md` lists the grouping fixtures cluster and the three folders, with the story
      count corrected.
- [ ] The gap analysis's `status:` reflects what shipped.
- [ ] `npm run table:status` named as pending if any frontmatter moved.

---
← [Step 7: async grouping rule](step-7-async-grouping-rule.plan.md)
