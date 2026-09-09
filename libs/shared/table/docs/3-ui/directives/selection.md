---
title: UI Layer — Selection (ngpTableSelectionCheckbox)
type: architecture
version: 0.2
date: 2026-09-09
capability: selection
spec: stub
code: none
audience: developers
---

# UI Layer — Selection (`ngpTableSelectionCheckbox`)

## Status

Not yet drilled. Placeholder reserved in the directive inventory (`3-ui/architecture.md`, `core.md`).
State layer unblocked — `withSelection()` shipped, spec at
[`1-state/work/with-selection/3-spec.md`](../../1-state/work/with-selection/3-spec.md). This file
is free to be drilled.

## What's Known From The State Layer

- `withSelection()`'s "select all" scope question is resolved (D1): there is no scope concept.
  Every write names the ids it applies to — a header "select all" checkbox takes the id set as an
  input (`[ngpTableSelectAllFor]="table.rows()"`) rather than the directive inferring one.
- `enableMultiRowSelection` (table-wide or per-row) governs single- vs. multi-select — not stored
  mode state, so this directive layer has nothing to configure for it beyond what `withSelection()`
  already exposes.
- The shipped checkbox directive targets native `<input type="checkbox">` only (D6). Component
  checkbox hosts (Angular Material, a consumer's own DS wrapper) are **not** auto-wired — an
  attribute directive's host bindings can't reach a sibling component's inputs, and Angular's own
  bridging mechanism for that is private API. What ships instead is a documented recipe: the
  consumer authors a thin directive on their own component, injecting the component instance by
  type plus the existing public `NGP_TABLE_ROW`/`NGP_TABLE_STORE` tokens.
- Store owns `selectionChanged` events (per `overview.md`'s event ownership table) — a delta
  (`added`/`removed`), read `table.selectedRows()` for current state.
