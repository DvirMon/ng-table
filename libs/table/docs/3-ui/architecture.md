---
title: Architecture — UI Layer Directive Specs
type: architecture
version: 0.5
date: 2026-09-14
status: >
  draft — core + 1 feature drilled; full feature surface enumerated (5 stubs, 1 no-UI, 2 deferred).
  Re-checked 2026-09-14 against the 18 shipped stories: filtering's no-UI verdict holds but its
  API names were stale (R26 removed them), grouping and selection are no longer blocked on the
  state layer, and `3-ui/directives/selection.md` is now itself the blocker on three ❌ product
  stories.
audience: developers
---

# Architecture — UI Layer Directive Specs

## Executive Summary

This document indexes the directive-by-directive design of the NGP Table UI layer, continuing from the top-level decisions locked in `overview.md` (native HTML, attribute-only directives, no custom structural directives) and the state layer contracts in `1-state/architecture.md`. Each directive/concern has its own reference file with full detail: API, host bindings, accessibility wiring, rejected alternatives, and open questions. **This is an architecture/spec document, not an implementation** — it defines the contract a developer builds against.

**Status: core structural directives + store connection + 1 of 5 interactive features fully drilled**, plus both cross-cutting concerns (styling/tokens, accessibility) and virtual scroll integration.

The full UI-layer surface is now enumerated (2026-08-07) — every state-layer feature has an explicit UI-layer verdict, so "what's left" is countable rather than estimated:

- **Drilled:** sort.
- **Stubbed, ready to drill:** expansion (unblocked by [#10](https://github.com/DvirMon/ng-table/issues/10)), grouping (**unblocked 2026-09-14** — `withGrouping()` ships and three stories render group rows), selection (**unblocked 2026-09-14** — D59 answered the scope question, and this stub is now what blocks range select, the keyboard focus model and SR announcements).
- **Stubbed, blocked on a state-layer answer:** drag & drop, resizing.
- **Decided to have no UI layer:** filtering — re-confirmed 2026-09-14 against three shipped stories.
- **Deferred:** pagination, infinite scroll — their state-layer files are themselves undrilled.

---

## Core (Always Present)

| Reference | Status |
|---|---|
| [`3-ui/directives/core.md`](directives/core.md) — `ngpTable`, `ngpTableRow`, `ngpTableCell`, store connection pattern. **Revised 2026-07-31:** `createTable()` now returns a live store *instance*, not a class, so `provideTableStore()` is gone — the instance enters via a required `[ngpTable]` input and `NgpTableDirective` self-provides under `NGP_TABLE_STORE`. | ✅ Drilled |
| [`3-ui/directives/columns.md`](directives/columns.md) — `ngpTableColumn`, column identity, store-vs-directive override boundary. **Revised 2026-07-31:** synced to the real `ColumnDefInput`/`ColumnDef` shape and the opt-in `columnsSchema` layer. | ✅ Drilled |

## Features — Drilled

| Feature | Reference | Summary |
|---|---|---|
| Sort | [`3-ui/directives/sort.md`](directives/sort.md) | `ngpTableSort` on `<th>`, button-inside-header pattern (matches `MatSortHeader`). **Revised 2026-07-21:** directive now owns click/keydown activation handling to read a configurable modifier key (default Shift) and call `store.toggleSort(columnId, { accumulate })` — reverses prior "display-only, consumer wires click" decision; see file for rationale. |

## Features — Not Yet Drilled

| Feature | Reference | Blocked on |
|---|---|---|
| Selection | [`3-ui/directives/selection.md`](directives/selection.md) | **The stated blocker is answered; a different one replaces it.** D59 settled "select all" scope — `selectAllIds(table)` is post-filter/post-sort, `{ includeHidden: true }` is the whole dataset, both first-class and separately named — and `filtering-selection/` renders them side by side. What this file is now the blocker *for*: shift-click range select (4 of 5 peers ship it), the roving-focus / Tab-containment model, and screen-reader announcements. All three are ❌ in [`0-product/selection.md`](../0-product/selection.md) §1.3/§4.1/§4.2/§4.3 **because this file is a stub**, which is the strongest current argument for drilling it. |
| Resizing | [`3-ui/directives/resizing.md`](directives/resizing.md) | No state-layer feature yet; interaction with `columns.md`'s existing width-override input undecided |
| Drag & Drop | [`3-ui/directives/drag-drop.md`](directives/drag-drop.md) | State layer: does drag-reorder require clearing active sort, or no-op silently? |
| Expansion | [`3-ui/directives/expansion.md`](directives/expansion.md) | Nothing — unblocked by [#10](https://github.com/DvirMon/ng-table/issues/10) landing 2026-08-07. **Scope decided 2026-08-07:** own file, one directive (`ngpTableExpandToggle`). Ready to drill. |
| Grouping | [`3-ui/directives/grouping.md`](directives/grouping.md) | **Unblocked 2026-09-14.** `withGrouping()` ships and three stories render `RenderRow.kind: 'group'`, so this is now verifiable rather than drillable-on-paper. **Scope decided 2026-08-07:** own file, **no new directive** — covers group-row rendering + aggregate placement only. What the stories add to the drilling input: U1's group-header cell structure (one spanning `<td>` vs. one per column) is still open and now has a worked instance to argue against, and 2.4's sticky headers ship as one CSS class that sticks every depth to the same offset, so nested paths overlap. |

## Features — No UI Layer (decided)

| Feature | Decision |
|---|---|
| Filtering | **2026-08-07 — no `ui-layer/` file, no directive. Verdict re-confirmed 2026-09-14; the API names were corrected.** Filter controls are ordinary form inputs bound to `createFilters()`' criterion model — `filters().value` is a `WritableSignal`, so a Signal Form wraps it with no adapter and no sync effect (R18/R25). The pre-`createFilters()` names this row used to give, `setColumnFilter()` / `setGlobalFilter()`, were removed by R26 and no longer exist. Nothing about a filter input is table-structural and Angular forms already own its accessibility, so an `ngpTableFilterInput` convenience directive stays rejected as duplicating form bindings. The three shipped stories are the evidence: they bind `[formField]` straight to criterion nodes, and the two controls that cannot be bound that way — a `<select>` whose empty value is `''` where `equals` wants `null`, and a tag multi-select that is a set rather than a control value — are hand-wired in the host, which is exactly the work a directive would have had to own. |

## Features — UI Layer Decision Deferred

| Feature | Deferred because |
|---|---|
| Pagination | **2026-08-07 — deferred, not decided.** `1-state/features/pagination.md` is still "not yet drilled" (state shape is a sketch, methods unspecified), and the state layer's pagination-vs-infinite-scroll exclusivity question is open. Revisit once that file is drilled. |
| Infinite scroll | **2026-08-07 — deferred, not decided.** `1-state/features/infinite-scroll.md` is still "not yet drilled." The open UI question is whether NGP owns a scroll-end/fetch-trigger directive on the CDK viewport or leaves it to CDK's own `scrolledIndexChange` — unanswerable before the state layer defines the fetch contract. Also interacts with `virtual-scroll.md`. |

## Cross-Cutting

| Concern | Reference | Summary |
|---|---|---|
| Styling & tokens | [`3-ui/cross-cutting/styling-tokens.md`](cross-cutting/styling-tokens.md) | `data-*` attributes for state, CSS custom properties for values; Tailwind-native |
| Accessibility | [`3-ui/cross-cutting/accessibility.md`](cross-cutting/accessibility.md) | Conditional `aria-label` only; single table-level `aria-live`, no per-cell |
| Virtual scroll | [`3-ui/cross-cutting/virtual-scroll.md`](cross-cutting/virtual-scroll.md) | Native single `<table>`, CDK viewport wraps `<tbody>` only, sticky `<thead>` via CSS |

---

## Cross-Cutting Dependency Notes

```
ngpTableSort          ──requires (same-element DI)──▶  ngpTableColumn
ngpTableSelectionCheckbox ──blocked-on──▶  withSelection() select-all scope (state layer, open)
ngpTableDragHandle    ──blocked-on──▶  drag-vs-sort interaction rule (state layer, open)
ngpTableResizable     ──touches──▶  ngpTableColumn's [ngpColumnWidth] override (mechanism undecided)
ngpTableExpandToggle  ──requires (row DI)──▶  ngpTableRow / NGP_TABLE_ROW  (available)
grouping (no directive) ──reuses──▶  ngpTableExpandToggle for group collapse (shared expandedRows)
virtual-scroll         ──depends-on──▶  styling-tokens.md's itemSize/row-height decision (not yet specced)
```

> **Note on sequencing:** this session's UI layer drilling proceeded ahead of full state-layer sign-off, by explicit decision. Three of the five not-yet-drilled stubs above (selection, drag & drop, resizing) are the direct consequence — each genuinely needs a state-layer answer first, not just "hasn't been gotten to yet." The other two are different: `expansion.md` has no blocker at all, and `grouping.md` is blocked only on `withGrouping()` being implemented, not on any open question.

## Cross-Cutting Open Questions (span multiple files)

- [ ] **`toggleSort()` needs a per-call options argument** — added 2026-07-31. `sort.md`'s modifier-key design calls `toggleSort(id, { accumulate })`, but shipped `api/features/with-sorting.ts` takes `toggleSort(id)` only and decides accumulation once at construction (`withSorting({ multi: true })`). The UI decision requires a state-layer change; not ticketed.
- [ ] **`aria-live` status message ownership** — **deferred 2026-07-31, by decision.** No `statusMessage` exists on `TableStore`; consumer-computed vs. feature-contributed vs. an `ngpTableStatus` directive is undecided (see `accessibility.md`). Purely additive — no directive or store contract depends on it, so it blocks nothing. Accepted cost: sort/filter/page state changes are not announced to screen readers. Revisit before any user-facing ship.
- [x] ~~**`ngpTableRow` carries no row identity**~~ — **resolved 2026-07-31.** `ngpTableRow` binds `RenderRow<TRow>` and republishes it under `NGP_TABLE_ROW`; row-scoped feature directives (selection, expansion, drag-drop) inject it instead of taking duplicate inputs. Header `<tr>`s carry no `ngpTableRow`. See `core.md`. Follows `with-grouping.md`'s existing commitment that the UI layer consumes `renderRows()`, and is the only option that can represent synthetic group-header ids. Surfaced the new blocker below.
- [x] ~~**`renderRows` / `RenderRow` not implemented**~~ — **resolved 2026-08-07**, [#10](https://github.com/DvirMon/ng-table/issues/10). `RenderRow<TRow>` added to `api/types.ts`; `TableStore.renderRows: Signal<RenderRow<TRow>[]>` implemented on the core store in `api/create-table.ts`, degenerating to a 1:1 wrap of `rows()` (`_buildRenderRows` default) when no grouping is composed. `withGrouping()` can override via the `_buildRenderRows` slot when it lands.
- [x] ~~**Five state-layer features have no UI-layer counterpart at all**~~ — added 2026-07-31, **resolved 2026-08-07.** Each of the five was decided individually: **expansion** gets its own file and one directive (`expansion.md`); **grouping** gets a file but no new directive (`grouping.md`); **filtering** gets neither — consumer form controls; **pagination** and **infinite scroll** are explicitly deferred until their state-layer files are drilled. All five now appear in the inventory tables above. The undercounting framing this question flagged is corrected in the status line.
- [ ] **Presentation fields on `ColumnDef`** — added 2026-07-31. `ColumnDef` has no `width` and no `label`, yet the docs referenced both. Either presentation stays strictly directive-local, or `ColumnDefInput` grows optional presentation fields. Blocks `resizing.md` (see `columns.md`).

- [ ] **Row height / CDK `itemSize` value** — blocks finalizing `virtual-scroll.md`; depends on the full token catalog in `styling-tokens.md`, which hasn't been started as its own session.
- [ ] **Custom header/cell template mechanism** (`ngpColumnHeader`-style) — sketched illustratively in `columns.md`, exact API not finalized.
- [ ] **`ngpTableSort` and `data-sort-direction`** — should the directive expose this as a host binding itself, or leave it fully to consumer-authored logic? Not resolved (see `sort.md`).
- [ ] **Optional standalone sort-icon component** — raised and explicitly parked, not decided (see `sort.md`, `styling-tokens.md`).
- [ ] **Modifier key input name/shape and config scope** (table-wide vs. per-directive) — added 2026-07-21 (see `sort.md`).
- [ ] **Multi-sort priority visual indicator** — elevated 2026-07-21 from a low-stakes deferral to a genuinely load-bearing gap, now that accumulation only happens via a deliberate modifier+click rather than any click sequence (see `sort.md`, `1-state/features/sorting.md`).

## Feature-Specific Open Questions

See each reference file's own "Open Questions" section for issues local to that file.

---

## Carried Over From State Layer (Unresolved)

Per `1-state/architecture.md` — 4 features (`withSelection`, `withPagination`, `withInfiniteScroll`, `withDragDrop`) and 4 cross-cutting questions (selection scope, pagination/infinite-scroll exclusivity, drag-drop vs. active sort, grouping-aggregation vs. filtering) remain open at the state layer. This UI layer session proceeded ahead of resolving them, by explicit decision — the three blocked feature stubs above are where that gap surfaces concretely in the UI layer.

---

## Next Steps

Ordered. Each item is blocked by the ones above it, except where noted as parallel.

1. [x] **Implement `RenderRow` + core `renderRows()`** — **done 2026-08-07**, [#10](https://github.com/DvirMon/ng-table/issues/10). `ngpTableRow` and every row-scoped directive are unblocked.
2. [x] **Decide whether the five unspecced state-layer features need UI-layer directives at all** — **done 2026-08-07.** Verdict per feature recorded in the inventory tables above: expansion (file + directive), grouping (file, no directive), filtering (neither), pagination + infinite scroll (deferred to their state-layer drilling). The UI-layer surface is now fully enumerated.
3. [ ] **Drill `expansion.md`** — the only stub with no blocker left. Smallest remaining drilling session, and it unblocks nothing else, so it can run at any time.
4. [ ] **Resolve the state-layer cross-cutting questions blocking `selection.md` and `drag-drop.md`** — select-all scope (visible vs. entire dataset); drag-reorder vs. active sort. Decisions, no code. Gates 5.
5. [ ] **Drill `selection.md`, then `drag-drop.md`** — needs 4 (behavior). Row identity is already available via `NGP_TABLE_ROW`.
6. [ ] **Run a dedicated styling/tokens session** — resolves `itemSize`/row-height and the full token catalog referenced across `styling-tokens.md` and `virtual-scroll.md`. *Fully independent; can run at any time.* Also feeds `grouping.md`'s `data-depth` indentation question.
7. [ ] **Decide presentation fields on `ColumnDef`** (`width`, `label`) — see Cross-Cutting Open Questions. Gates 8.
8. [ ] **Drill `resizing.md`** — needs 7 (does `[ngpColumnWidth]` override a store value, or is it the only value?).
9. [ ] **Drill `grouping.md`** — drillable on paper now, but its examples can't be verified until `withGrouping()` is implemented, and its indentation question wants 6.
10. [ ] **Decide `toggleSort()` per-call options** — `sort.md`'s modifier-key design is unbuildable against shipped `api/features/with-sorting.ts`. *Independent of everything above*; only blocks shipping sort as specced.
11. [ ] **Revisit pagination + infinite scroll** once `1-state/features/pagination.md` and `1-state/features/infinite-scroll.md` are drilled — deferred 2026-08-07, not decided.
12. [ ] **Decide testing strategy** (carried over from `overview.md`, still open).
13. [ ] **Regenerate this index** (bump version) once all UI layer features + cross-cutting concerns are complete.

Deferred by decision, not scheduled: `aria-live` status message ownership (see Cross-Cutting Open Questions).

---

**Generated by:** Claude Project Spec Interview
