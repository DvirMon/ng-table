---
title: Columns Schema — Data-Derived Columns (`createColumns(data, schemaFn)`)
type: architecture
version: 0.1
date: 2026-07-24
status: REJECTED 2026-07-31 — createColumns(data, schemaFn) API rejected; focus stays on columnsSchema function. Column-order open question below is moot.
audience: developers
parent: ../architecture.md
---

# Data-Derived Columns — `createColumns(data, schemaFn)`

**Rejected 2026-07-31.** A `createColumns(data, schemaFn)` overload deriving the column set from
row-data keys at runtime — never a dependency of `columnsSchema` — was proposed and rejected;
full reasoning is in the hub: [`2-columns/architecture.md`](../architecture.md), "Data-derived
column set" bullet.
