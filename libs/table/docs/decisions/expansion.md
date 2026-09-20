---
title: Expansion — decision history
type: decisions-log
capability: expansion
date: 2026-09-20
audience: developers
---

# Expansion — decision history

**Read this before changing anything about expansion or tree.** It is the
complete list of decisions taken about this capability, one line each, oldest
first. The contract itself — what expansion does today — is
[`1-state/features/expansion.md`](../1-state/features/expansion.md).

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

## Decisions

| | Decision | Date | Status | Record |
|---|---|---|---|---|
| E1 | `childrenAccessor` is a configurable accessor defaulting to `row.children`, not a cast | 08-07 | shipped · default dropped by E6 | WE |
| E2 | No `manual` config — it would toggle no behavior | 08-07 | standing | WE |
| E3 | `expandAll`/`collapseAll` emit `rowExpanded` once per affected id; no separate bulk event | 09-06 | shipped | AUD |
| E4 | Stale restored ids are kept, not dropped — staleness is caller-owned (selection D8 verbatim) | 09-08 | standing | AUD |
| E5 | `withTree()` accepts real-row parents only — every tree node is an entry in the flat `data()`; no `getDataPath`, since invented parents are `withGrouping()`'s mechanism | 09-20 | accepted, not built | PTS D1 |
| E6 | `childrenAccessor` is required on `withTree()`; the `row.children` fallback is dropped, which closes G6 as impossible rather than fixed | 09-20 | accepted, not built · required half amended by E13 | PTS D2 |
| E7 | `everExpanded` is panel-only — the shared store stops at open-id machinery, `withExpansion()` adds it on top | 09-20 | accepted, not built | PTS D3 |
| E8 | `setExpanded(ids)` is the store's general write; `expandAll(ids)`/`collapseAll()` are removed as store verbs, and `withTree()` keeps `expandAll()` for the discovery walk only | 09-20 | accepted, not built · amended by E11 | PTS D4 |
| E9 | `expansionState` tri-state is a `withTree()` member and ships with it; the panel side computes the equivalent in one line | 09-20 | accepted, not built | PTS D5 |
| E10 | Both features ship as ADR-0015 slices (`table.expansion`, `table.tree`) inside #101, rather than flat prefixed members superseded by #50 | 09-20 | accepted, not built | PTS D6 |
| E11 | `setExpanded` is internal; the public surface is `toggle`/`expand`/`collapse`/`set`, with an omitted `ids` meaning all — `expandAll`/`collapseAll` disappear as names | 09-20 | accepted, not built | PTS D7 |
| E12 | `withGrouping()` is static; collapsible group headers come from composing `withTree()`, and `withExpansion()` contributes nothing to render visibility — reverses ADR-0012 Decision 5 and closes the union collision | 09-20 | accepted, not built | PTS D8 |
| E13 | `childrenAccessor` is optional with no fallback — omitted means collapse-only, and `withTree()` claims the `'tree'` stage only when an accessor is given | 09-20 | accepted, not built | PTS D9 |
| E14 | `initial` ships with the split, seeded in `createExpansionStore()` | 09-20 | accepted, not built | PTS D10 |
| E15 | `withTree()` has no declared levels and never gains them — a declared-axis hierarchy is `withGrouping()`; `isExpandable` is the only row-selection knob | 09-20 | standing | PTS D11 |
| E16 | A throwing `childrenAccessor` degrades to "no children" and reports once per evaluation (ADR-0014), never propagates | 09-20 | accepted, not built | PTS D12 |
| E17 | One emission rule for every write: once per id in the symmetric difference of the old and new open sets — generalizes E3 across `toggle`/`expand`/`collapse`/`set` | 09-20 | accepted, not built | PTS spec |

## Still open

- **E5 follow-on** — variable-depth grouping (a path-derived level source) is
  filed against grouping, not expansion, if a consumer ever needs it.
- **`state()` on a collapse-only `withTree()`** reads `'none'` — group ids are
  not discoverable from an accessor, so the denominator is empty. A toolbar
  wanting tri-state over group headers computes it from `groupIds()` and
  `tree()`. Revisit if a consumer asks for an explicit denominator input.
- **`ReadonlySet<RowId>` narrowing** on both slices (today `Signal<Set<RowId>>`)
  — aligns with `withSelection()`, confirm at slicing time.
- **E3/E17's per-id emission reconsidered against `SelectionChange`** — both
  decisions settled on `Observable<RowId>` (one event per id), but
  `withSelection()` carries the identical batch-write problem via a single
  `SelectionChange { added, removed }` diff event instead. Filed as
  [#124](https://github.com/DvirMon/ng-table/issues/124), pending a discovery
  doc on comparable libraries' expand/collapse event shapes.

## Maintaining this log

1. **Register before archiving.** A decision is registered here *before* its
   work folder moves to `archive/`.
2. **Own numbering, one prefix (`E`).** Never reuse a source folder's
   `D`-number as the row id; keep it in **Record** so older references resolve.
3. **Never renumber, never reuse.** Append with the next free number.
4. **Supersede forward, never delete.** A reversed decision keeps its row; its
   **Status** cell names the row that replaced it.
