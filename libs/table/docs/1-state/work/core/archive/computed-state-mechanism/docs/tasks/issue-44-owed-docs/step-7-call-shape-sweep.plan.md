---
title: 'Step 7 — call-shape sweep across the remaining docs, plus the persistence exclusion'
type: task-step
issue: 78
---

# Step 7 — call-shape sweep across the remaining docs, plus the persistence exclusion

**PR scope:** The mechanical half of the issue — every remaining doc that shows the old call shape.
One concern, verifiable by re-grep. Large file count, small per-file diff.

**Task type:** docs

**Skills used:** —

**Depends on:** —
**Parallel-safe with:** Step 1, Step 2, Step 3, Step 4, Step 5, Step 6 (disjoint file set — every
file another step owns is excluded below)

**Scaffolding agent:** main thread

## Files

**Teaching docs** (edit):

- `libs/shared/table/docs/overview.md` — `:97`, `:150`, `:153`, `:156`, `:214`
- `libs/shared/table/docs/1-state/prd.md` — `:99`
- `libs/shared/table/docs/1-state/columns.md` — `:26`, `:36`, `:44`
- `libs/shared/table/docs/1-state/filters.md` — `:308`
- `libs/shared/table/docs/1-state/row-mutations.md` — thunk-form call sites
- `libs/shared/table/docs/1-state/features/expansion.md` — `:126`
- `libs/shared/table/docs/1-state/features/filtering.md` — `:29`, `:69`
- `libs/shared/table/docs/1-state/features/grouping.md` — `:96`
- `libs/shared/table/docs/1-state/features/virtual-scroll.md` — `:41`
- `libs/shared/table/docs/1-state/features/sorting.md`, `selection.md` — verify, edit only if they hit
- `libs/shared/table/docs/0-product/filtering.md`, `0-product/grouping.md`
- `libs/shared/table/docs/2-columns/architecture.md` — `:77`, `:90`, `:304`
- `libs/shared/table/docs/3-ui/directives/columns.md` — `:40`
- `libs/shared/table/docs/3-ui/directives/core.md` — `:53`

**Historical ADRs** (edit — see the decision below):

- `libs/shared/table/docs/adr/0002-table-store-instance-factory.md` — `:26`
- `libs/shared/table/docs/adr/0010-no-angular-lifecycle-names-on-engine-concepts.md` — `:21`, `:28`, `:85`
- `libs/shared/table/docs/adr/0011-chained-render-stages.md` — `:153`
- `libs/shared/table/docs/adr/0015-feature-member-namespacing.md` — `:220`, `:267`

**Persistence spec** (edit — content, not just call shape):

- `libs/shared/table/docs/1-state/state-persistence.md`

## Why This Step Exists

Issue AC 1 and AC 4: no document may tell a consumer to write a row type on a feature call, and
every doc must show the positional form. Steps 1–6 own the docs whose _reasoning_ changed; this
step owns the rest, where only the call shape is wrong. Splitting it out keeps the reasoning
rewrites reviewable — a 19-file mechanical diff and a rewritten ADR do not belong in one review.

The persistence spec rides along because its owed change is a single sentence with no reasoning to
re-derive.

## What To Do

1. **Positional form everywhere.** `createTable(data, config, ...features)`. Delete the thunk
   (`createTable(data, () => ({ … }))`), the `features: [...]` array, and every `createTableSchema()`
   call — the helper is deleted from the library (D25) and every call site now states `trackBy`
   explicitly.
2. **Drop explicit feature type arguments.** `withSorting<Person>()` → `withSorting()`, and the same
   for `withExpansion`, `withSelection`, `withGrouping`, `withRowEdit`, `withOptimistic`,
   `withFiltering`.
3. **`ComposedFeatureMembers` is gone.** `2-columns/architecture.md:304` and `adr/0010:28` reference
   it. The replacement is the accumulating `Feature<In, Out>` fold — rewrite the sentence around the
   mechanism, do not rename the symbol.
4. **Historical ADRs get updated snippets too.** Decided by the user, 2026-09-14, against the
   alternative of leaving them period-accurate: AC 1 is read literally, so no doc anywhere shows the
   old shape.
   - `adr/0015:267` is the exception that needs care, not exemption. Its sentence is a _finding_
     ("the generic-parameter drift found alongside this — `withSorting<Person>()` in 20+ doc call
     sites"). Reword it to past tense so the finding survives as history — it was found, and #33
     closed it — rather than deleting the sentence or silently updating its example. The finding's
     substance must still be recoverable by a reader.
   - `adr/0010:21`/`:85` describe `features: [...]` as the thing being passed into. The concept
     survives under a different call shape; update the shape, keep the argument.
   - `adr/0011:153` mentions `features: []` inside a rejected-alternative rationale — shape only.
5. **Persistence spec: derived members are excluded.** State it plainly — a derived member is
   recomputed from its inputs, so persisting it would restore a stale value that the next evaluation
   overwrites. Put it where the spec enumerates what is persisted, not in a footnote. Also fix any
   call shape in that file.

## Implementation Notes

- Work from a grep, not from this file's line numbers — the numbers were taken on 2026-09-14 and
  Steps 1–6 may land first. The sweep is done when the greps in Acceptance Checks are clean.
- `1-state/features/filtering.md:69` already says "Never pass `In` explicitly" — that rule is
  correct and stays. Only its example needs the current shape.
- `1-state/features/grouping.md:96` and `virtual-scroll.md:41` mention `features: []` inside prose
  about optional composition. The composition rule is unchanged; only the shape is.
- Product docs (`0-product/*`) are written for a non-engineer reader — if a call snippet is
  incidental there, prefer removing it to updating it.

## Risks / Watchouts

- Every file another step owns is excluded from the list above. Do not sweep `1-state/architecture.md`,
  `features/row-editing.md`, `CLAUDE.md`, or ADRs 0003/0005/0007/0014 — you will collide with Steps
  1–6 in the same lines.
- A snippet is not always just a snippet: `2-columns/architecture.md:90` shows `columnsSchema` in the
  same call. Preserve every other argument while changing the shape.
- Do not "fix" prose that is describing a _past_ state deliberately — check whether the sentence is
  making a historical claim before rewriting its example.

## Non-Goals

- Any reasoning rewrite (Steps 1–6).
- New examples, new sections, or restructuring these docs. Shape in, shape out.

## Acceptance Checks

- [ ] `grep -rn 'createTableSchema' libs/shared/table/docs libs/shared/table/CLAUDE.md` — no hits outside `work/`
- [ ] `grep -rn 'ComposedFeatureMembers' libs/shared/table/docs` — no hits outside `work/`
- [ ] `grep -rnE 'with[A-Za-z]+<[A-Z]' libs/shared/table/docs` — no hits outside `work/` except ADR-0003's historical example (Step 1) and ADR-0015's reworded finding
- [ ] `grep -rn 'features: \[' libs/shared/table/docs` — no hits outside `work/`
- [ ] `grep -rn 'createTable(.*() => ({' libs/shared/table/docs` — no hits outside `work/`
- [ ] `state-persistence.md` states that derived members are excluded, and why
- [ ] `adr/0015`'s drift finding is still readable as a finding, in past tense
- [ ] No file owned by Steps 1–6 appears in this diff

---

← [Step 6: CLAUDE.md](step-6-claude-md-composed-and-surface.plan.md) | [Step 8: audit gate and close-out](step-8-audit-gate-closeout.plan.md) →
