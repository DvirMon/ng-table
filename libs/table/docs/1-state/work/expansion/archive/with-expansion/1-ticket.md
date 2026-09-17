# NGP Table — with-expansion feature

## Summary

Build the expansion/collapse state layer feature for NGP Table. This adds the ability to track per-row expanded/collapsed state and emit changes via a signal.

## Context

This is a state-layer feature plugin that extends `createTable()`. Follows the pattern established by with-sorting, with-selection, etc. UI layer bindings (expansion directive, controls) will be built separately.

## Rough scope

- `withExpansion()` factory function
- `TableExpanded` types and state shape
- `onExpand()` / `onCollapse()` / `toggleExpanded()` actions
- `expanded()` signal exposing current state
- Integration with `createTable()` store

## Spec

See `docs/1-state/features/expansion.md` for full spec.
