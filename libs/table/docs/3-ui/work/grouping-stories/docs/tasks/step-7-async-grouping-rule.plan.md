---
title: "Step 7 — async grouping rule: applyGroupingAsync() on the static story"
type: task-step
plan: ../../1-gap-analysis.md
node: F
---

# Step 7 — async grouping rule: `applyGroupingAsync()` on the static story

**PR scope:** An extension to `grouping-static/` — host wiring plus one new story export. No new
folder.

**Task type:** code

**Skills used:** angular-developer, typescript-conventions

**Depends on:** Step 3, Step 4
**Parallel-safe with:** Step 5, Step 6

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/stories/grouping/grouping-static/grouping-static-story-host.component.ts` (edit)
- `libs/table/src/stories/grouping/grouping-static/grouping-static-story-host.component.html` (edit)
- `libs/table/src/stories/grouping/grouping-static/grouping-static.stories.ts` (edit)
- `libs/table/src/stories/grouping/grouping-static/grouping-static.mdx` (edit)

## Why This Step Exists

Node F. `applyGroupingAsync()` is the one genuinely async surface grouping has, and D13's guarantee
— **a pending rule holds the last explicit choice rather than flashing ungrouped** — is invisible
unless raced on purpose. It also carries product story 1.4's "not silently getting a different
report".

Status corrected in the gap analysis: this was called blocked on issue #60 step 4; that step is
done (`api/features/with-grouping.ts` folds `config.groupingRule ?? rulesGroupingRule` over
`baseGrouping`, and `applyGrouping` / `applyGroupingAsync` are live on the public surface). Only
#60's tests-and-docs steps remain, which change no behaviour.

## What To Do

1. Wire an `applyGroupingAsync()` rule into the static host's grouping config, resolving through a
   real MSW round trip (`injectGroupedRowsApi()` or a sibling endpoint in
   `grouping/fixtures/handlers.ts`), driven by the existing `forceFailure` / `latencyMs` header
   pattern — not a fake `await`.
2. On canvas, while the rule is pending: the table visibly **holds the last explicit grouping**
   rather than flashing ungrouped. Add a pending marker so the held state is legible rather than
   inferred.
3. Failure path: the rule rejects; the story states what the table falls back to and does not
   blank.
4. Add `AsyncGroupingRule` as a new export in `grouping-static.stories.ts` with `latencyMs` set high
   enough that the hold is observable without touching Controls, and add the matching `.mdx`
   section with its own `<Canvas>` and one-paragraph summary.
5. Extend the host's hint paragraph to branch for this story's state, per `stories.md`.

## Implementation Notes

- Keep the async rule additive: `Default` and `ThrowingGroupOrder` must be unchanged in behaviour.
  If that is not achievable cleanly in one host, say so rather than restructuring Step 4's story.
- The rule is a *column rule* (`applyGroupingAsync` from the library root), not a host-local
  `effect()` — D6's no-`effect()` fold is the point.

## Risks / Watchouts

- `1-state/filters.md`-style stale docs exist for grouping too: `tier-3-feature-config.md`'s
  `applyGroup(path, …)` names a mechanism that diverges from the shipped `applyGrouping`. Do not
  follow it; it is a doc fix owed by issue #60 step 6.

## Non-Goals

- No new story folder. No change to `with-grouping.ts` or the engine.

## Acceptance Checks

- [ ] `AsyncGroupingRule` renders; during the pending window the previous grouping stays applied.
- [ ] Forced failure leaves a legible fallback, never a blank table.
- [ ] `Default` and `ThrowingGroupOrder` behave exactly as after Step 4.
- [ ] `npx tsc -p libs/table/tsconfig.lib.json --noEmit` clean.

---
← [Step 6: grouping-selection/](step-6-grouping-selection-story.plan.md) | [Step 8: grouping docs](step-8-grouping-docs.plan.md) →
