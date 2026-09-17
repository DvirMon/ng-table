# Decisions — NGP Table `withExpansion()`

Resolved during `/to-tasks` (2026-08-07), not covered by the existing spec/issue.

## Children access

**Decision:** `WithExpansionConfig<TRow>` gets `childrenAccessor?: (row: TRow) => TRow[] | undefined`, defaulting to a single contained cast reading `row.children`.

**Why:** `with-expansion.md`'s `Row.children?: Row[]` sketch assumes a concrete row shape; `TRow` here is generic. Reading `.children` off it directly means an unsafe cast at every call site. A configurable accessor keeps the public API type-safe (matches the `trackBy`/`accessor` precedent already used elsewhere in this store) while still defaulting to the common case with zero config.

## `manual` config

**Decision:** Not implemented. `withExpansion()` has no `manual` field, unlike `withSorting()`/`withFiltering()`/`withGrouping()`.

**Why:** `with-expansion.md`'s "manual Contract" section describes identical behavior for `manual: true` and the default — the store never fetches children in either mode, `toggleExpanded` always updates state immediately. There is no computation for `manual` to skip, so the flag would be config with no effect.
