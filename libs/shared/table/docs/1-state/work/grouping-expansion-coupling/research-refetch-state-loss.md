# Research relocated from 0-product/grouping.md (D7, trim-docs #80)

Competitive citations for story 2.4 ("Keep my place while scrolling a long group" /
expand-state-survives-refetch), previously inline in the story's Design status field.

**Eleven years old and unresolved across four libraries:** ag-grid
[#600](https://github.com/ag-grid/ag-grid/issues/600) (2015 — live data every 10s, expansion
lost), mui-x [#13962](https://github.com/mui/mui-x/issues/13962) (2024), mui-x
[#21398](https://github.com/mui/mui-x/issues/21398) (open, 2026 — sort model change + refetch
loses expansion), primeng [#19398](https://github.com/primefaces/primeng/issues/19398) (open,
groups don't even open on first paint). TanStack is the live outlier: `autoResetExpanded`
defaults to on, so any refetch re-collapses the table. AG Grid solved the client-side half and
made discarding state an explicit call.

Half-restored is specifically worse than reset — mui-x
[#16495](https://github.com/mui/mui-x/issues/16495) (open): the expand icon stays but the panel
content isn't visible.

**This library is unusually well placed, and it appears to be luck, not design.**
`expandedRows` already holds synthetic `group:${columnId}:${value}` ids alongside real row ids,
and ADR-0006 pruning deliberately never prunes them (`expansion.md:76`, `:270`) — a group whose
id is stable across a refetch keeps its state for free. What's undecided is whether that id is
stable: it's derived from the column id and value, so it survives a refetch but not a change to
the grouping. No decision states this, and nothing tests it — raised as OQ-4.
