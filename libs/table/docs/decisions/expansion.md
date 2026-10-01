---
title: Expansion — decision history
type: decisions-log
capability: expansion
date: 2026-09-20
audience: developers
---

# Expansion — decision history

**Read this before changing anything about expansion.** It is the complete
list of decisions taken about this capability, one line each, oldest first.
The contract itself — what the panel does today — is
[`1-state/features/expansion.md`](../1-state/features/expansion.md).

**Tree has its own log since 2026-09-27: [`tree.md`](tree.md).** Until then
this log covered both the panel and the tree-grid. Its tree-only rows (E5, E6,
E9, E13, E15, E16, E20–E38) stay here unchanged so existing references
resolve; each is carried into the tree log as a `TR`-row with its `E`-number
in **Record**. New tree decisions land there only. This log keeps the shared
open-id store (`createExpansionStore()`, E8, E10, E11, E14, E17, E18),
collapsible grouping's composition rule (E12), and the panel.

This log **restates nothing**. Every row links to the record that holds the
rationale, the counter-arguments and the rejected alternatives. If a row needs
a second line, that second line belongs in the linked record.

**Numbering is this log's own (`E1…En`) and is never reused from a source
folder.** Source `D`-numbers are preserved in the last column so older
cross-references still resolve.

## Source keys

| Key | Record |
|---|---|
| **WE** | [`archive/with-expansion/2-decisions.md`](../1-state/work/expansion/archive/with-expansion/2-decisions.md) — the foundational `/to-tasks` pass |
| **AUD** | [`archive/with-expansion/expansion-state-audit.md`](../1-state/work/expansion/archive/with-expansion/expansion-state-audit.md) — the cross-library bulk-verb audit |
| **PTS** | [`active/panel-tree-split/1-decisions.md`](../1-state/work/expansion/active/panel-tree-split/1-decisions.md) — #101, the ADR-0012 split |
| **PTS spec** | [`active/panel-tree-split/2-spec.md`](../1-state/work/expansion/active/panel-tree-split/2-spec.md) — the written contract for #101 |
| **PTS discovery** | [`active/panel-tree-split/discovery-emission-shape.md`](../1-state/work/expansion/active/panel-tree-split/discovery-emission-shape.md) — cross-library expand/collapse emission-shape survey, #124 |
| **TFD** | [`work/tree/active/tree-flat-data/1-decisions.md`](../1-state/work/tree/active/tree-flat-data/1-decisions.md) — #163, tree from flat data |
| **TFD arch** | [`work/tree/active/tree-flat-data/3-architecture.md`](../1-state/work/tree/active/tree-flat-data/3-architecture.md) — #163 architecture |

## Decisions

| | Decision | Date | Status | Record |
|---|---|---|---|---|
| E1 | `childrenAccessor` is a configurable accessor defaulting to `row.children`, not a cast | 08-07 | shipped · default dropped by E6 · superseded by E20 | WE |
| E2 | No `manual` config — it would toggle no behavior | 08-07 | standing | WE |
| E3 | `expandAll`/`collapseAll` emit `rowExpanded` once per affected id; no separate bulk event | 09-06 | shipped · `withExpansion()`'s public surface stayed E3-shaped via an adapter over E18 until #121 landed; superseded by E19 | AUD |
| E4 | Stale restored ids are kept, not dropped — staleness is caller-owned (selection D8 verbatim) | 09-08 | standing | AUD |
| E5 | `withTree()` accepts real-row parents only — every tree node is an entry in the flat `data()`; no `getDataPath`, since invented parents are `withGrouping()`'s mechanism | 09-20 | shipped in `with-tree.ts` (#119) | PTS D1 |
| E6 | `childrenAccessor` is required on `withTree()`; the `row.children` fallback is dropped, which closes G6 as impossible rather than fixed | 09-20 | shipped in `with-tree.ts` (#119) · required half amended by E13 · superseded by E20 | PTS D2 |
| E7 | `everExpanded` is panel-only — the shared store stops at open-id machinery, `withExpansion()` adds it on top | 09-20 | shipped in `with-expansion.ts` (#121) | PTS D3 |
| E8 | `setExpanded(ids)` is the store's general write; `expandAll(ids)`/`collapseAll()` are removed as store verbs, and `withTree()` keeps `expandAll()` for the discovery walk only | 09-20 | shipped · amended by E11 | PTS D4 |
| E9 | `expansionState` tri-state is a `withTree()` member and ships with it; the panel side computes the equivalent in one line | 09-20 | shipped in `with-tree.ts` (#119) | PTS D5 |
| E10 | Both features ship as ADR-0015 slices (`table.expansion`, `table.tree`) inside #101, rather than flat prefixed members superseded by #50 | 09-20 | shipped — `with-tree.ts` (#119) and `with-expansion.ts` (#121) | PTS D6 |
| E11 | `setExpanded` is internal; the public surface is `toggle`/`expand`/`collapse`/`set`, with an omitted `ids` meaning all — `expandAll`/`collapseAll` disappear as names | 09-20 | shipped | PTS D7 |
| E12 | `withGrouping()` is static; collapsible group headers come from composing `withTree()`, and `withExpansion()` contributes nothing to render visibility — reverses ADR-0012 Decision 5 and closes the union collision | 09-20 | shipped in `with-expansion.ts` (#121) | PTS D8 |
| E13 | `childrenAccessor` is optional with no fallback — omitted means collapse-only, and `withTree()` claims the `'tree'` stage only when an accessor is given | 09-20 | shipped in `with-tree.ts` (#119) · superseded by E20 | PTS D9 |
| E14 | `initial` ships with the split, seeded in `createExpansionStore()` | 09-20 | shipped | PTS D10 |
| E15 | `withTree()` has no declared levels and never gains them — a declared-axis hierarchy is `withGrouping()`; `isExpandable` is the only row-selection knob | 09-20 | standing · shipped in `with-tree.ts` (#119) | PTS D11 |
| E16 | A throwing `childrenAccessor` degrades to "no children" and reports once per evaluation (ADR-0014), never propagates | 09-20 | shipped in `with-tree.ts` (#119) — the panel has no `childrenAccessor` to degrade | PTS D12 |
| E17 | One emission rule for every write: once per id in the symmetric difference of the old and new open sets — generalizes E3 across `toggle`/`expand`/`collapse`/`set` | 09-20 | superseded by E18 | PTS spec |
| E18 | `changed` emits once per write, not once per id — payload is the full symmetric difference as `{ added, removed }` (`ExpansionChange`), matching `SelectionChange`. Resolves #124: 8/8 surveyed libraries (AG Grid, TanStack, MUI X, rc-table, PrimeReact, PrimeNG, Angular CDK) emit at most one event per batch action; CDK's `SelectionModel.changed` is the direct precedent | 09-20 | shipped in `createExpansionStore()`, landed ahead of #119 after #118 closed without it | PTS discovery |
| E19 | `table.expansion.changed` exposes `ExpansionChange` directly — no per-id adapter. Matches `table.tree.changed` and `SelectionChange`; the `mergeMap`-to-`RowId` shim that preserved E3's contract is dropped, absorbed into the one breaking change #121 already causes (D6/E10) | 09-21 | shipped in `with-expansion.ts` (#121) | PTS spec |
| E20 | `childrenAccessor` is replaced by `parentId: (row) => RowId \| null \| undefined` — the tree nests flat `data()` rows by parent id; `null`/`undefined` is a root; omitted stays collapse-only (E13) | 09-27 | decided (#163) | TFD D1 |
| E21 | `childrenAccessor` is removed outright — no deprecation window, no exported flatten helper; nested-to-flat conversion is consumer data prep, shown as a doc snippet | 09-27 | decided (#163) | TFD D3 |
| E22 | A broken parent link — throwing `parentId`, self-parent, cycle, or a parent id absent from `data()` — degrades the row to root with its subtree intact, reported once per evaluation (ADR-0014); never hidden | 09-27 | decided (#163) | TFD D4 |
| E23 | Filtering a tree keeps matches plus their ancestors as context; boolean `includeDescendants` also keeps a matched row's descendants. Filtering never orphans a row | 09-27 | decided (#163) | TFD D5 |
| E24 | `withTree()` contributes a parent-link engine slot; the `filter` stage reads it to keep ancestors — no feature reads another's state; `includeDescendants` lives on `withFiltering()` | 09-27 | decided (#163) · [ADR-0028](../adr/0028-tree-parent-link-slot.md) | TFD D6 |
| E25 | `tree.expand()` (no ids) and `tree.state` scan the filtered view by default; boolean `includeHidden` scans all of `data()` — same shape as `selectAllIds()` | 09-27 | decided (#163) | TFD D8 |
| E26 | Default `hasChildren` counts children in the filtered view — a parent whose children are all filtered out renders no toggle; `isExpandable` still overrides | 09-27 | decided (#163) | TFD D9 |
| E27 | Every tree node counts as a row — `totalRowCount` and `selectAllIds()` include children, collapsed or not; only filtered-out rows are excluded | 09-27 | decided (#163) | TFD D11 |
| E28 | `table.tree.descendantsOf(id)` is a read-only query; removing a parent never cascades — a consumer composes `removeRows([id, ...descendantsOf(id)])`, leftover children degrade to root (E22) | 09-27 | decided (#163) | TFD D12 |
| E29 | Grouping with a `parentId` tree groups roots only; subtrees follow their root, never split by descendants' own values. Flat grouping = omit `parentId` | 09-27 | decided (#163) · [ADR-0028](../adr/0028-tree-parent-link-slot.md) | TFD D13 |
| E30 | A group header's row count includes every node in the group, descendants too — matches `totalRowCount` and group select-all | 09-27 | decided (#163) | TFD D14 |
| E31 | Group `aggregateFn` receives every node in the group, descendants included; roll-up vs own-value parents is the consumer's call inside `aggregateFn` — no new mechanism | 09-27 | decided (#163) | TFD D15 |
| E32 | While a filter is active, context rows render expanded — a visibility rule only; the open set is not written, `changed` does not fire, and clearing the filter restores the person's own state | 09-27 | decided (#163) · superseded by E35 | TFD D16 |
| E33 | Toggling a revealed context row collapses it via a per-filter collapsed set, separate from the open set; the set resets when the filter changes or clears | 09-27 | decided (#163) · superseded by E35 | TFD D17 |
| E34 | `RenderRow.isContextRow` flags a context row; `ngpTableRow` exposes it as presence attribute `data-context-row` (ADR-0026 rule 1) — styling is the consumer's | 09-27 | decided (#163) · directive amended by E36 | TFD D18 |
| E35 | Filter reveal is a derived visibility source (never writes the open set); `revealContextRow` row predicate on `withTree()` picks which context rows reveal (default all, `() => false` off); a closed revealed row is remembered only while it stays a context row; `table.tree` exposes `contextRowIds()`, `parentOf()`, `descendantsOf()` — every library-only fact is readable, every policy can be switched off | 09-27 | decided (#163) | TFD D20 |
| E36 | `data-context-row` is bound by a new `ngpTableTreeRow` feature directive, not core `ngpTableRow` (optional field → feature directive); wider tree UI is a separate issue | 09-27 | decided (#163) | TFD D21 |
| E37 | Context-row ids are an accumulating engine slot contributed by `withFiltering()` (the only feature that knows what matched); core stamps `RenderRow.isContextRow` and `withTree()` reads it for reveal — no feature reads another's state | 09-27 | decided (#163) · [ADR-0028](../adr/0028-tree-parent-link-slot.md) | TFD arch A2 |
| E38 | A second `parentLink` claim throws with `ngDevMode` off too, same as a member clash — an unchecked duplicate silently nests every row by whichever feature folded last, with no visible failure | 09-27 | decided (#166) · [ADR-0028](../adr/0028-tree-parent-link-slot.md) | #166 step 2 |
| E39 | `table.expansion.release(ids?)` — removes ids from `everExpanded` (none = clear), never touches the open set, emits nothing; the one explicit remover, row removal still doesn't prune it | 10-01 | specced, not shipped (#195) | [`0-product/expansion.md`](../0-product/expansion.md) OQ-exp-8 part 2 |
| E40 | Default panel recipe unmounts on close (gate `expansion()`, `animate.leave`); keep-mounted is a per-row consumer opt-in (`keepMounted(row) && everExpanded()`). Replaces E7's keep-mounted default — its "animation fights teardown" reason predates `animate.leave` | 10-01 | decided (#195) | [`0-product/expansion.md`](../0-product/expansion.md) OQ-exp-8 part 1 |
| E41 | The library ships panel a11y directives: a toggle on the consumer's `<button>` (`aria-expanded` + `aria-controls`) and a panel-content directive (`id`, `inert` while not open incl. mid-leave, focus return on close); mount stays the consumer's `@if` | 10-01 | decided (#195) · UI spec rewrite owed | [`0-product/expansion.md`](../0-product/expansion.md) OQ-exp-8 part 3 |
| E42 | Keep E12 — the panel stays consumer markup, not a render row (reversing it reopens ADR-0012's `expandedRows` collision; fixed `itemSize` still can't size panels). Virtualization becomes a virtual-scroll requirement: must support detail panels | 10-01 | decided (#195) | [`0-product/expansion.md`](../0-product/expansion.md) OQ-exp-8 part 4 |
| E43 | Row-to-row stepping (next/previous row while detail is open) is keyboard navigation owned by the core row/table directives (ADR-0029 cat. 5) — next visible data row, skip group headers, stop at end; panel and tree plug in. Not a consumer helper or expansion option | 10-01 | decided · #201 | [`0-product/expansion.md`](../0-product/expansion.md) OQ-exp-9 |
| E44 | Panel toggle and panel link through a table-scoped registry provided by `ngpTable`, keyed by `RowId`: the panel registers on mount, the registry mints DOM ids, the toggle binds `aria-controls` only while its panel is mounted, the panel reaches its toggle for focus return | 10-01 | decided (#199) | [panel-directives D1](../3-ui/work/expansion/active/panel-directives/1-decisions.md) |
| E45 | Panel directives are named `ngpTablePanelToggle` + `ngpTablePanel` — not `Expansion*`, which reads as tree expansion next to `ngpTableTreeToggle` | 10-01 | decided (#199) | [panel-directives D2](../3-ui/work/expansion/active/panel-directives/1-decisions.md) |
| E46 | `ngpTablePanel` takes a `RowId` (`[ngpTablePanel]="row.id"`), not a `RenderRow` — works for an inline panel and for a side panel holding only an id | 10-01 | decided (#199) | [panel-directives D3](../3-ui/work/expansion/active/panel-directives/1-decisions.md) |
| E47 | `ngpTablePanel` binds `id`/`inert` by host binding; a leaving panel gets `inert` from one `Renderer2.setAttribute` in `DestroyRef.onDestroy` (after focus return) — Angular 22 destroys the `@if` view before its bindings refresh, so no binding reaches it (source-verified, pinned by a spec test) | 10-01 | decided (#199) | [panel-directives D4](../3-ui/work/expansion/active/panel-directives/1-decisions.md) |
| E48 | Panel focus return targets only a live toggle; a row that disappears with focus inside (delete, filter) is core row-nav's focus job (#201), not the panel's | 10-01 | decided (#199) | [panel-directives D5](../3-ui/work/expansion/active/panel-directives/1-decisions.md) |
| E49 | Esc closes a panel through a `(keydown.escape)` host listener on `ngpTablePanel` (`collapse([id])`, then focus return); skipped when `event.defaultPrevented`, which is also the opt-out — no input | 10-01 | decided (#199) | [panel-directives D6](../3-ui/work/expansion/active/panel-directives/1-decisions.md) |
| E50 | A kept-mounted closed panel uses `inert`; `hidden="until-found"` + `beforematch` is an additive kept-mounted feature left to #209 — it can't replace `inert` during the exit animation | 10-01 | decided (#199) | [panel-directives D7](../3-ui/work/expansion/active/panel-directives/1-decisions.md) |
| E51 | Panel focus return runs from owned close paths — a public `close()` (`exportAs: 'ngpTablePanel'`, also used by Esc and the in-panel ×) and `onDestroy` (strictly-inside check) — never an effect; an external close of a kept-mounted panel is not covered (CDK Menu precedent) | 10-01 | decided (#199) | [panel-directives D8](../3-ui/work/expansion/active/panel-directives/1-decisions.md) |
| E52 | Panel directives throw in dev mode without `withExpansion()` and on a second panel mounted for one `RowId`; a nameless toggle warns | 10-01 | decided (#199) · warning superseded by E55 | [panel-directives D9](../3-ui/work/expansion/active/panel-directives/1-decisions.md) |
| E53 | `ngpTablePanelToggle` handles the click (`toggle(id)`), no outputs — same as the tree toggle | 10-01 | decided (#199) | [panel-directives D10](../3-ui/work/expansion/active/panel-directives/1-decisions.md) |
| E54 | Single-open becomes state: `withExpansion({ multi?: boolean \| (() => boolean) })`, default `true`, `withRowEdit`'s rule (in single mode a write keeps the last row; a live switch to single closes all). Reverses OQ-exp-1's recipe, since the directive now owns the click and runs first | 10-01 | decided · [#210](https://github.com/DvirMon/ng-table/issues/210) | [panel-directives D10](../3-ui/work/expansion/active/panel-directives/1-decisions.md) |
| E55 | Panel toggle accessible name is consumer-owned: no label input, no default, no dev warning — the library binds relations only. Amends ADR-0029 #3; tree's TR39 warning goes to #209 | 10-01 | decided (#199) · [ADR-0029](../adr/0029-directives-own-accessibility.md) | [panel-directives D11](../3-ui/work/expansion/active/panel-directives/1-decisions.md) |
| E56 | A panel's DOM id is a per-table prefix plus the escaped `RowId` — stable across remounts and server/client hydration; not a mount counter | 10-01 | decided (#199) | [panel-directives D13](../3-ui/work/expansion/active/panel-directives/1-decisions.md) |
| E57 | v1 panel directives support a panel inside the `ngpTable` host only; a panel outside it (a page-level side drawer) can't reach the registry or store through DI — open, not decided | 10-01 | specced (#199) | [panel-directives spec](../3-ui/work/expansion/active/panel-directives/2-spec.md) |

## Still open

- **E5 follow-on** — variable-depth grouping (a path-derived level source) is
  filed against grouping, not expansion, if a consumer ever needs it.
- ~~**`state()` on a collapse-only `withTree()`** reads `'none'`~~ — moved to
  [`tree.md`](tree.md#still-open) with the tree split.
- ~~**`ReadonlySet<RowId>` narrowing** on both slices (today `Signal<Set<RowId>>`)
  — aligns with `withSelection()`, confirm at slicing time.~~ — resolved: both
  `ExpansionSlice` and `TreeSlice` call signatures return `ReadonlySet<RowId>`
  as shipped (#119, #121).
- ~~E3/E17's per-id emission reconsidered against `SelectionChange`~~ —
  resolved by E18. [#124](https://github.com/DvirMon/ng-table/issues/124) is
  folded into #118's store shape rather than a separate migration, since
  `createExpansionStore()` has not shipped yet.
- ~~Does `withExpansion()` expose `ExpansionChange` directly once #121
  narrows it, or keep adapting back to per-id `RowId`?~~ — resolved by E19:
  exposes it directly, no adapter.

## Maintaining this log

1. **Register before archiving.** A decision is registered here *before* its
   work folder moves to `archive/`.
2. **Own numbering, one prefix (`E`).** Never reuse a source folder's
   `D`-number as the row id; keep it in **Record** so older references resolve.
3. **Never renumber, never reuse.** Append with the next free number.
4. **Supersede forward, never delete.** A reversed decision keeps its row; its
   **Status** cell names the row that replaced it.
