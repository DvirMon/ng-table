---
title: State Layer Reference — withDragDrop()
type: architecture
version: 0.1
date: 2026-07-19
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

To be drilled in a future session: full state shape, methods, `manual` contract (if applicable), compile-time dependencies, open questions.

## Competitive position

**Verdict: missing** — row reordering is absent and `moveRow` has no verb; same gap as TanStack, behind AG Grid and PrimeNG which both ship built-in drag reorder. **missing**, not "gap": the legend defines `gap` as present-but-weaker, and this is not present at all.

Full reasoning: [gap-analysis.md](../work/state-feature-competitive-audit/gap-analysis.md).
