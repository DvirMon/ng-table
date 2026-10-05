---
title: Sorting — decision history
type: decisions-log
capability: sorting
date: 2026-09-20
audience: developers
---

# Sorting — decision history

**Read this before changing anything about sorting.** It is the complete list
of decisions taken about this capability, one line each, oldest first. The
contract itself — what sorting does today — is
[`1-state/features/sorting.md`](../1-state/features/sorting.md).

This log **restates nothing**. Every row links to the record holding the
rationale, counter-arguments and rejected alternatives. If a row needs a
second line, it belongs in that record instead.

**Numbering is this log's own (`SO1…SOn`) and is never reused from a source
record.** The obvious prefix `S` is taken: the sorting contract already uses
`S1…S9` for the nine parked null-ordering scenarios, and a bare "S7" must keep
meaning _"is `withSorting()` even the right owner"_ and nothing else. Source
`D`-numbers are preserved in the last column so older cross-references resolve.

**On dates.** The `2026-09-17` workspace flatten rewrote every file's history,
so git is not a date source here. Dates below come from the records
themselves — the contract's own version date, a work folder's stated decision
date, an issue's timestamp.

## Source keys

| Key      | Record                                                                                                                                                                                 |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SPEC** | [`1-state/features/sorting.md`](../1-state/features/sorting.md) — the contract, v1.2; the only record for decisions taken before this log existed                                      |
| **ADR1** | [ADR-0001](../adr/0001-sorting-single-column-default.md) — single-column default, reversing PRD #2                                                                                     |
| **NULL** | [`sorting/archive/sorting-null-ordering/1-handoff.md`](../1-state/work/sorting/archive/sorting-null-ordering/1-handoff.md) — the null/empty placement fix                              |
| **#100** | [#100](https://github.com/DvirMon/ng-table/issues/100) — per-column feature-config placement                                                                                           |
| **SVS**  | [ADR-0024](../adr/0024-single-value-source-accessor.md) — the accessor becomes the single value source                                                                                 |
| **CS**   | [`grouping/active/grouping-config-simplification/2-decisions.md`](../1-state/work/grouping/active/grouping-config-simplification/2-decisions.md) — D11, the shared schema architecture |

## Decisions

|      | Decision                                                                                                                                                                                                                                                  | Date  | Status                                           | Record                                                          |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------ | --------------------------------------------------------------- |
| SO1  | Sort state is an ordered `SortRule[]`; array position _is_ the priority                                                                                                                                                                                   | 08-12 | shipped                                          | SPEC                                                            |
| SO2  | Direction is `'asc' \| 'desc'` — not a boolean, not a number                                                                                                                                                                                              | 08-12 | shipped                                          | SPEC                                                            |
| SO3  | Three-state toggle per column: ascending → descending → unsorted                                                                                                                                                                                          | 08-12 | shipped                                          | SPEC                                                            |
| SO4  | Single-column replace is the default; `multi: true` opts into accumulate-by-click-sequence — reverses PRD #2's always-additive `toggleSort`                                                                                                               | 08-12 | shipped                                          | ADR1                                                            |
| SO5  | `manual: true` skips the client sort step and fires `sortChanged`; no loader abstraction lives in the store                                                                                                                                               | 08-12 | shipped                                          | SPEC                                                            |
| SO6  | Sorting reads `columns` from the core config — no feature-level dependency on `withColumns()`                                                                                                                                                             | 08-12 | shipped                                          | SPEC                                                            |
| SO7  | Auto-detected comparator (string/number/date) when no `sortFn` is supplied — the algorithm was never specced in detail                                                                                                                                    | 08-12 | **open**                                         | SPEC, Open Questions                                            |
| SO8  | Multi-sort priority indicators are a UI-layer concern, not the feature's                                                                                                                                                                                  | 08-12 | **open**                                         | SPEC, Open Questions                                            |
| SO9  | S1–S9 (what counts as empty, row- vs cell-level emptiness, which feature owns it) stay parked — and stay parked _because_ product OQ-3 holds an edited row's display position for the whole edit session                                                  | 08-12 | **open** — reopens if OQ-3's row-hold is dropped | SPEC · NULL                                                     |
| SO10 | Null/empty placement resolves **before** the comparator and **outside** the direction multiply, so placement does not flip with direction                                                                                                                 | 08-27 | shipped                                          | NULL                                                            |
| SO11 | Default placement is `nulls: 'last'` (SQL / AG Grid convention); the `'first'` argument is obsoleted by OQ-3                                                                                                                                              | 08-27 | shipped                                          | NULL                                                            |
| SO12 | `""` is a real value, not empty, by default — only `null` and `undefined` are empty; opt in per column with `emptyString: 'is-empty'`                                                                                                                     | 08-27 | shipped                                          | NULL                                                            |
| SO13 | The null fix applies to a consumer `sortFn` too — no escape hatch. A `sortFn` that deliberately orders nulls is overridden                                                                                                                                | 08-27 | shipped                                          | NULL                                                            |
| SO14 | The per-column override is a **declarative rule**, not a `ColumnDef.nulls` field — chosen so that moving ownership later does not churn `ColumnDef`                                                                                                       | 08-27 | shipped · its home moves in SO21                 | NULL                                                            |
| SO15 | `applySortNulls` is single-writer — a second call on one column throws at resolve time, unlike `VISIBLE`'s AND-combine exemption                                                                                                                          | 08-27 | shipped                                          | NULL                                                            |
| SO16 | Accepted limitation: overrides require a columns schema; a table passing a plain array gets the default and cannot override per column — acceptable because the _default_ carries the fix                                                                 | 08-27 | **superseded by SO21**                           | NULL                                                            |
| SO17 | No table-wide `withSorting({ nulls })` — add only if a real table wants `'first'` everywhere                                                                                                                                                              | 08-27 | **open**                                         | NULL                                                            |
| SO18 | Per-column feature-config placement is library-wide policy, not sorting's to settle alone — spun out to #100. Registered in grouping's log as **G24**                                                                                                     | 09-16 | scope                                            | #100                                                            |
| SO19 | Rule A: per-column feature config lives on the feature. `sortFn` and `enableSorting` are deleted from `ColumnDef` outright, not deprecated-and-kept — 0 production authors each                                                                           | 09-20 | shipped                                          | #100                                                            |
| SO20 | `applySortNulls` stays in `columnsSchema` — it reads no row data, so ADR-0021's capability test makes it a column concern                                                                                                                                 | 09-20 | **superseded by SO21**, same day                 | #100 Q2                                                         |
| SO21 | `withSorting()` gains a schema fn in the recording form, and `applySortNulls` moves into it beside `applySortable` and `applySortFn` — supersedes SO20 and reverses CS D11a's "sorting has no schema of its own"                                          | 09-20 | shipped                                          | #100 · CS D11a                                                  |
| SO22 | Three declarators, not one option bag — a column needing only null placement must not have to name a comparator slot (grouping's G39, same reason)                                                                                                        | 09-20 | shipped                                          | #100                                                            |
| SO23 | Sorting reads values through the ADR-0014-wrapped `readAccessor`, and a comparator reaches a carrier column via `ctx.valueOf(path.x, row)` — a data resolver, so it takes the row                                                                         | 09-20 | shipped                                          | SVS · CS D11d                                                   |
| SO24 | `sortRows` calls `column.accessor` and a consumer `sortFn` **unwrapped**, escaping ADR-0014 — a pre-existing bug, fixed on its own rather than folded into the migration                                                                                  | 09-20 | shipped                                          | SVS                                                             |
| SO25 | Schema rule functions drop the `apply` prefix and are named for the constraint they assert: `sortNulls`, `sortFn`, `sortable`                                                                                                                             | 09-22 | shipped                                          | [ADR-0025](../adr/0025-schema-rule-functions-are-bare-named.md) |
| SO26 | Reuse across columns goes through a `sortingSchema<Row>(fn)` identity helper, typing-only — it exists so the handle's type is inferred, and does nothing at runtime. No `apply()`: on a flat, non-recursive path `apply(path.x, fn)` is just `fn(path.x)` | 09-25 | shipped                                          | #100 · this workspace                                           |
| SO27 | A single `sorting(path, { enable, compare, nulls })` options object was considered and rejected — it would reverse SO22 and the ADR-0025 bare names, and depart from grouping's split (G39). SO22 stands                                                  | 09-25 | shipped                                          | #100 · this workspace                                           |
| SO28 | `sortable` defaults to on — a column with no `sortable` rule is sortable. `{ enable }` is read live at `toggleSort()` call time, never cached; a throwing `enable` degrades to sortable and reports once per column per evaluation (ADR-0014)             | 09-25 | shipped                                          | #100 · this workspace                                           |
| SO29 | A duplicate declarator of the same kind on one column throws at construction — extends SO15 (`sortNulls`-only) to all three declarators. Different kinds on one column are fine                                                                           | 09-25 | shipped                                          | #100 · this workspace                                           |

All dates are 2026.

## Still open

Seven rows carry `open`. In rough order of how likely they are to bite:

- **SO7** — the auto-detection algorithm. Shipped without a written spec, so
  the only statement of what it does is `detectComparator` itself. It becomes
  load-bearing once SO19 removes `sortFn` from `ColumnDef`, because the
  fallback is then what most columns get.
- **SO9** — S1–S9. Not sorting's to reopen unilaterally: the condition is
  product OQ-3 dropping the edited row's position hold.
- **SO17** — the table-wide `nulls` default. Cheap when wanted (one config
  field plus a fallback in `nullsOrderFor`), and SO21 gives it an obvious home
  it did not have before.
- **SO8** — multi-sort priority indicators. Deferred to the directive spec.

## ADRs that constrain sorting

Listed in descending order of how badly an agent gets sorting wrong without
them.

[ADR-0024](../adr/0024-single-value-source-accessor.md) — the accessor is the
only value source, so a comparator never reads a row field directly ·
[ADR-0014](../adr/0014-runtime-error-policy.md) ·
[ADR-0001](../adr/0001-sorting-single-column-default.md) ·
[ADR-0021](../adr/0021-column-concerns-and-data-concerns-are-separate-surfaces.md)
— its capability test stands; its path-vocabulary rule does not, and SO20 is
what came of reading the test as a placement rule ·
[ADR-0019](../adr/0019-columns-path-keyed-by-declared-column-ids.md) ·
[ADR-0011](../adr/0011-chained-render-stages.md).

## Maintaining this log

Format contract: `~/.claude/conventions/doc-contracts/decisions-log.md`.

- A decision is registered here **before** its work folder moves to `archive/`.
  That rule is in [`libs/table/CLAUDE.md`](../../CLAUDE.md) and is what keeps
  this file true.
- Append with the next free `SO`-number. Never renumber, never reuse.
- Superseding a row means editing the old row's `Status` to point forward, not
  deleting it. SO20 → SO21 is the worked example, and it is one day wide — a
  reversal that fast is exactly the kind a log exists to keep visible.
