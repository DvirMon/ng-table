---
title: Verification — Services header exit/enter mechanism
type: verification
status: recorded
date: 2026-09-23
audience: developers
---

# Verification — bottom Services header exit/enter

Empirical check of the exit/enter behavior D2 in
[1-plan-grouping-moves.md](1-plan-grouping-moves.md) documents
as a known limitation. No code was changed — this is a
recorded observation only.

## Method

Storybook `grouping-editing` story, real Chrome via the
chrome-devtools MCP performance trace tools.

1. Mock ships 5 Services rows, not 1. Moved four
   (Tim Berners-Lee, Edsger Dijkstra, Linus Torvalds, Claude
   Shannon) to Hardware via a direct `<select>` value +
   `change` dispatch, so Grace Hopper became the sole Services
   row (browser session state only, not a source edit).
2. Started a performance trace (`reload: false`,
   `autoStop: false`).
3. In one `evaluate_script` call: attached a `MutationObserver`
   on `.story-host__table tbody` watching for the Services
   header `<tr>` (identified by its
   `.grouping-story__group-label` text) being added/removed,
   then toggled Grace Hopper's category to `""` (no category
   yet), waited 600ms, toggled back to `Services`, waited
   600ms.
4. Stopped the trace.

## Findings

- `t0`: select set to `""`.
- **+231ms**: the _original_ header `<tr>` node is removed
  from the DOM (`sameNodeAsInitial: true`), carrying classes
  `ngp-table-row--flip row-leave` at removal time. Matches
  `grouping-editing-flip.css`'s 200ms opacity/padding/
  border/font-size transition — `animate.leave` keeps the node
  mounted until the transition ends, then Angular tears it
  down.
- Header confirmed absent from the DOM 600ms after removal
  (genuinely gone, not just hidden).
- `t1`: select set back to `Services`.
- **+5.5ms**: a header `<tr>` reappears, but it is a **new DOM
  node** (`sameNodeAsInitial: false`), carrying `row-enter`,
  settling to `ngp-table-row--flip` by the next check.
- Chrome's trace reported CLS: 0.00 for the interaction, despite
  the documented snap of rows below the header once it's
  removed.

## Conclusion

Confirms D2's premise directly: the header's identity is
derived from the current category cluster set, not carried
across membership changes. When no row holds `category:
'Services'`, that header leaves `renderRows()` entirely; a
later row picking `Services` produces a fresh id.
`@for (... track row.id)` therefore does a full teardown
(`animate.leave`) + rebuild (`animate.enter`) for the header —
never a FLIP move, unlike the row itself. No new open question
raised beyond what D2 already lists.

## Artifacts

Raw trace JSON (~28MB) was written to this session's local
scratchpad, not the repo — regenerate with the same
`evaluate_script` if a fresh trace is needed; the JSON itself
adds nothing beyond the findings above.
