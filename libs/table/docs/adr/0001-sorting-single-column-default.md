---
status: accepted
supersedes: "PRD #1 / issue #3 sorting decision (always-additive toggleSort)"
---

# Single-column sort is the default; multi-column accumulation is opt-in

PRD #1 (issue #3) originally specced `withSorting()`'s `toggleSort()` as always-additive: any column click adds or updates that column's rule in the sort-priority array, with no modifier key required. Post-ship feedback showed this surprises users expecting the common table convention — click a header, the sort resets to just that column. We reversed the default: `toggleSort()` now replaces the sort with the clicked column unless the consumer opts in via `withSorting({ multi: true })`, which restores the original accumulate-by-click-sequence behavior. See issue #8 for the implementation ticket.
