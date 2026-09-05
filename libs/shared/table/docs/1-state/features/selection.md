---
title: State Layer Reference — withSelection()
type: architecture
version: 0.1
date: 2026-07-19
capability: selection
spec: stub
code: none
audience: developers
parent: ../architecture.md
---

# withSelection()

Known from `overview.md`:
- Single public feature, with internal `withSingleSelection` / `withMultiSelection` composition (implementation detail, not exposed to consumers).
- State shape sketch: `{ selection: Record<id, boolean>, mode: 'single' | 'multi' }`.
- Owns the `selectionChanged` event.

**Flagged cross-cutting question raised in a prior session (not yet resolved):**
Does "select all" mean all rows *currently visible* (post-filter, current page) or *all rows in the entire dataset* (including other pages / unfetched server rows)? This affects whether `withSelection()` needs a runtime or compile-time dependency on `withPagination()` / `withFiltering()`.

To be drilled in a future session: full state shape, methods, `manual` contract (if applicable — selection may not need one, TBD), compile-time dependencies, open questions.

## Competitive position

**Verdict: missing** — the single biggest baseline gap: all four competitors ship row selection in core, and it is the audit's #1-ranked developer pain point; decide selection scope (page / filtered / all) deliberately on day one, because nobody else has done it cleanly — a chance to lead rather than inherit the ambiguity.

Assessed 2026-09-05 against TanStack Table v8, AG Grid, Material React Table,
and PrimeNG. Full reasoning: [gap-analysis.md](../work/state-feature-competitive-audit/gap-analysis.md).
