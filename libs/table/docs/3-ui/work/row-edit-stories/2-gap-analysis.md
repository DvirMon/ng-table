---
title: Gap analysis — Storybook stories vs. product row-editing stories
type: plan
status: open — proposal, nothing here built yet
date: 2026-08-31
parent: ../../architecture.md
---

# Row Editing — Story Coverage Report

Compares [`0-product/row-editing.md`](../../../0-product/row-editing.md)'s user stories against
the 6 existing Storybook stories in `src/stories/`, then proposes the target story set — minimal
count, standalone only for mechanisms large enough to need their own showcase (optimistic
updates, external-write conflict, sorting × editing).

This follows on from [`1-proposal.md`](1-proposal.md) (delivered 2026-08-26, v1.0 verb names).
That proposal shipped S1/S2/S4/S5/S6; this document re-measures what shipped against the product
doc's stories (written after the proposal, with resolved OQs and two new shipped designs —
optimistic-crud delete rollback, duplicate row) and finds the next round of gaps.

## Existing stories — what they actually cover (read from the story-host code, not the mdx)

| Story | Composes | Actually demonstrates |
|---|---|---|
| `gated-edit/` | `withRowEdit({ multiple })` | Open/Save/Cancel/Discard, Add, Duplicate, multiple-open toggle, pessimistic save + failure |
| `live-table/` | nothing | Bare live input table, field-commit-on-blur, Add row (no focus mgmt) — no rollback, no undo |
| `live-optimistic/` | `withOptimistic()` | Live edit with capture/release/revert on focus/blur, Delete-with-rollback, forced-failure toggle |
| `optimistic-save/` | `withRowEdit()` | Gated Open/Save, but save closes the row optimistically (`endEdit` before the fetch) instead of pessimistically — ~80% identical to `gated-edit/`'s save path, no Cancel/Duplicate/multiple |
| `external-write/` | `withRowEdit()` | Server push while a row is open (`captureEdit` moves the restore point forward), row deleted externally while open (ADR-0006 pruning) |
| `form-write-mutations/` | `withRowEdit()` | Add/remove routed through the form's own root signal instead of the table's mutation verbs — no restore point, no rollback (an integration pitfall, not a user story) |

**Redundancy found:** `optimistic-save/` is a near-subset of `gated-edit/`'s save path with one
variable changed (when the row closes relative to the fetch). Fold it into `gated-edit/` as a
save-mode toggle rather than keeping a second file.

**Never demonstrated anywhere:** keyboard (Escape/Enter/Tab), focus management, screen-reader
announcements, validation/save-gating, undo (value or delete), add-several-in-a-run, save-all for
multiple-open, duplicate in live mode, bulk delete/select, and sorting × editing interactions
(null-ordering now ships in code — `applySortNulls()` — but no story exercises it).

---

## Target story set

Four stories total: two minimal baseline stories, two standalone showcases for mechanisms too
large to fold in, plus one new standalone story for sorting × editing. Every mocked network
effect (save/delete/push) is a button that flips local signals to simulate GET/POST/PUT/DELETE
outcomes — no real backend, matching the existing `forceFailure`/`latencyMs` pattern already used
by `optimistic-save/` and `live-optimistic/`.

### 1. `gated-edit/` (extend existing) — Gated CRUD baseline

**Mode:** gated only. **Replaces:** `gated-edit/` + `optimistic-save/` (merged); validation
angle folded in as buttons, not a separate file.

| Product story | Covered by |
|---|---|
| §1.1 correct a value (gated) | existing — Edit → type → Save |
| §1.2 abandon edit / Cancel | existing |
| §1.4 saving/failed state | existing (`saveError`) + **add**: persistent dismissible failure marker + Retry button (currently the error clears silently on next action) |
| §1.6 keyboard drive | **new**: Escape cancels open row, Enter saves, Tab stays inside the row |
| §1.7 blocked from saving invalid | **new**: a "Force invalid" toggle per row that disables Save and shows the reason at the cell |
| §1.8 edit several rows / save-all | existing (`multiple` toggle) + **new**: "Save All" button, per-row partial-failure marking |
| §2.1 add a row (gated) | existing |
| §2.3 add several in a run | **new**: "Save & add next" button that commits and immediately opens a fresh blank row |
| §4.1 duplicate (gated) | existing |
| §4.2 cancel-add vs cancel-duplicate | existing (`discardEdit` vs `cancelEdit`) — **add** a visible toggle so both outcomes are inspectable side by side in one run, not just two separate button handlers |
| optimistic vs pessimistic save | **merge `optimistic-save/` in**: a "Save mode: Pessimistic / Optimistic" radio on the story controls, reusing the existing `endEdit`-before-fetch code path |

**New mock buttons:** Force Invalid, Retry, Save All, Save & Add Next, Save Mode toggle.

### 2. `live-table/` (extend existing) — Live CRUD baseline, no safety net

**Mode:** live only, **no** `withOptimistic()`. Deliberately kept the weakest table in the set —
its job is to make the mode-note in §1.2 visible ("live has no Cancel"), which only lands if a
plain, unprotected live table exists to compare against.

| Product story | Covered by |
|---|---|
| §1.1 correct a value (live) | existing |
| §1.2 mode note — no Cancel exists here | existing, by omission (contrast with story 1) |
| §1.3 undo | **new**: ⌘Z/Ctrl+Z restores the last committed field value — this is the only place undo belongs, since live mode has no Cancel to fall back on |
| §2.1 add a row (live) | existing — **add**: focus lands in the new row's first cell, row visually marked as new |

**New mock buttons:** none — Undo is a keybinding, not a button (per §1.3's own acceptance
criterion: "reachable from the keyboard... visible somewhere persistent").

### 3. `live-optimistic/` (extend existing) — standalone: Optimistic Updates & Rollback

**Why standalone:** this is the large, cross-cutting mechanism the ask calls out by name.
Covers both modes via a toggle rather than duplicating the story.

**Mode:** toggle Gated/Live. **Absorbs:** the delete-rollback half already in `live-optimistic/`.

| Product story | Covered by |
|---|---|
| §1.1 optimistic save + rollback, both modes | existing (live) + **add** a Gated/Live mode toggle so the same story proves both `withRowEdit()+withOptimistic()` and `withOptimistic()`-only compose the same three verbs |
| §1.4 pending/saving state | existing (`pending()`-driven badge) + **add**: screen-reader announcement on transition, and a "leave page" `beforeunload` guard demo (a button that simulates navigating away while a save is pending) |
| §3.1 delete + rollback | existing |
| §3.2 undo a delete | **new**: once a delete settles, an Undo control (toolbar + ⌘Z) reappears for N seconds and calls `revertEdit` before the restore point is released — the mechanism (`removeEdit`/`revertEdit`) already ships, only the affordance is missing |
| §1.5 (partial) forced-failure / retry loop | existing (`forceFailure`, `latencyMs` inputs) |

**New mock buttons:** Mode toggle (Gated/Live), Simulate Leave Page, Undo (+ keybinding).

### 4. `external-write/` (extend existing) — standalone: External Write & Conflict

**Why standalone:** conflict resolution is its own mechanism (ADR-0006 reconciliation +
capture-forward semantics) and the product doc explicitly calls out that the *plumbing* is
covered but the *story* (on-screen indication) is not — closing that gap is enough surface to
justify keeping this on its own.

| Product story | Covered by |
|---|---|
| §1.5 told when someone else changed the row | existing mechanism (`captureEdit` on push) — **add**: a visible banner on the row ("Updated by someone else — dept changed to X") + a three-way choice (Keep mine / Take theirs / merge field-by-field), which is the actual missing acceptance criterion today |
| §1.5 external write to a row I'm not editing | **new**: push a change to a row that is *not* open, confirm it updates quietly with no focus/scroll steal |
| §1.2 failure behavior — row deleted while open | existing (`removeRowExternally`) — **add**: message "this row was deleted" instead of the editor just closing silently |

**New mock buttons:** "Push to row I'm not editing", conflict banner + 3-way resolution buttons.

---

## New standalone story required (does not exist today)

### 5. `sorting-editing/` — NEW — Sorting × Editing interactions

**Why standalone:** cross-feature interaction owned by a different pipeline stage
(`withSorting()` + `withRowEdit()`/`withOptimistic()` composed together), not exercised by any
current story, and large enough on its own (comparator + row-hold + focus) to warrant a dedicated
demo rather than a button bolted onto story 1 or 2.

| Product story | Covered by |
|---|---|
| §5 S-2 null/empty value sort placement | **new**: mock data needs a nullable/blank field (current `EditRow` only has `name`/`dept`, both always populated — add a nullable column); toggle sort direction, show the blank row stays put per `applySortNulls()`, which is already shipped in code (`api/column-rules.ts`) but has zero story coverage today |
| §5 S-1 / OQ-3 row must not move while open | **new**, and will currently **fail** — OQ-3's row-hold is designed but not implemented. Build the story anyway: it's the regression demo that proves the gap and will start passing the moment the row-hold ships, no story rework needed later |
| §2.2 find the row I just added, under a sort | **new**: add a row while sorted by name, confirm it holds position during fill (same row-hold dependency as above) |

**New mock buttons:** Sort by name (asc/desc), Add row while sorted, Add row with blank value.

---

## Left out of the story set on purpose

| Item | Why not a story |
|---|---|
| `form-write-mutations/` | Keep as-is, unmerged. It documents an integration pitfall (§7, "not user-facing") for library consumers, not a person-facing story — testing it as a "feature" would misrepresent it as a supported pattern. |
| §3.3 bulk delete, X-1 bulk edit | Blocked on `withSelection()`, which does not exist. No story possible until selection ships — tracked, not skipped. |
| G-1/G-2 (grouping), D-1/D-2 (drag-and-drop), P-1 (virtual scroll) | Features themselves are unbuilt (`withGrouping()`, drag-and-drop, pagination). Nothing to story yet. |
| G7 recipe (save-gating docs) | Folded into story 1's "Force Invalid" button rather than a separate demo — it's a recipe, not a mechanism. |

---

## Summary: 5 stories, not 9

| # | Story | Status | Standalone reason |
|---|---|---|---|
| 1 | `gated-edit/` | extend + absorb `optimistic-save/` | — (baseline) |
| 2 | `live-table/` | extend | — (baseline) |
| 3 | `live-optimistic/` | extend | Optimistic updates — large, cross-mode mechanism |
| 4 | `external-write/` | extend | Conflict resolution — its own mechanism, explicit product gap |
| 5 | `sorting-editing/` | **new** | Cross-feature pipeline interaction, zero existing coverage |

Net change: 6 existing files → 5 stories (one merge), plus one new standalone story, with the
gap list above turned into ~15 new buttons/keybindings across the four extended stories rather
than new files.
