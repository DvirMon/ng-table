---
title: 'Step 6 — finding on #40: order the two editing features (row-edit before optimistic) vs keep the shared editing store'
type: task-step
issue: 74
---

# Step 6 — finding on #40: order the two editing features vs keep the shared editing store

**PR scope:** No code. One comment on GitHub issue #40 (`gh issue comment 74 --body-file …`).
Record the finding; do **not** act on it. The rationale rewrite in the docs is #44.

**Task type:** docs

**Skills used:** —

**Depends on:** Step 3 (the finding must reflect the converted code, not today's)
**Parallel-safe with:** Step 4, Step 5

**Scaffolding agent:** main thread, no agent

## Files

- none (issue comment); optionally link it from
  `docs/1-state/work/computed-state-mechanism/3-decisions.md` as a one-line pointer under D25 if
  the user wants the trail in-repo — ask, do not assume.

## Why This Step Exists

Architecture "Open questions — closed", item 6: "Editing features' shared store — finding
recorded on #40, rationale rewritten in #44." Spec "What changes semantically": the standalone
editing store was justified by composition-order independence, which positional composition
retires; the mechanism stays but the reason changes. Issue #40: "take the one look the
architecture asks for: whether the two features should now simply be ordered (row-edit before
optimistic) instead of sharing a store — record the finding as a comment, do not act on it."

## What To Do

Write the comment under these headings, from the code as it stands after Steps 1–3:

1. **What "ordered" would mean.** `withOptimistic(), withRowEdit()` with row-edit reading
   `input.editing` (typed, since optimistic precedes) instead of building its own store; the
   ADR-0007 collision throw becomes an "optimistic must precede row-edit" requirement.

2. **What it would cost.** Enumerate from the code:
   - row-edit's single-mode trim is an `onWrite` interceptor supplied at `createEditingStore()`
     construction (`enforceSingleMode`); an ordered row-edit would need optimistic's store to
     accept a post-hoc interceptor — a new API on `EditingStore` (`apply` exists, `onWrite` is
     construction-only);
   - `createDraftRows` needs `store.editing` — reachable off the input in the ordered form;
   - the consumer must list two features in a fixed order for one capability, against story 4
     ("`with*` means exactly one optional feature");
   - `withRowEdit` alone (today's common case — see the stories) would become two calls.

3. **What it would buy.** One store instance instead of the "row-edit owns it" rule; the
   `editing` member has a single provider by construction rather than by throw.

4. **Finding.** State it in one sentence. Expected (verify, do not assume): keep the shared
   store; the new rationale is _ownership_ — `withRowEdit()` is a superset feature that builds
   the editing store itself and adds `open`/`draft`; `withOptimistic()` builds the same store
   when composed alone; composing both is a collision, not an ordering — and order independence
   is no longer the reason. If the look turns up the opposite, say so with the same specificity.

5. **Hand-off line** for #44: which sentences in `editing-state.ts`'s header (rewritten in
   Step 1), `with-row-edit.ts`'s doc (Step 3), `docs/1-state/features/*` editing docs and
   `CLAUDE.md` carry the old rationale.

Then `gh issue comment 74 --body-file <path>` (use a scratchpad file; heredoc quoting on
Windows is unreliable).

## Implementation Notes

- Keep the comment under ~40 lines; headings as above; no D-number narration beyond the
  pointers.

## Risks / Watchouts

- Do not change code or docs here — the issue says record, not act; #44 owns the docs.

## Non-Goals

- No ADR. No decision — a finding.

## Acceptance Checks

- [ ] Comment posted on #40 with the five headings; finding stated in one sentence.
- [ ] Progress file updated; issue #40's last acceptance box can be ticked.

---

← [Step 5: with-row-edit.spec.ts + optimistic-mutations.spec.ts](step-5-with-row-edit-spec.plan.md)
