---
title: State Layer Reference — withInfiniteScroll()
type: architecture
version: 0.1
date: 2026-07-19
capability: infinite-scroll
spec: stub
code: none
audience: developers
parent: ../architecture.md
---

# withInfiniteScroll()

Known from `overview.md`:
- State shape sketch: `{ hasMore, isLoading }`.
- Mutually exclusive with `withPagination()` in practice.

To be drilled in a future session: full state shape, methods, `manual` contract, compile-time dependencies, open questions.

## Competitive position

**Verdict: not assessed** — the audit was deliberately scoped to the state layer, and the competitors' incremental-scroll loading sits in their rendering/virtualization surface, so it produced no findings here; the silence is that scoping decision, not an oversight.

Full reasoning: [gap-analysis.md](../work/meta/archive/state-feature-competitive-audit/gap-analysis.md).
