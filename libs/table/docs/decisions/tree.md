---
title: Tree — decision history
type: decisions-log
capability: tree
date: 2026-09-27
audience: developers
---

# Tree — decision history

**Read this before changing anything about `withTree()`.** It is the complete
list of decisions taken about the tree-grid, one line each, oldest first. The
contract itself — what `withTree()` does today — is
[`1-state/features/tree.md`](../1-state/features/tree.md).

**Split out of [`expansion.md`](expansion.md) on 2026-09-27.** Tree decisions
were logged there as `E`-rows while the panel and the tree shared one
capability. Every tree-only `E`-row is carried here under its own `TR`-number,
with the `E`-number kept in **Record** so existing references resolve. The
expansion log keeps its rows unchanged (never delete). New tree decisions land
here only.

Decisions about the shared open-id store both features build on —
`createExpansionStore()`, its write verbs and its `changed` emission (E8, E10,
E11, E14, E17, E18) — and collapsible grouping's composition rule (E12) stay in
the expansion log.

This log **restates nothing**. Every row links to the record that holds the
rationale, the counter-arguments and the rejected alternatives. If a row needs
a second line, that second line belongs in the linked record.

**Numbering is this log's own (`TR1…TRn`) and is never reused from a source
folder or from the expansion log.** Source numbers are preserved in the last
column.

## Source keys

| Key | Record |
|---|---|
| **E** | [`expansion.md`](expansion.md) — the row's number in the expansion log, where it was first registered |
| **PTS** | [`work/expansion/active/panel-tree-split/1-decisions.md`](../1-state/work/expansion/active/panel-tree-split/1-decisions.md) — #101, the ADR-0012 split |
| **TFD** | [`work/tree/active/tree-flat-data/1-decisions.md`](../1-state/work/tree/active/tree-flat-data/1-decisions.md) — #163, tree from flat data |
| **#166 step 2** | [`work/tree/active/tree-flat-data/4-tasks/issue-166/step-2-parent-link-slot.plan.md`](../1-state/work/tree/active/tree-flat-data/4-tasks/issue-166/step-2-parent-link-slot.plan.md) — the `parentLink` slot claim |
| **TFD arch** | [`work/tree/active/tree-flat-data/3-architecture.md`](../1-state/work/tree/active/tree-flat-data/3-architecture.md) — #163 architecture |

## Decisions

| | Decision | Date | Status | Record |
|---|---|---|---|---|
| TR1 | `withTree()` accepts real-row parents only — every tree node is an entry in the flat `data()`; no `getDataPath`, since invented parents are `withGrouping()`'s mechanism | 09-20 | shipped in `with-tree.ts` (#119) | E5 · PTS D1 |
| TR2 | `childrenAccessor` is required on `withTree()`; the `row.children` fallback is dropped, which closes G6 as impossible rather than fixed | 09-20 | shipped in `with-tree.ts` (#119) · required half amended by TR4 · superseded by TR7 | E6 · PTS D2 |
| TR3 | `expansionState` tri-state is a `withTree()` member and ships with it; the panel side computes the equivalent in one line | 09-20 | shipped in `with-tree.ts` (#119) | E9 · PTS D5 |
| TR4 | `childrenAccessor` is optional with no fallback — omitted means collapse-only, and `withTree()` claims the `'tree'` stage only when an accessor is given | 09-20 | shipped in `with-tree.ts` (#119) · superseded by TR7 | E13 · PTS D9 |
| TR5 | `withTree()` has no declared levels and never gains them — a declared-axis hierarchy is `withGrouping()`; `isExpandable` is the only row-selection knob | 09-20 | standing · shipped in `with-tree.ts` (#119) | E15 · PTS D11 |
| TR6 | A throwing `childrenAccessor` degrades to "no children" and reports once per evaluation (ADR-0014), never propagates | 09-20 | shipped in `with-tree.ts` (#119) — the panel has no `childrenAccessor` to degrade | E16 · PTS D12 |
| TR7 | `childrenAccessor` is replaced by `parentId: (row) => RowId \| null \| undefined` — the tree nests flat `data()` rows by parent id; `null`/`undefined` is a root; omitted stays collapse-only (TR4) | 09-27 | decided (#163) | E20 · TFD D1 |
| TR8 | `childrenAccessor` is removed outright — no deprecation window, no exported flatten helper; nested-to-flat conversion is consumer data prep, shown as a doc snippet | 09-27 | decided (#163) | E21 · TFD D3 |
| TR9 | A broken parent link — throwing `parentId`, self-parent, cycle, or a parent id absent from `data()` — degrades the row to root with its subtree intact, reported once per evaluation (ADR-0014); never hidden | 09-27 | decided (#163) | E22 · TFD D4 |
| TR10 | Filtering a tree keeps matches plus their ancestors as context; boolean `includeDescendants` also keeps a matched row's descendants. Filtering never orphans a row | 09-27 | decided (#163) | E23 · TFD D5 |
| TR11 | `withTree()` contributes a parent-link engine slot; the `filter` stage reads it to keep ancestors — no feature reads another's state; `includeDescendants` lives on `withFiltering()` | 09-27 | decided (#163) · [ADR-0028](../adr/0028-tree-parent-link-slot.md) | E24 · TFD D6 |
| TR12 | `tree.expand()` (no ids) and `tree.state` scan the filtered view by default; boolean `includeHidden` scans all of `data()` — same shape as `selectAllIds()` | 09-27 | decided (#163) | E25 · TFD D8 |
| TR13 | Default `hasChildren` counts children in the filtered view — a parent whose children are all filtered out renders no toggle; `isExpandable` still overrides | 09-27 | decided (#163) | E26 · TFD D9 |
| TR14 | Every tree node counts as a row — `totalRowCount` and `selectAllIds()` include children, collapsed or not; only filtered-out rows are excluded | 09-27 | decided (#163) | E27 · TFD D11 |
| TR15 | `table.tree.descendantsOf(id)` is a read-only query; removing a parent never cascades — a consumer composes `removeRows([id, ...descendantsOf(id)])`, leftover children degrade to root (TR9) | 09-27 | decided (#163) | E28 · TFD D12 |
| TR16 | Grouping with a `parentId` tree groups roots only; subtrees follow their root, never split by descendants' own values. Flat grouping = omit `parentId` | 09-27 | decided (#163) · [ADR-0028](../adr/0028-tree-parent-link-slot.md) | E29 · TFD D13 |
| TR17 | A group header's row count includes every node in the group, descendants too — matches `totalRowCount` and group select-all | 09-27 | decided (#163) | E30 · TFD D14 |
| TR18 | Group `aggregateFn` receives every node in the group, descendants included; roll-up vs own-value parents is the consumer's call inside `aggregateFn` — no new mechanism | 09-27 | decided (#163) | E31 · TFD D15 |
| TR19 | While a filter is active, context rows render expanded — a visibility rule only; the open set is not written, `changed` does not fire, and clearing the filter restores the person's own state | 09-27 | decided (#163) · superseded by TR22 | E32 · TFD D16 |
| TR20 | Toggling a revealed context row collapses it via a per-filter collapsed set, separate from the open set; the set resets when the filter changes or clears | 09-27 | decided (#163) · superseded by TR22 | E33 · TFD D17 |
| TR21 | `RenderRow.isContextRow` flags a context row; `ngpTableRow` exposes it as presence attribute `data-context-row` (ADR-0026 rule 1) — styling is the consumer's | 09-27 | decided (#163) · directive amended by TR23 | E34 · TFD D18 |
| TR22 | Filter reveal is a derived visibility source (never writes the open set); `revealContextRow` row predicate on `withTree()` picks which context rows reveal (default all, `() => false` off); a closed revealed row is remembered only while it stays a context row; `table.tree` exposes `contextRowIds()`, `parentOf()`, `descendantsOf()` — every library-only fact is readable, every policy can be switched off | 09-27 | decided (#163) | E35 · TFD D20 |
| TR23 | `data-context-row` is bound by a new `ngpTableTreeRow` feature directive, not core `ngpTableRow` (optional field → feature directive); wider tree UI is a separate issue | 09-27 | decided (#163) | E36 · TFD D21 |
| TR24 | Context-row ids are an accumulating engine slot contributed by `withFiltering()` (the only feature that knows what matched); core stamps `RenderRow.isContextRow` and `withTree()` reads it for reveal — no feature reads another's state | 09-27 | decided (#163) · [ADR-0028](../adr/0028-tree-parent-link-slot.md) | E37 · TFD arch A2 |
| TR25 | A second `parentLink` claim throws with `ngDevMode` off too, same as a member clash — an unchecked duplicate silently nests every row by whichever feature folded last, with no visible failure | 09-27 | decided (#166) · [ADR-0028](../adr/0028-tree-parent-link-slot.md) | E38 · #166 step 2 |
| TR26 | Feature factories receive the stage context as a required second argument `(input, ctx)`; `ctx.parentOf` is a lazy getter over the `parentLink` slot, read at call time, never in the factory body — how `withGrouping()` reaches the slot | 09-29 | decided (#170) · [ADR-0028](../adr/0028-tree-parent-link-slot.md) | TFD D22 |
| TR27 | `ctx` is required on the `Feature` call signature, so a composer that forgets to forward it fails to compile; one-argument factories still compile | 09-29 | decided (#170) | TFD D23 |
| TR28 | Grouping's `ClusterOpts` carries the link as one field, `treeLinks?: { parentOf, trackBy }`, so a half-set pair cannot be written; absent means flat grouping | 09-29 | decided (#170) | TFD D24 |
| TR29 | Rows inside a group bucket keep input order; the `'tree'` render stage owns hierarchy order | 09-29 | decided (#170) | TFD D25 |

## Still open

- **`state()` on a collapse-only `withTree()`** reads `'none'` — group ids are
  not discoverable from an accessor, so the denominator is empty. A toolbar
  wanting tri-state over group headers computes it from `groupIds()` and
  `tree()`. Revisit if a consumer asks for an explicit denominator input.
  Moved from the expansion log.

## Maintaining this log

1. **Register before archiving.** A decision is registered here *before* its
   work folder moves to `archive/`.
2. **Own numbering, one prefix (`TR`).** Never reuse a source folder's
   `D`-number or an expansion `E`-number as the row id; keep it in **Record**
   so older references resolve.
3. **Never renumber, never reuse.** Append with the next free number.
4. **Supersede forward, never delete.** A reversed decision keeps its row; its
   **Status** cell names the row that replaced it.
