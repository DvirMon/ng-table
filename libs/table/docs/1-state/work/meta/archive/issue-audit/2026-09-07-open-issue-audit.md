---
title: Audit — open GitHub issues vs. shipped code
type: audit
date: 2026-09-07
scope: DvirMon/acme open issues matching "table in:title" (11)
method: acceptance criteria checked against libs/shared/table/src + docs
---

# Open table issues audited against the workspace

Branch `feat/table`, HEAD `1ba6889`. Every issue's acceptance criteria were re-checked
against source, not against the issue's own checkboxes.

## Verdicts

| # | Title | Verdict |
|---|---|---|
| 53 | row-edit G3 — optimistic create identity (`swapRowId`) | **Close — shipped** |
| 47 | row mutation free functions | **Close — shipped** |
| 4 | `withExpansion()` feature | **Close — shipped** |
| 8 | `withSorting()` multi opt-in | **Close — shipped** (one demo nit) |
| 1 | State Layer PRD (`createTableStore`) | **Close — superseded by in-repo doc** |
| 54 | optimistic G5 — rollback never delete or move | **Retitle — half stale** |
| 52 | `withExpansion()` reconcile `expandedRows` | Keep — ~90% done, 2 ACs left |
| 51 | engine announces removed row ids | Keep — 1 doc AC left |
| 6 | `withGrouping()` feature | Keep, **body stale** — rewrite design section |
| 5 | `withFiltering()` feature | Keep — unbuilt, body still accurate |
| 7 | Pipeline integration verification | Keep — blocked on #6/#6 |

---

## Close — work is shipped

### #19 — `swapRowId` (G3)

Every acceptance criterion is met in code.

- `swapRowId(from, to)` re-keys `open`, `snapshots` and `unconfirmed` in one write —
  `src/mutations/optimistic-mutations.ts:197`, exported from `src/index.ts`.
- O24 (which feature owns the verb) resolved 2026-09-03: its own updater in
  `mutations/`, owned by neither feature — `work/row-editing/active/with-row-editing/5-gaps.md:366`.
- Tests: `optimistic-mutations.spec.ts:512-700`, including the no-op case, the
  open-row-survives-swap case, and the ordering-invariant test.
- Round-trip exercised in three story hosts (`gated-single-optimistic`,
  `gated-multiple-optimistic`, `gated-bulk-optimistic`).
- G3 marked **CLOSED 2026-09-03** in `5-gaps.md:95`.

### #12 — row mutation free functions

All boxes already ticked in the issue and confirmed in code: `insertRow`, `removeRow`,
`patchRow` exported from `src/index.ts`, defined in `src/mutations/row-mutations.ts`,
unit-tested in `row-mutations.spec.ts`. The `updateRows(table, updater)` AC was
explicitly superseded by D30 (write path is `table.value.update()` via `WritableView`),
and no mutation methods remain on `TableCore`. Nothing left to do.

### #5 — `withExpansion()`

The one unchecked AC — "`rowExpanded` fires on every expand and every collapse" — is now
satisfied: `rowExpandedSource` in `with-expansion.ts:145`, with three dedicated tests
(`with-expansion.spec.ts:115,131,149`) covering toggle, `expandAll()` and `collapseAll()`.
The corresponding doc open-question is marked resolved 2026-09-06 in
`docs/1-state/features/expansion.md`.

Caveat: the issue's "Revised 2026-07-31" design section describes a `_buildRenderRows`
hook that no longer exists — it was removed with `@ngrx/signals` (ADR-0003) and replaced
by chained render stages (ADR-0011, `engine/render-stages.ts`). The feature shipped; only
the issue text is stale.

### #9 — `withSorting({ multi })`

Shipped. `WithSortingConfig.multi` at `with-sorting.ts:11`, defaulting to `false` at
line 149; ADR-0001 records the decision. `docs/1-state/features/sorting.md` documents the
default and the `multi` contract (lines 17, 38-39, 50-58). `with-sorting.spec.ts` passes
`{ multi: true }` explicitly on the additive tests and covers the replace default.

One AC genuinely unmet: `apps/demo/src/app/table-demo/table-demo.store.ts:17` still calls
`withSorting<Person>()` on the implicit default, where the issue asked for a deliberate,
explicit choice. That is a one-line change, too small to hold the issue open — make it and
close, or close and drop the AC.

### #2 — State Layer PRD

The issue body is a frozen 2026-07-19 snapshot of a PRD that now lives, maintained, at
`libs/shared/table/docs/1-state/prd.md`. The in-repo copy has moved on: `createTableStore`
→ `createTable`, and `@ngrx/signals` → the in-house `composeTable()` (ADR-0003, replaced
2026-08-11). The issue text still says `createTableStore` and names ngrx as the internal
engine — neither is true of any code in the workspace.

As an umbrella it is also no longer load-bearing: its children are individually tracked
(#5 and #9 done, #6/#6/#7 open). Close it and point at `docs/1-state/prd.md` plus
`docs/1-state/architecture.md` as the live source of truth.

---

## Retitle — half the issue is stale

### #20 — G5, optimistic rollback coverage

The title and opening claim ("covers update and create only, never delete or move") are
**out of date**. The delete half shipped 2026-08-27 —
`work/row-editing/archive/with-optimistic-crud/2-decisions.md` D45-D48, tracked as DONE at `5-gaps.md:403`,
with `removeEdit` exported from `src/index.ts`. `5-gaps.md:180` already restates the gap
correctly: "covers update, create, and (now) delete; move stays uncovered."

What survives is the **move** half only, and it has a new blocker recorded at
`5-gaps.md:410`: move rollback should be designed alongside `withDragDrop()`/`moveRow`,
not ahead of them. O22's representation question (inverse operation vs. value snapshot) is
still open.

Recommended: retitle to `table(optimistic): G5 — rollback cannot cover move`, replace the
body's delete framing, and note the `withDragDrop()` blocker. Do not close — the gap is
real, just narrower than the issue says.

---

## Keep open

### #17 — reconcile `expandedRows` on removal

Mostly done. `withExpansion()` declares `onRowsRemoved`, `everExpanded` keeps its
additive-only contract, and `with-expansion.spec.ts:279` covers "removing an expanded row
clears it from `expandedRows` but not `everExpanded` (ADR-0006)".

Two ACs are genuinely outstanding:

- The **re-add regression test** — expand, remove, then re-add the same id and assert the
  row renders collapsed. No such test exists in the spec file.
- `docs/1-state/features/expansion.md` does not document the removal behavior directly. It
  mentions the prune only obliquely, at line 179, inside an open question about stale
  *restored* ids.

Small residual; keep open until both land.

### #16 — announce removed row ids

Implementation is complete: `onRowsRemoved` on `TableFeatureSpec`, folded in
`compose-table.ts`, `pruneByIds()` in `engine/rows.ts`, adopted by `editing-state.ts`,
`with-row-edit.ts`, `with-optimistic.ts` and `with-expansion.ts`, tested in
`compose-table.spec.ts`.

One AC left, a doc line: `docs/1-state/architecture.md` was to record the convention in
its open-questions list so a future `withSelection()` is written with the hook. Grep finds
no `onRowsRemoved` in that file. (The obligation *is* recorded in the per-feature docs —
`features/column-pinning.md:114`, `features/column-sizing.md:118,158` — and in `CLAUDE.md`,
so this is redundancy, not a live trap.) Note `docs/1-state/work/with-selection/` is
untracked in the working tree, so the risk this AC guards against is imminent.

### #7 — `withGrouping()`

Feature is unbuilt: no `with-grouping.ts` in `src/api/features/`. Still wanted — the
architecture doc lists it as drilled with a spec at `docs/1-state/features/grouping.md`,
and ADR-0011's chained render stages exist specifically to unblock it (`RENDER_ORDER`
already reserves a `'group'` stage in `engine/render-stages.ts:8`).

**The issue body's design section is stale.** It specs `withGrouping()` as setting the
core store's `_buildRenderRows` hook — a member removed with `@ngrx/signals`
(`work/drop-ngrx-engine/2-decisions.md:53`). The current mechanism is declaring
`renderStages.group` on the returned `TableFeatureSpec`, the way `withExpansion()`
declares `renderStages.tree`. Rewrite that section against ADR-0011 before anyone picks
this up; the acceptance criteria themselves still hold.

### #6 — `withFiltering()`

Unbuilt and un-stale. No `with-filtering.ts`; `PIPELINE_ORDER` at `engine/pipeline.ts:6`
already reserves `'filter'` as the first stage, exactly as the issue specifies. The body
describes pipeline-stage mechanics that survived the ngrx removal intact. Leave as is.

Two open questions elsewhere depend on it — O15 and O16 in `5-gaps.md` are marked
"phantom — needs `withFiltering()`".

### #8 — Pipeline integration verification

Cannot start: it composes all four features and two of them (#6, #7) do not exist. The
verification target is still correct — `PIPELINE_ORDER` is
`['filter','group','sort','expand']`, matching the issue. Keep, blocked.

Minor: the issue says "no new public API surface should be needed" and references
`createTableStore()`; that name is dead and should read `createTable()`.

---

## Cross-cutting note

Four issues (#2, #5, #7, #8) still speak of `createTableStore()` and/or `_buildRenderRows`.
Both were removed by ADR-0003 in August. Two of the four are being closed anyway; #7 and
#8 need a terminology pass whenever they are next touched.
