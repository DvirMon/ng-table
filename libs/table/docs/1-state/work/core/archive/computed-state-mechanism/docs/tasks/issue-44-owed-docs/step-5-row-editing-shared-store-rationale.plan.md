---
title: "Step 5 — row-editing: the shared-store rationale no longer holds"
type: task-step
issue: 78
---

# Step 5 — row-editing: the shared-store rationale no longer holds

**PR scope:** One feature doc. Owns every hunk in it, including its stale call sites.

**Task type:** docs

**Skills used:** —

**Depends on:** Step 2 (ADR-0007's amendment defines the claim collision this rationale now turns on)
**Parallel-safe with:** Step 4, Step 6, Step 7

**Scaffolding agent:** main thread

## Files

- `libs/shared/table/docs/1-state/features/row-editing.md` (edit — the shared-store rationale plus
  `:157`, `:242`, `:249`)

## Why This Step Exists

The doc's rationale for `withRowEdit()` and `withOptimistic()` sharing one editing store rests on
**order-independence** — compose them in either order, same result. #40 established that this is
no longer true, and the finding is recorded on that issue: composing both features **throws in
either order** (the `editing` member is claimed twice, ADR-0007). #40's own AC still reads "works
in either order" and was closed with the AC reinterpreted, not met.

So the doc currently sells a property the code denies, on a composition that does not compose. A
reader following it hits a construction throw and has no doc to reconcile it against.

## What To Do

1. **Rewrite the shared-store rationale.** State what is actually true:
   - `withRowEdit()` composes `withOptimistic()` internally; that is the supported path.
   - Composing both explicitly throws at construction — a duplicate `editing`/`pending` member
     claim — in either order. Link ADR-0007 (and its Step 2 amendment).
   - Order-independence is no longer the justification for the shared store. Give the justification
     that survives: one editing store means one set of restore points, so a rollback finds the
     snapshot the capture wrote. The old failure mode this prevents — two independent snapshot
     signals, rollback silently doing nothing — is exactly ADR-0007's motivating example; cite it
     rather than restating it.
   - Reference the #40 finding by issue number so the trail is followable.
2. **Note the stale AC.** One line stating #40's AC 2 text ("in either order") was stale at close
   and the observable contract is the throw. This is the doc's job — the closed issue can't carry it.
3. **Fix this file's three call sites** to positional form: `:157` `withOptimistic<Person>()`,
   `:242` `withRowEdit<Person>({ multiple: () => isWide() })`, `:249`'s two-feature error example
   (which must keep erroring — only the call shape changes).

## Implementation Notes

- The finding is in
  `docs/1-state/work/computed-state-mechanism/docs/tasks/issue-40-row-edit-optimistic-feature-contract/progress.md`
  under "Spec axis on #40". Read it before writing; do not reconstruct it from the code.
- `editing-state.ts`'s file header was already corrected on #40 ("no longer implies the two
  features share one store when composed") — the source is right, only the doc lags. Match the
  source's wording rather than inventing a third phrasing.

## Risks / Watchouts

- 663 lines; the rationale is not the only place order-independence is implied. Grep the file for
  "order" and check each hit before calling the rewrite done.
- Do not turn this into a migration guide. The feature's API is unchanged apart from the call
  shape — only the *rationale* is wrong.

## Non-Goals

- Amending #40's AC on GitHub (optional cleanup, not this issue's scope — Step 8 may note it).
- The `defineFeature()` prologue dedupe (#40 review leftover) — a code issue.

## Acceptance Checks

- [ ] No sentence claims the two editing features compose in either order
- [ ] The rationale states the surviving justification (one set of restore points) and links ADR-0007
- [ ] The #40 finding is referenced by issue number
- [ ] `grep -n 'with[A-Za-z]*<[A-Z]' docs/1-state/features/row-editing.md` returns nothing
- [ ] `grep -in 'order' docs/1-state/features/row-editing.md` — every hit checked, none implies order-independence

---
← [Step 4: state-layer architecture](step-4-state-architecture-composition.plan.md) | [Step 6: CLAUDE.md](step-6-claude-md-composed-and-surface.plan.md) →
