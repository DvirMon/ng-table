---
title: State Layer Reference — withDragDrop()
type: architecture
version: 0.1
date: 2026-09-23
capability: drag-drop
spec: stub
code: none
audience: developers
parent: ../architecture.md
---

# withDragDrop()

Known from `overview.md`:

- State shape sketch: `{ dragState }`.

**Flagged cross-cutting question raised in a prior session (not yet resolved):**
Does row drag-drop reordering require active sort to be cleared/disabled first (since dragging while sorted would immediately get re-sorted away), or does it silently no-op when a sort is active?

**Flagged cross-cutting question — `withDragDrop()` vs `withGrouping()` (not yet resolved):**
Dropping an ungrouped row onto a group's section assigns it that group. Dropping a row that
already belongs to one group onto a _different_ group must be configurable: an option to block
cross-group drag (the row cannot leave its group by drag), and an option to allow it (the drop
reassigns the row to the target group). Dragging an entire group (its header, i.e. every row in
it) onto another group is a separate, opt-in capability: enabling it bulk-reassigns every row in
the dragged group to the target group's value. Exact config shape (how many independent toggles,
their names, defaults) is undecided — flagged for the drilling session, not designed here.

**Design constraint:** `withDragDrop()` and `withGrouping()` must not know about each other —
neither reads the other's state or API directly. Same precedent as
[ADR-0017](../../adr/0017-engine-owned-descendant-prune.md), where grouping's direct read of
expansion's collapse state was replaced by an engine-owned mechanism (a contributed slot + an
engine-owned render stage) that mediates instead of one feature reading another's members.
Whatever plumbing the three behaviors above need — reading which group a row was dropped onto,
writing a row's grouped-field value, bulk-reassigning a dragged group's rows — must go through a
similar engine-owned mechanism. Non-negotiable even though the config shape above is still open.

To be drilled in a future session: full state shape, methods, `manual` contract (if applicable), compile-time dependencies, open questions.

## Competitive position

**Verdict: missing** — row reordering is absent and `moveRow` has no verb; same gap as TanStack, behind AG Grid and PrimeNG which both ship built-in drag reorder. **missing**, not "gap": the legend defines `gap` as present-but-weaker, and this is not present at all.

Full reasoning: [gap-analysis.md](../work/meta/archive/state-feature-competitive-audit/gap-analysis.md).
