---
title: Gaps — Row Editing, UI layer
type: plan
status: open — nothing here has shipped; re-prioritized 2026-08-28 after the product pass
date: 2026-08-28
parent: ../../architecture.md
---

# Gaps — what editing's UI layer does not cover yet

Split out of [`1-state/work/row-editing/active/with-row-editing/5-gaps.md`](../../../1-state/work/row-editing/active/with-row-editing/5-gaps.md)
on 2026-08-26. That register measures the **state layer** — which rows are open, what restores on
Cancel, what happens on an id swap. This one measures the **UI layer**: how a person drives it.

The boundary is *which layer owns the mechanism*, not which layer the user notices it in:

| Layer | Owns | Example |
|---|---|---|
| **State (1)** | what is true about a row | a `pending` entry orphaned by a temp-id swap |
| **UI (3)** | keys, focus, announcements, affordances | Escape cancels the row |

Every gap here is **UI-layer in full**. `revertEdit` exists and works; nothing calls it from a key
handler, and adding that call is directive work. No state-layer change is involved in any entry
below.

Specs measured against: [`3-ui/architecture.md`](../../architecture.md),
[`3-ui/cross-cutting/accessibility.md`](../../cross-cutting/accessibility.md), and
[`1-state/features/row-editing.md`](../../../1-state/features/row-editing.md) for the verbs these
gaps would call.

> **Verb names are v2.0** (post-D37 split): `captureEdit`, `releaseEdit`, `revertEdit`,
> `beginEdit`, `endEdit`, `clearEdit`. The state-layer register still carries v1.0 names in its
> body.

---

## Priority 1

### G1 — No keyboard story at all

**What:** no Escape-to-cancel, no Enter-to-save, no Tab containment, nowhere in the stack.

Both references bind Escape to revert — MUI X (`stopRowEditMode({ ignoreModifications: true })`)
and AG Grid. We bind nothing. D31.2 flagged this as "missing affordance, noted not decided" and
left it.

**Why still P1:** an edit mode without Escape is incomplete, not unpolished. Every single gated
table hits it, on the first row a user opens.

> **Re-scoped 2026-09-04** — see
> [`work/row-edit-keyboard-a11y/2-decisions.md`](../row-edit-keyboard-a11y/2-decisions.md) (D1).
> This does **not** ship as a library directive. Row-editing's trigger policy is deliberately
> consumer-owned (D20/D43) — live/gated/optimistic tables want different Escape/Enter/focus
> semantics, unlike expansion's unambiguous Enter/Space activation. Closes via a **documented
> recipe** (cookbook page: build your own row-scoped directive on `revertEdit`/`endEdit`/
> `captureEdit`/`beginEdit` + `NGP_TABLE_ROW`/`NGP_TABLE_STORE`), not shipped code. Shelved, not
> rejected — same standing D18 gives row actions; revisit only on real cross-consumer
> duplication. No longer "the largest undesigned item in the editing cluster" as a code effort —
> it is a docs effort now.

**Where:** a cookbook doc, not a directive. The updaters it demonstrates already exist —
`revertEdit(id)` for Escape, `endEdit(id)` for Enter.

**Blocked on:** nothing. All the verbs it needs shipped in E4.

---

## Priority 3 — after G1

### G9 — Focus management

Nothing moves focus into the row on `beginEdit`, and nothing restores it to the Edit button on
close. Related: D26 notes that the temp-id swap destroys and recreates the `<tr>`, taking focus
inside it with it — see
[G3](../../../1-state/work/row-editing/active/with-row-editing/5-gaps.md) /
[#19](https://github.com/DvirMon/ng-table/issues/19) for the state-layer half of that.

**Re-scoped 2026-09-04** — same as G1 (D1 in `work/row-edit-keyboard-a11y/2-decisions.md`):
documented recipe, not a shipped directive.

### G10 — Accessibility beyond keyboard

No announcement of edit-mode entry or exit, no `aria-*` contract for an editing row, no
error-association pattern for a failed save. `ColumnDef.statusMessage` is drafted in specs and not
wired to anything.

WCAG exposure is already documented in the research: 3.2.2 On Input for a row that moves or
vanishes mid-interaction — D24 removes the mid-typing case, but a committed edit still moves the
row with no announcement.

**Re-scoped 2026-09-04** — same as G1 (D1 in `work/row-edit-keyboard-a11y/2-decisions.md`):
documented recipe, not a shipped directive.

### G11 — Retained-row affordance *(phantom)*

D25 says a row edited out of the active filter stays visible and flagged until the filter changes.
It needs a chip or muted styling so the user can tell why an out-of-filter row is showing.
**Phantom** — `withFiltering()` does not exist. Do not build from these notes; re-derive when the
stage does.

---

## Shared with the consumer layer

### G7 — Save-gating and dirty state

**What:** F5 (dirty / validation / commit) was in the editing cluster's stated scope and nothing
addresses it. There is no documented recipe for disabling Save while a row is invalid, no
table-level "any row dirty" signal, and no unsaved-changes guard. E2b validates server-side only.

**Why it is not a state-layer gap:** the form already owns dirty, touched and validity (D1), and
`table.editing()` already gives the row set. Everything needed exists; what is missing is the
recipe and, for a "Save all" affordance, a UI component.

**Where:** a section in
[`1-state/features/row-editing.md`](../../../1-state/features/row-editing.md) plus a demo
addition. **O17** (validation scope — `applyEach` validates rows the user cannot see) stays
phantom until filtering or pagination exists.

---

## Not gaps — deliberate

| Not shipped | Why |
|---|---|
| Row actions markup, keyboard, ARIA | D18 — every operation is already expressible through the updaters; an action registry would drag label/icon/ordering into a data-only store. Revisit only on real cross-consumer duplication, and then as a UI directive. |
| Library-detected edit triggers (blur hooks, dirty checking) | D20 — "editing" has exactly one definition: membership in the map. Trigger policy is the consumer's. |

The full non-goals table, including the state-layer entries, stays in the
[state-layer register](../../../1-state/work/row-editing/active/with-row-editing/5-gaps.md#not-gaps--deliberate).

---

## Open decisions

One open question gates anything in this file. The reasoning stays in the decision log; this is the
index.

| # | Question | Gates | Full text |
|---|---|---|---|
| **O17** | `applyEach` validates rows the user cannot see (filtered out, other pages), so `valid()` can be false because of row 4,000. How are submit and "save all" scoped? | **G7** — phantom until filtering or pagination exists | [with-row-editing](../../../1-state/work/row-editing/active/with-row-editing/2-decisions.md) |

Nothing gates **G1**, **G9** or **G10** — every verb they call shipped in E4, and the a11y contract
is a directive decision, not an open one. **G11** is phantom on `withFiltering()`, not on a
question.

The state layer's open questions — id-swap policy, rollback representation, declarative openness —
are indexed in the
[state register](../../../1-state/work/row-editing/active/with-row-editing/5-gaps.md#open-decisions).

---

## Suggested order

```
G1  keyboard         ──┐
G9  focus            ──┼─ one directive, one work folder, one ticket
G10 a11y             ──┘
G7  save-gating recipe   (docs + demo — independent of the directive)
```

### Re-derived 2026-08-28, re-scoped 2026-09-04

```
G1/G9/G10   DESIGN FIRST, then write the recipe — key map, focus-restore policy, ARIA contract,
            announcement wording. None of it exists. One effort, one work folder
            (row-edit-keyboard-a11y/), one cookbook doc — NOT a shipped directive (D1).
undo affordance   folds into the same recipe — where Undo lives, how long it lasts,
                  its keyboard binding. The state layer already makes it possible
                  (removeEdit + an unreleased restore point; pending() is the undoable set).
restored-row feedback   also the same recipe — scroll-into-view + flash for a row that
                        came back. Driven from the consumer's own error callback; the
                        `restored` signal was considered and declined as public API.
G7          docs + demo, independent, small
G11         still phantom — needs withFiltering()
```

**Why undo and restored-row feedback belong here rather than in their own efforts:** all three are
row-scoped, keyboard-driven, and need the same focus and announcement machinery. Splitting them
produces a keyboard handler with no focus story, which the original entry already warns is worse
than neither.

**G1, G9 and G10 are one effort, not three.** They share a work folder and a cookbook doc, not a
directive (re-scoped 2026-09-04, D1) — splitting them produces a keyboard recipe with no focus
story, which is worse than neither.

G11 is not in the order — it is phantom until `withFiltering()` exists.
