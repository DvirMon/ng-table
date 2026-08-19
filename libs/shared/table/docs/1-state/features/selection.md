---
title: State Layer Reference — withSelection()
type: architecture
version: 0.1
date: 2026-07-19
status: not yet drilled
audience: developers
parent: ../1-state/architecture.md
---

# withSelection()

**Status: not yet drilled.**

Known from `overview.md`:
- Single public feature, with internal `withSingleSelection` / `withMultiSelection` composition (implementation detail, not exposed to consumers).
- State shape sketch: `{ selection: Record<id, boolean>, mode: 'single' | 'multi' }`.
- Owns the `selectionChanged` event.

**Flagged cross-cutting question raised in a prior session (not yet resolved):**
Does "select all" mean all rows *currently visible* (post-filter, current page) or *all rows in the entire dataset* (including other pages / unfetched server rows)? This affects whether `withSelection()` needs a runtime or compile-time dependency on `withPagination()` / `withFiltering()`.

To be drilled in a future session: full state shape, methods, `manual` contract (if applicable — selection may not need one, TBD), compile-time dependencies, open questions.
