---
title: UI Layer — Drag & Drop (ngpTableDragHandle)
type: architecture
version: 0.1
date: 2026-09-23
capability: drag-drop
spec: stub
code: none
audience: developers
---

# UI Layer — Drag & Drop (`ngpTableDragHandle`)

## Status

Not yet drilled. Placeholder reserved in the directive inventory (`3-ui/architecture.md`, `core.md`).

## Known Blocker

Per `1-state/architecture.md`'s cross-cutting open questions: does drag-reorder require sort to be cleared, or does it no-op silently while a sort is active? This directive's interaction model depends on that answer.

Also open (same section): `withDragDrop()` vs `withGrouping()` — dropping an ungrouped row onto a group assigns it that group; cross-group drag needs a configurable block/allow; dragging a whole group onto another (bulk-reassigning its rows) is a separate opt-in. Config shape undecided.

## What's Known From Prior Sessions

- `withDragDrop()` state shape: `{ dragState }` (state layer, not yet fully drilled)
- Store owns no drag-specific event in the current event-ownership table beyond generic data events; `dragStarted`/`dragDropped` are directive-owned (UI layer), per `overview.md`'s event ownership table.
- UI-layer implication of the grouping question above: at drop time the directive needs some way to read which group section a row was dropped into/onto — not yet designed. Per [ADR-0017](../../adr/0017-engine-owned-descendant-prune.md)'s decoupling precedent, that read must go through an engine-owned mechanism, not a direct import of/reference to `withGrouping()`'s directive or API.
