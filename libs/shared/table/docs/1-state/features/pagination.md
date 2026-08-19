---
title: State Layer Reference — withPagination()
type: architecture
version: 0.1
date: 2026-07-19
status: not yet drilled
audience: developers
parent: ../1-state/architecture.md
---

# withPagination()

**Status: not yet drilled.**

Known from `overview.md`:
- State shape sketch: `{ pageIndex, pageSize, totalRows }`.
- Owns the `pageChanged` event.
- Mutually exclusive with `withInfiniteScroll()` in practice — a table shouldn't run both simultaneously.

**Flagged cross-cutting question raised in a prior session (not yet resolved):**
Is the `withPagination()` / `withInfiniteScroll()` conflict a hard compile-time restriction (TypeScript error if both registered) or just documented convention?

To be drilled in a future session: full state shape, methods, `manual` contract, compile-time dependencies, open questions.
