---
title: "Step 7 — 1-state/filters.md: code: none → shipped, then regenerate status.md"
type: task-step
plan: ../../1-gap-analysis.md
node: E
---

# Step 7 — `1-state/filters.md`: `code: none` → `shipped`, then regenerate `status.md`

**PR scope:** Docs only. One frontmatter fact + a registry regeneration.

**Task type:** docs

**Skills used:** audit-docs

**Depends on:** —
**Parallel-safe with:** every other step in this plan

**Scaffolding agent:** — (main thread)

## Files

- `libs/shared/table/docs/1-state/filters.md` (edit)
- `libs/shared/table/docs/status.md` (regenerate — see below)

## Why This Step Exists

Node E, scope already reduced by the research check: two of its three facts fixed themselves when
`status.md` was last regenerated (the `filtering` row now reads `drilled | shipped`, and a
`filters` row exists). What remains is one wrong fact — `filters.md` declares `code: none` while
`src/api/create-filters.ts` and `src/api/filters/` (`rules.ts`, `matchers.ts`, `state.ts`,
`evaluator.ts`, `recorder.ts`, `validate.ts`) ship with spec coverage — which makes the regenerated
`filters` row wrong in its own way.

## What To Do

1. Verify against `src/` first, do not take this plan's word for it: `create-filters.ts` and the six
   `api/filters/*.ts` files exist and have specs.
2. Update `1-state/filters.md`'s frontmatter `code:` to `shipped` (matching the vocabulary the other
   feature docs use) and its `date:`.
3. Regenerate the registry: `npm run table:status`. **Do not run it from an automated step — leave
   it to the user and say so in the PR/summary.**

## Implementation Notes

- Frontmatter vocabulary must match what the generator expects; copy an already-`shipped` sibling.

## Risks / Watchouts

- Don't touch R1–R31 or any decision text — this is a status fact, not a content revision.

## Non-Goals

- Product-doc coverage marks (Step 9). `3-ui/architecture.md`'s stale method names (Step 8).

## Acceptance Checks

- [ ] `filters.md` frontmatter matches what `src/` actually ships.
- [ ] `npm run table:status` named as pending for the user to run.

---
← [Step 6: selection-filtering/](step-6-selection-filtering-story.plan.md) | [Step 8: architecture.md U5](step-8-architecture-u5-method-names.plan.md) →
