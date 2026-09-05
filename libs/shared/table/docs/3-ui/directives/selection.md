---
title: UI Layer — Selection (ngpTableSelectionCheckbox)
type: architecture
version: 0.1
date: 2026-07-20
capability: selection
spec: stub
code: none
audience: developers
---

# UI Layer — Selection (`ngpTableSelectionCheckbox`)

## Status

Not yet drilled. Placeholder reserved in the directive inventory (`3-ui/architecture.md`, `core.md`).

## Known Blocker

Per `1-state/architecture.md`'s cross-cutting open questions, `withSelection()`'s "select all" scope (all rows *currently visible* vs. *entire dataset including unfetched server rows*) is unresolved at the state layer. This directive's API and behavior depend directly on that answer — do not drill this file until the state-layer question is resolved.

## What's Known From Prior Sessions

- `withSelection()` exposes a single public API with internal single/multi composition (state layer, locked)
- Store owns `selectionChanged` events (per `overview.md`'s event ownership table)
