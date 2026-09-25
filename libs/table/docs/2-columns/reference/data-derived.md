---
title: Columns Schema — Data-Derived Columns (`createColumns(data, schemaFn)`)
type: architecture
version: 0.1
date: 2026-07-24
status: REJECTED 2026-07-31 — createColumns(data, schemaFn) API rejected; focus stays on the schema argument. Column-order open question below is moot.
audience: developers
parent: ../architecture.md
---

# Data-Derived Columns — `createColumns(data, schemaFn)`

**Rejected 2026-07-31.** A `createColumns(data, schemaFn)` overload deriving the column set from
row-data keys at runtime — never a dependency of the schema argument — was proposed and rejected;
full reasoning is in the hub: [`2-columns/architecture.md`](../architecture.md), "Data-derived
column set" bullet.

> Name collision, not the same proposal: the shipped `createColumns(data, build, schema?)` (an
> explicit builder as the second argument) is a later, unrelated design — see
> [columns.md](../decisions/columns.md). This page is about the rejected data-derivation overload
> only.
