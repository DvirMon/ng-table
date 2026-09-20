---
title: Grouping — decision history
type: decisions-log
capability: grouping
date: 2026-09-20
audience: developers
---

# Grouping — decision history

**Read this before changing anything about grouping.** It is the complete list
of decisions taken about this capability, one line each, oldest first. The
contract itself — what grouping does today — is
[`1-state/features/grouping.md`](../1-state/features/grouping.md).

This log **restates nothing**. Every row links to the record that holds the
rationale, the counter-arguments and the rejected alternatives. If a row needs
a second line, that second line belongs in the linked record.

**Numbering is this log's own (`G1…Gn`) and is never reused from a source
folder.** Grouping accumulated four separate decision logs each numbered from
`D1`, three of them mutually redefining — a bare "D7" meant three different
things depending on which folder you were in. The `G`-space exists so that
never happens again. Source `D`-numbers are preserved in the last column so
older cross-references still resolve.

## Source keys

| Key | Record |
|---|---|
| **WG** | [`archive/with-grouping/2-decisions.md`](../1-state/work/grouping/archive/with-grouping/2-decisions.md) — the foundational grill |
| **CGI** | [`archive/column-group-index/2-decisions.md`](../1-state/work/grouping/archive/column-group-index/2-decisions.md) — #81, the column↔level relation |
| **CS** | [`active/grouping-config-simplification/2-decisions.md`](../1-state/work/grouping/active/grouping-config-simplification/2-decisions.md) — `initial` declares, rules mask |
| **AGG** | [`active/aggregate-config-placement/1-decisions.md`](../1-state/work/grouping/active/aggregate-config-placement/1-decisions.md) — #100's `aggregateFn` slice |
| **ST** | [`3-ui/work/archive/grouping-stories/3-lesson-audit.md`](../3-ui/work/archive/grouping-stories/3-lesson-audit.md) — the one-story-one-lesson restructure |

## Decisions

| | Decision | Date | Status | Record |
|---|---|---|---|---|
| G1 | Write surface is `table.grouping.update(updater)`, never bare setters | 09-10 | shipped | WG D1 |
| G2 | Grouping state lives on the feature, never on `ColumnDef` | 09-10 | shipped · reaffirmed by G26 | WG D2 |
| G3 | State shape is `grouping: string[]`, ordered, index 0 outermost | 09-10 | shipped | WG D3 |
| G4 | Group ordering compares group *contents*, not keys | 09-10 | shipped · placement moved by G21 | WG D4 |
| G5 | Group order and row sort stay fully decoupled — no shared state | 09-10 | shipped | WG D5 |
| G6 | Base + overlay fold: a resolved rule replaces `initial` outright | 09-10 | **superseded by G32** | WG D6 |
| G7 | Rule contract: `[]` groups by nothing, `undefined` abstains — they differ | 09-10 | shipped · clobber consequence retired by G32 | WG D7 |
| G8 | Declarative sugar ships in three subtractable layers | 09-10 | shipped · call-order half reversed by G33 | WG D8 |
| G9 | Full multi-level ships; grand totals and pivoting scoped out | 09-10 | shipped | WG D9 |
| G10 | `TRow` stays inferable — no `withGrouping<TRow>()` in the contract | 09-10 | shipped | WG D10 |
| G11 | Nested-group collapse is grouping's own subtree walk | 09-10 | **superseded by G23** | WG D11 |
| G12 | Multi-level performance is a design constraint, not a later concern | 09-10 | standing | WG D12 |
| G13 | A pending rule abstains the whole set; sync vs async by runtime ownership | 09-10 | shipped · amended by G51 | WG D13 |
| G14 | Unknown column id throws at construction, degrades at runtime | 09-10 | **superseded by G36** | WG D14 |
| G15 | Consumer-callback fallbacks named per ADR-0014 | 09-10 | shipped | WG D15 |
| G16 | `manual: true` — blocked by construction order, no competitor API to borrow | 09-10 | **open** | WG Open |
| G17 | Header click on the grouped column is a no-op; routing it to group order is UI-layer | 09-10 | **open** | WG Open |
| G18 | A group header is a view over rows; `rowsOf()` exposes members, consumer owns the cascade | 09-12 | shipped | WG D16 |
| G19 | Resolve a group by `id`, never object identity; `rowsOf` must read `renderRows()` | 09-12 | shipped | WG D16.1 |
| G20 | `rowsOf` re-derives the cluster tree from `rows()`, so collapse cannot empty it | 09-12 | shipped | WG D17 |
| G21 | Group admission `when`: table-wide + per-column, AND-combined; ordering moves to `applyGroupOrder` | 09-15 | shipped | WG Open |
| G22 | A dissolved cluster exits the tree entirely — it renders flat at depth 0, never re-entering deeper | 09-16 | shipped | WG Open Q1 |
| G23 | Collapse/expand is engine-owned (the `'prune'` stage); grouping reads no expansion state | 09-16 | shipped | [ADR-0017](../adr/0017-engine-owned-descendant-prune.md) |
| G24 | Per-column feature-config placement is library-wide policy — spun out to #100 | 09-16 | **open** | CGI N0 |
| G25 | The column↔level relation serves a dynamic group-by panel, not grouping in general | 09-17 | shipped | CGI D1 |
| G26 | Two feature members — `groupingLevels()` and `isGroupedBy()`; nothing on `ColumnDef` | 09-17 | shipped | CGI D2 |
| G27 | `isGroupedBy(): boolean`, not `groupIndexOf()` — drops the name #81 was filed under | 09-17 | shipped | CGI D3 |
| G28 | Both members derive from `groupingLevels()`, never from `grouping()` | 09-17 | shipped | CGI D4 |
| G29 | Rejected: widening `grouping`'s `WritableView` read type | 09-17 | rejected | CGI D5 |
| G30 | Rejected: a standalone `createGroupBy(table)` helper | 09-17 | rejected | CGI D6 |
| G31 | Three orthogonal orderings — levels, clusters, rows — stay unrelated | 09-17 | shipped | CGI D7 |
| G32 | `initial` declares the levels *and* their nesting order; rules only mask | 09-17 | shipped `5ecc437` | CS D1 |
| G33 | Call order in a schema fn carries no meaning | 09-17 | shipped | CS D2 |
| G34 | A rule naming an undeclared column is inert — it cannot introduce a level | 09-17 | shipped | CS D3 |
| G35 | Abstain passes the declared levels through unmasked, never groups by nothing | 09-17 | shipped · amended by G51 | CS D4 |
| G36 | Grouping's schema path is keyed by the row model, not by declared column ids | 09-18 | shipped | CS D7 → [ADR-0021](../adr/0021-column-concerns-and-data-concerns-are-separate-surfaces.md) |
| G37 | `grouping()` reports the **applied** levels; read-applied, write-declared | 09-19 | shipped | CS D5 |
| G38 | No per-rule `order` field — `initial` is the only statement of nesting | 09-19 | shipped | CS D8 |
| G39 | One declarator per concern: `applyGrouping` activates, `applyGroupKey` derives, `applyGroupOrder` orders | 09-19 | shipped `4c86322` | CS D9 |
| G40 | Does `schema` accept a pre-built value for cross-table reuse? | 09-19 | **open** — its stated deadline has passed: `rules` is already gone from `WithGroupingConfig` | CS D6 |
| G41 | #100 is sliced — this decision set covers `aggregateFn` only | 09-19 | scope | AGG |
| G42 | Aggregation stays a grouping-owned concept — no `withAggregation()` feature | 09-19 | accepted, unbuilt | AGG |
| G43 | `applyAggregate` is declared through `GroupingPath`, row-field keyed | 09-19 | accepted, unbuilt | AGG |
| G44 | `ColumnDef.aggregateFn` is deleted outright, not deprecated-and-kept | 09-19 | accepted, unbuilt | AGG |
| G45 | `applyAggregate` does not validate its field against declared columns | 09-19 | accepted, unbuilt | AGG |
| G46 | Sequencing: #100's `aggregateFn` slice lands before #47, which lands before #45 | 09-19 | **open** | AGG |
| G47 | One story, one lesson — five mixed hosts become eight single-lesson hosts | 09-19 | shipped | ST D1 |
| G48 | ADR-0014's retrofit shipped: three grouping wrap sites, each with a named fallback | 09-19 | shipped | ST D3 |
| G49 | `grouping-crud`'s facts move to specs; the story is removed | 09-19 | shipped | ST D8 |
| G50 | The empty-rule guard widens — a field carrying only `applyGroupKey` is legal | 09-19 | shipped | ST D9 |
| G51 | A pending rule holds its own last resolved boolean; only a never-resolved rule abstains the set | 09-19 | shipped | ST D11 |
| G52 | Per-story keep/strip/remove calls — rolled up here rather than itemized | 09-19 | shipped | ST D2, D4–D7, D10 |

All dates are 2026.

## Still open

Six rows above carry `open`. In rough order of how likely they are to bite:

- **G40** — `schema`'s pre-built value. Its deadline was "decide before Phase B deletes `rules`";
  source now shows `WithGroupingConfig` has no `rules` member, so the deletion already happened
  and this was never settled. Decide it or close it.
- **G24** — #100's library-wide placement rule. G41–G46 are one slice of it.
- **G46** — the #100 → #47 → #45 sequencing, which #47's body does not yet reflect.
- **G16** — `manual: true`, structurally blocked, not merely unbuilt.
- **G17** — header click on the grouped column, a UI-layer question.

## ADRs that constrain grouping

Listed in descending order of how badly an agent gets grouping wrong without
them. The contract doc carries the same list with a line on each.

[ADR-0017](../adr/0017-engine-owned-descendant-prune.md) ·
[ADR-0021](../adr/0021-column-concerns-and-data-concerns-are-separate-surfaces.md) ·
[ADR-0018](../adr/0018-when-vs-enable-predicate-naming.md) ·
[ADR-0011](../adr/0011-chained-render-stages.md) ·
[ADR-0014](../adr/0014-runtime-error-policy.md) ·
[ADR-0019](../adr/0019-columns-path-keyed-by-declared-column-ids.md) ·
[ADR-0022](../adr/0022-render-row-cell-values.md) — and
[ADR-0012](../adr/0012-split-expansion-into-panel-and-tree.md),
[ADR-0006](../adr/0006-row-id-state-reconciliation.md) as background.

## Maintaining this log

- A decision is registered here **before** its work folder moves to `archive/`.
  That rule is in [`libs/table/CLAUDE.md`](../../CLAUDE.md) and is what keeps
  this file true.
- Append with the next free `G`-number. Never renumber, never reuse.
- Superseding a row means editing the old row's `Status` to point forward, not
  deleting it. The history is the point.
