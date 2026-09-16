---
title: State Layer Reference — withPagination()
type: architecture
version: 0.1
date: 2026-07-19
capability: pagination
spec: stub
code: none
audience: developers
parent: ../architecture.md
---

# withPagination()

Known from `overview.md`:
- State shape sketch: `{ pageIndex, pageSize, totalRows }`.
- Owns the `pageChanged` event.
- Mutually exclusive with `withInfiniteScroll()` in practice — a table shouldn't run both simultaneously.

**Flagged cross-cutting question raised in a prior session (not yet resolved):**
Is the `withPagination()` / `withInfiniteScroll()` conflict a hard compile-time restriction (TypeScript error if both registered) or just documented convention?

To be drilled in a future session: full state shape, methods, `manual` contract, compile-time dependencies, open questions.

## Competitive position

**Verdict: missing** — a stub, so the design is not settled either, unlike filtering/grouping which are spec-complete; `RENDER_ORDER` reserves a `'paginate'` slot and nothing claims it, while all four competitors ship pagination in their free/core tier.

Full reasoning: [gap-analysis.md](../work/state-feature-competitive-audit/gap-analysis.md).
