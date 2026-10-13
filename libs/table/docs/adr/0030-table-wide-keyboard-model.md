# Table-wide keyboard model — grid/treegrid roles, roving focus, store-held focused position

The table's host role is fixed at construction: `treegrid` when `withTree()` is composed, `grid` otherwise. APG keyboard navigation is owned by the directives: `grid` uses cell focus, `treegrid` focuses rows and cells, via roving tabindex with one-time entry landing on the first data row. The table store holds the always-present `{ rowId, columnId } | null` focused position (settable by consumers), kept valid by the engine when rows are removed, hidden, or moved; focus recovery is dom-side-effect-only. In `treegrid`, the tree toggle becomes pointer-only while the tree row owns `aria-expanded` and `aria-level`. Consumer key handlers win on any prevented event, and feature keys plug into core navigation.

## Status

accepted (2026-10-13); related to ADR-0029, ADR-0006, ADR-0005, ADR-0026; issues #196, #201.

## Alternatives considered

- Role switched at runtime — APG needs none; flipping resets screen-reader context.
- Static tables kept as `role="table"` — would amend ADR-0029, requiring an "interactive" rule.
- Row-only focus — APG patterns forbid it.
- Cell-only in `treegrid` — breaks →/← expand/collapse.
- Focus held in directive exportAs, recovered per-view — no path for virtualization or side panels following focus.
- Opt-in `withKeyboardNav()` — ADR-0029 forbids optional accessibility.
- Tree toggle as full control — two controls announce one state; breaks single attribute ownership.

## Consequences

- Static tables lose screen-reader browse-mode reading.
- One core store member on every table, including those rendered without directives.
- Directive docs (`tree.md`, `core.md`) change to show row `aria-expanded`/`aria-level` under `treegrid`; toggle pointer-only.
- Expansion doc replaces "the next Tab lands inside the panel" with "an open panel is an arrow stop, entered with Enter/F2".
