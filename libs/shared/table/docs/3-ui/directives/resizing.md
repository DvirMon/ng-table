---
title: UI Layer — Resizing (ngpTableResizable)
type: architecture
version: 0.1
date: 2026-07-20
capability: column-sizing
spec: stub
code: none
audience: developers
---

# UI Layer — Resizing (`ngpTableResizable`)

## Status

Not yet drilled. Placeholder reserved in the directive inventory (`3-ui/architecture.md`, `core.md`). No corresponding state-layer feature exists yet — `columns.md` already carries `width` as a directive-overridable presentation value, which this directive would extend to interactive/draggable resizing.

## Open Questions to Resolve When Drilled

- Does resizing persist to the store's column `width` default, or stay purely local/session-scoped per directive instance?
- Interaction with `ngpTableColumn`'s existing `[ngpColumnWidth]` override input — does resizing set that same input programmatically, or use a separate mechanism?
