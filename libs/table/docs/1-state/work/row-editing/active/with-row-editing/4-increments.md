---
title: Increments — Row Editing, sliced for incremental delivery
type: plan
status: proposed
date: 2026-08-13
parent: ./2-decisions.md
---

# Increments — what can ship now, and what stacks on it

Purpose: break the row-editing cluster into slices that each ship something usable, instead of
holding everything behind a complete design. Each slice names its dependencies and the open
questions that genuinely block it — as opposed to open questions that merely *touch* it.

## The finding that reorders everything

`api/features/` contains **only** `with-sorting.ts` and `with-expansion.ts`. There is no
`withFiltering()`, no `withGrouping()`, no pagination.

So several open questions cannot be worked at all, and are not blocking anything:

| Open | Needs | Status |
|---|---|---|
| D25 filter retention, **O15**, **O16** | `withFiltering()` | **phantom** — nothing to exempt a row from |
| **O17** validation scope | filtering or pagination | **phantom** — every row is visible today |

These are not hard problems being deferred. They are problems that do not exist yet. Re-open them
when the stage they depend on is built, and re-derive them then — the decisions recorded now are
predictions about code nobody has written.

What remains is a short, mostly unblocked chain.

---

## E1 — `RenderRow.sourceIndex` (engine)

**Ships:** the ability for a template to reach a row's `FieldTree` node. Nothing else in the
cluster works without it.

**Decision:** D23, fully specified — engine derives it after the render-row builder runs, from
`data` + `trackBy`; `undefined` for synthesized rows.

**Depends on:** #46 (shipped — `data` is the single source of truth).

**Open questions blocking it:** none.

**Scope:** `engine/core.ts` (the `indexById` computed and the stamp pass), `api/types.ts`
(`sourceIndex?: number` on `RenderRow`), tests. Self-contained; no feature touches it.

---

## E2 — The canonical editable-table pattern (docs + demo)

**Ships:** a working editable table. This is the slice that delivers the feature to a consumer.

**Decisions:** D22 (one array form over `data`), D24 (`debounce()` as the commit boundary),
D29 (the minimal table composes no editing feature at all), plus D26/D27 from the mutation
decisions for the add flow.

**Depends on:** E1.

**Open questions blocking it:** none.

**Scope:** no library code. One demo component in `apps/demo/` proving the pattern end to end, and
the state-layer spec section presenting it as *the* starting point:

```ts
readonly data  = signal<Person[]>(people);
readonly table = createTable(this.data, () => ({ trackBy: 'id', columns }));
readonly rows  = form(this.data, (path) =>
  applyEach(path, (row) => {
    debounce(row.name, 'blur');   // text commits on blur
    debounce(row.dept, 0);        // select commits immediately
  })
);
```

**Why this is the highest-value slice:** it is the first point where the design is falsifiable. Every
decision from D22 onward is an inference from reading `@angular/forms` type definitions. E2 is where
`debounce('blur')` is confirmed to actually keep `data` untouched while typing — the claim D24, D29
and the closure of O18 all rest on.

**Do this before building anything else in the cluster.** If `debounce` behaves differently than the
docs read, D24 falls and D20's exemption comes back — which changes E3 and E4 substantially.

---

## E3 — `withRowEdit()`, mode gate only

**Ships:** button-triggered edit mode (F2b) — rows render inputs only when opened.

**Decisions:** D10 (store slice), D14 (`{ multiple }`, default single), D16 (`updateEditing` +
updaters, no store verbs), D21/D29 (it is optional, not required by always-edit tables).

**Depends on:** E2 (a table with no form has nothing to gate).

**Open questions blocking it:** none. **O11** (does a `rowEditChanged` event fire?) is additive —
adding an Observable later breaks nothing, and D18 means no directive can trigger an edit today, so
nothing needs the event yet.

**Verbs shipped:** `beginEdit`, `endEdit`, `clearEditing`. **Not** `revertEdit`.

**Deliberate shape choice:** hold `Map<RowId, TRow | ABSENT>` (D17 + D28's widened type) from the
start, even though nothing reads the snapshot yet. Shipping a `Set` first and widening to a `Map` in
E4 would churn the public signal type for every consumer and directive. Storing an unread snapshot
is a small waste; changing the shape of a shipped signal is not.

---

## E4 — Snapshot revert (`revertEdit`)

**Ships:** Cancel. The row returns to its pre-edit values, or is removed if it never existed.

**Decisions:** D17 (snapshots), D28 (ABSENT derives add-cancel from edit-cancel; the call order
selects the intent).

**Depends on:** E3.

**Open questions blocking it:** **O13** — what happens when `data` changes from another source while
a row is open and the snapshot goes stale. Genuinely blocking, but cheap: pick a documented default
(revert wins / refresh wins / detect and drop) rather than a mechanism. One decision, not a design.

---

## E2b — The gated editing demo *(shipped 2026-08-25)*

**Ships:** the counterpart to E2 — a table where rows render text until Edit opens them, plus the
blank-row add flow and optimistic save. This is where D28's call order and D31's `pending` map are
falsifiable the way E2 made D24 falsifiable.

**Decisions:** D28 (call order selects discard-vs-reset), D31/D31.1/D31.2 (optimistic save), D14
single mode.

**Depends on:** E3, E4, and D31's library work. Uses E5' (`*ngpTableRowField`) to bind fields.

**Scope:** `apps/demo/src/app/table-row-edit-demo/` — a **new** component, not a mode toggle on
`table-edit-demo`, which deliberately composes no editing feature at all (D29) and must keep
showing the minimal table.

---

## E5 — `editableRow()` schema fragment *(optional, any time after E2)*

**Ships:** the commit boundary as one call instead of per-column discipline.

**Open:** **O19** — whether to ship it at all. It imports Signal Forms types into our lib, the
coupling D23 rejected for `fieldFor`, though as an opt-in export rather than a core API type.

**Do not decide this before E2.** Whether the per-column version is actually painful is exactly what
writing the demo reveals. If `applyEach` + two `debounce` lines reads fine, O19 answers itself.

---

## E5' — `*ngpTableRowField` directive *(optional, any time after E2, independent of E5)*

**Ships:** folds E2's `@if (row.sourceIndex !== undefined) { @let field = rows[row.sourceIndex]; }`
into one structural directive line.

**Decision:** D33, fully specified — supersedes D23's directive-clause rejection. Exported from a
secondary entry point (`@ngp/table/forms`), not the root barrel, so the core surface stays
forms-free even at type level.

**Depends on:** E1 (`sourceIndex`), E2 (the pattern it folds). Does not depend on, or block, E5 —
the schema fragment and this directive solve different parts of the ergonomics gap and can ship in
either order or both.

**Open questions blocking it:** none.

**Scope:** `directives/ngp-table-row-field.directive.ts` + `.resolve.ts`, `forms/index.ts` (new
secondary barrel), `tsconfig.base.json` path entry, colocated spec, a standalone demo (not
`table-edit-demo`, per the brief).

---

## E6 — Sort staleness *(design incomplete)*

**Ships:** a signal telling the consumer the sort no longer reflects the data, so they can render
their own re-sort affordance.

**Depends on:** E2, and `withSorting()` (exists).

**Blocked on design, not on other slices.** Two things are unresolved:

1. The granularity question was interrupted and never answered — `staleRows: Signal<Set<RowId>>`
   with `sortStale` derived from it, versus a boolean alone.
2. Holding rows in place while `data` changes means the sort stage can no longer compare live
   values — it must apply a *captured order* (an ordering key per row id, recomputed only when the
   sort is re-applied). That is a different `withSorting()` than the one that exists, and it is
   undesigned. It may also subsume insertion-at-a-display-position, which is why it deserves a real
   design pass rather than a patch.

**Note the tension with D24:** under `debounce('blur')` a committed edit *does* move the row, which
is the behavior chosen for grouping. E6 exists because sorting was chosen to hold position instead.
Confirm that preference still holds after E2 shows the movement in a real demo — it may not survive
contact, in which case E6 disappears entirely.

---

## Order, and why

```
E1  sourceIndex ──► E2  demo + docs ──┬─► E3  mode gate ──► E4  revert
                    (falsifies D24)    ├─► E5  schema fragment (optional)
                                       └─► E6  sort staleness (needs design)

phantom until their stage exists:  D25 / O15 / O16 (withFiltering), O17 (filtering or pagination)
```

E1 and E2 are unblocked today and together deliver a working editable table. E3 and E4 are small and
sequential. E5 and E6 are optional and independent of each other.

**Nothing is circularly blocked.** The cluster's apparent size came from three sources: decisions
about features that do not exist (phantom), decisions superseded before implementation
(D20 → D24, D21 → D29), and one genuinely undesigned piece (E6).

## What shipped, and what is left

E1, E2, E3, E4, E2b and E5' are delivered. The permanent spec for all of it is
[`features/row-editing.md`](../../../../features/row-editing.md).

E5 (`editableRow()` schema fragment) and E6 (sort staleness) remain as written above. Everything
else outstanding is in one of two gap registers, split by owning layer: [`5-gaps.md`](5-gaps.md)
for the state layer, and [`3-ui/work/row-editing/5-gaps.md`](../../../../../3-ui/work/row-editing/5-gaps.md)
for the work this file never sliced — keyboard, focus, a11y, save-gating.

## Standing risk

Everything from D22 onward is inferred from type definitions, not observed. E2 is the cheapest place
to find out we were wrong, and it is the second slice for that reason. Resist building E3–E6 in
parallel with it.
