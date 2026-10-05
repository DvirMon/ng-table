---
title: Decisions — column pinning surface
type: decisions
status: P1 decided 2026-09-18; P2–P4 open; pinning itself not committed to
date: 2026-09-18
audience: developers
---

# Column pinning — decisions

Companion to
[`discovery-pinning-under-grouping.md`](discovery-pinning-under-grouping.md), which holds the
evidence, the eight-library comparison and the source table. This file records only what was
decided from it.

**Nothing here commits the library to building pinning.** These decisions say _where it would
live_ if built, and what is still unanswered.

---

- **P1 (2026-09-18) — pinning is a column concern, not a feature.**

  It reads nothing from the row data. Its entire input set is column identity, a per-column side,
  column widths and the viewport. A table with zero rows still renders its pinned regions
  correctly, which is [ADR-0021](../../../adr/0021-column-concerns-and-data-concerns-are-separate-surfaces.md)'s
  operational test.

  Shape, if built: `applyPinned(path.region, 'left')` on the column schema — `applyVisible`'s
  twin, backed by a metadata key the column fold reads — plus a `pinColumn(id, side)` mutation
  verb on `table.columns` for interactive writes.

  **Contrary evidence, weighed and not followed.** Four of eight surveyed libraries store pinning
  at table level: TanStack / MUI X / devextreme-reactive as `{ left: string[], right: string[] }`,
  Handsontable / Syncfusion as a count integer (`fixedColumnsStart`, `frozenColumns`). Only AG
  Grid and DevExtreme are per-column.

  Why it did not change the decision: that evidence is about _storage scope within the column
  layer_, not about the column/data split. No surveyed library's pinning reads row data. The
  count-integer form is in fact _less_ expressive — it only pins a prefix of the column order —
  and adopting a per-column enum forecloses exactly that one shipped design, deliberately.

- **P2 (2026-09-18) — total pinned width does not make pinning a feature.**

  AG Grid ships a grid-level `processUnpinnedColumns` callback because total pinned width vs.
  viewport width is a cross-column invariant. It is real, and it survives any storage choice.

  It is also **derived**, computable from per-column state inside the column fold, and it reads no
  rows. Cross-column is not the same axis as data-dependent — see ADR-0021's rejected
  "state ownership" alternative.

---

## Open

- **P3 — the pinned render model, and this is the one that matters.**

  Two shipped shapes:
  - **Single row, sticky cells** — left/middle/right cells inside one row element (MUI X,
    PrimeNG). Composes with a spanning group row cleanly; no conflict at all.
  - **Region-split** — pinned columns in separate scroll regions (AG Grid, Handsontable's
    `ht_clone_inline_start` overlay clone).

  Region-split is the shape that collides with grouping. A full-width spanning group row has to
  cross the region boundary; AG Grid's answer is that the row spans regardless, and
  `embedFullWidthRows: true` reconciles it by instantiating the renderer **once per region**.

  **This library's grouping uses the spanning-row shape**, which is the one with the conflict.
  Libraries that put the group label in a generated column instead (AG Grid `singleColumn`, MUI X,
  PrimeNG `rowGroupMode="rowspan"`) never meet the problem. Decide the render model before
  committing to pinning, not after.

- **P4 — where does pinned-region order come from?**

  Two answers shipped, each with a stated price:
  - **From the stored array** — MUI X pays by **forbidding reorder of pinned columns**.
  - **From global column order** — AG Grid pays nothing extra.

  A per-column enum gives no pinned-region order on its own, so this must be answered explicitly.
  Which is cheaper depends on whether column order here is already one ordered,
  consumer-reorderable list. It is (`ColumnDef.order` plus `reorderColumns`), which points at the
  AG Grid answer — but that is an inference, not a decision.

- **P5 — does the group column case apply at all?**

  No surveyed library auto-pins a grouping-generated column: MUI X's
  `GROUPING_COL_DEF_DEFAULT_PROPERTIES` sets five defaults and pinning is not among them; AG
  Grid's `autoGroupColumnDef` documents no pinning default. Three libraries sharing an omission is
  one data point about convention, not three about correctness.

  This library generates no group column at all — the label lives in a spanning row — so the case
  may simply not exist here. Confirm that before treating the vendors' silence as guidance.

---

## Caveats on the evidence

Carried forward from the discovery's own Unverified section, so a reader of this file does not
have to open that one to know what is soft:

- Syncfusion's group-caption DOM under frozen columns — not verified structurally.
- DevExtreme `26.1.5` group-row-under-fixed — not verified; the sibling `devextreme-reactive`
  product has a 2019 report of exactly this, closed unimplemented by repo archive in 2026.
- Handsontable's overlay architecture — read from PR search snippets, not source.
- MUI X source claims read at `master`, not at the `v9.14.0` tag.
- The brief said TanStack v8; `@tanstack/table-core` latest is 9.2.4. Version framing in the
  comparison table is the registry's, not v8's.
  </content>
