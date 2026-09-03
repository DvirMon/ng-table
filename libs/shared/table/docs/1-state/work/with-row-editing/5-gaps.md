---
title: Gaps — Row Editing, state layer
type: plan
status: open — state layer only; UI gaps moved 2026-08-26, see the banner
date: 2026-09-03
parent: ./2-decisions.md
---

# Gaps — what editing does not cover yet

Written after E1–E4, E2b and E5' shipped. Every entry is something a consumer building an
editable table hits, or a defect in what was already delivered. Deliberate non-goals are listed
at the end so they are not mistaken for oversights.

Specs this register measures against: [`../../features/row-editing.md`](../../features/row-editing.md)
and [`../../row-mutations.md`](../../row-mutations.md).

> ## Superseded in part — 2026-08-26
>
> Two things happened after this register was written.
>
> **1. Storybook shipped** (`src/stories/`). G12 was written when no demo could reach three
> verbs; four stories now can. See G12 for what actually remains.
>
> **2. The two-feature split shipped** —
> [`work/with-optimistic/2-decisions.md`](../with-optimistic/2-decisions.md), D37–D44, implemented
> 2026-08-26. Optimistic rollback is now `withOptimistic()`, composed internally by
> `withRowEdit()`, so a live table can use it. That changes G3, G4 and G5's framing; each is
> annotated below. **It does not close G5** — the split changes who owns a restore point, not what
> one can express.
>
> Verb names throughout this file are v1.0. `settleEdit` → `releaseEdit`, `rebaseEdit` →
> `captureEdit`, `addNewRow` → `beginEdit({ insert })`, `keepSnapshot` removed.
>
> ## Also superseded — 2026-08-27/28, the product pass
>
> A product pass over editing produced [`0-product/row-editing.md`](../../../0-product/row-editing.md)
> (user stories for both modes across add / duplicate / delete / change-in-place) and resolved seven
> open product questions. Four state-layer efforts came out of it; three have shipped:
>
> | Effort | Closes | State |
> |---|---|---|
> | [`with-optimistic-crud/`](../with-optimistic-crud/2-decisions.md) D45–D48 | **G5's delete half** | shipped 2026-08-27 |
> | [`with-multiple-edit/`](../with-multiple-edit/1-design.md) | **G4** | shipped 2026-08-27 |
> | [`with-duplicate-row/`](../with-duplicate-row/1-design.md) | duplicate; `insertRow`/`clearEdit` renames | shipped 2026-08-27 |
> | [`sorting-null-ordering/`](../sorting-null-ordering/1-handoff.md) | sorting's null defects | shipped 2026-08-27 (`2d13dda`) |
>
> **v2.1 verb renames**, on top of the v1.0 list above: `addRow` → `insertRow`,
> `clearEditing` → `clearEdit`, `ABSENT` removed, and three verbs added — `discardEdit`,
> `removeEdit`, `patchEdit`.

## The split

Docs are numbered by dependency order — state layer (1) → columns (2) → UI (3). A gap belongs to
whichever layer *owns the mechanism*, not whichever layer the user notices it in:

| Layer | Owns | Example |
|---|---|---|
| **State (1)** | what is true about a row: which rows are open, what restores on Cancel, what happens on an id swap | a `pending` entry orphaned by a temp-id swap |
| **UI (3)** | how a person drives it: keys, focus, announcements, affordances | Escape cancels the row |

Keyboard and accessibility are **UI-layer in full**. `revertEdit` exists and works; nothing calls
it from a key handler, and adding that call is directive work — no state-layer change is
involved. Same for focus and announcements.

**Those gaps moved out on 2026-08-26.** G1, G7, G9, G10 and G11 now live in [`3-ui/work/row-editing/5-gaps.md`](../../../3-ui/work/row-editing/5-gaps.md); this file keeps
only what the state layer owns. Each moved entry leaves a one-line stub below so the G-numbering
stays readable against older references.

Two gaps are neither: they are defects in the decision record itself (G8).

---

## Priority 1 — shipped behavior is wrong or incomplete

### G1 — No keyboard story at all — **MOVED 2026-08-26**

UI layer in full. Now in [`3-ui/work/row-editing/5-gaps.md`](../../../3-ui/work/row-editing/5-gaps.md).
No Escape-to-cancel, no Enter-to-save, no Tab containment; the verbs it needs all shipped in E4.

### ~~G2 — A row removed externally while open leaves a dead entry~~ *(state layer)* — **CLOSED 2026-08-25**

**Was:** `revertEdit` restores by mapping over `data`, so a row that is gone matches nothing and
the write is a silent no-op — while the entry is never cleared, leaving the row "open" forever
from the store's point of view. The disposition table already claimed ADR-0006 dissolved this
while ADR-0006 was an unimplemented, untracked file.

**Closed by implementing ADR-0006** — status now `accepted`. `TableFeatureSpec.onRowsRemoved`,
collected in `compose-table.ts` alongside `onInit`/`onDestroy`, fed by an effect diffing
`indexById`; `withRowEdit()` and `withExpansion()` prune via `pruneByIds()` (`engine/rows.ts`).
Tests colocated. The disposition table's claim is now true rather than aspirational.

**What it deliberately does not cover:** the temp-id swap, both halves — see G3.

### G3 — Optimistic create has no identity story *(state layer)*

**Tracked as [#53](https://github.com/DvirMon/acme/issues/53)** (opened 2026-08-26).

**Re-derived 2026-08-25 against the shipped code.** The original entry was wrong on its
mechanism: `snapshots` is a plain `Map` in the feature's own signal, not derived from `data`, so
the temp key survives the swap and `settleEdit(tempId)` still finds it. Nothing is "about to
stop existing". The two real defects are narrower and different:

1. **A pending optimistic create orphans if settled under the server id.** `settleEdit(saved.id)`
   is the natural thing to write and is a silent no-op; the row stays `pending` forever. ADR-0006
   does not clean it either — the snapshot is `ABSENT` (D28), and `ABSENT` is exempt from pruning
   by design, because D28 puts an id in `snapshots` *before* the row exists.
2. **A row swapped while still open silently leaves edit mode.** `open` is not exempt, so
   ADR-0006's reconciliation prunes it on the swap. This is D26's documented failure, still live,
   and it has no consumer workaround.

**Where:** `api/row-edit-mutations.ts`.

**Blocked on:** **O20** (mutation decisions) — enforce the order, migrate the orphaned key, or
document only. Leading candidate is `swapRowId(from, to)`, one editing updater re-keying whichever
of `open`/`snapshots` hold `from`: it covers both defects with one verb and needs no engine
heuristic. Engine-side swap detection was considered and rejected — `{removed: [temp],
added: [server]}` in one recompute is indistinguishable from a delete plus an unrelated insert.

**Also blocked on the D37 split — sequence this after it, not in parallel** (tracked as **O24**).
`open` and `snapshots` end up in different features, so `swapRowId` straddles the boundary the
same way `beginEdit` does. Designing it against the pre-split shape means designing it twice.

---

## Priority 2 — shipped surface is under-specified

### ~~G4 — `{ multiple: true }` is a flag with no design~~ *(state layer)* — **CLOSED 2026-08-27**

**Closed by [`with-multiple-edit/1-design.md`](../with-multiple-edit/1-design.md)** (status:
implemented). Product OQ-7 chose "design the semantics" over "refuse the combination" — refusing was
impractical, since an optimistic flow is a consumer wiring pattern, not config, so there is nothing
to detect at composition time.

**What the design found:** most of "N open rows × M in-flight saves" was already well-defined —
restore points are per row, so partial failure of a batch is three ordinary calls. The real defect
was narrower and had two entry points: `clearEdit()` and the single-mode trim **drop every open
row's restore point**, which under `multiple: true` can discard rollbacks for saves still in flight.
Reachable through the config's own documented idiom `multiple: () => isWide()` — i.e. a window
resize. It is the same loophole D41 closed for `releaseEdit` by refusing it a bulk form.

**Resolution:** bulk edit is optimistic-only (a save closes its row before firing), so an in-flight
row is always `pending` and never `open` — the hazard becomes unreachable with no new state. A mode
flip `true` → `false` now closes **all** open rows rather than keeping the most recently opened one.

**Unblocks O23** (`applyEditable({ when })`) — a predicate matching N rows now has semantics to be
designed against.

**Original text, for history:**

**Partially addressed 2026-08-26.** `src/stories/gated-edit/` now toggles `multiple` live, so the
config has a demo and the live-reaction path is exercised. The *semantics* gap below stands.

**Also narrowed by D39.** A live table's edit session is delimited by focus, which is inherently
single, so D31.2's unsupported combination is now a **gated-table-only** problem.

**What:** the config ships, has no reference implementation beyond that story, and no test beyond
the single-mode trim. D31.2 states outright that `multiple: true` combined with optimistic save is
**undesigned and unsupported** — N open rows × M in-flight saves.

**Why P2:** nothing is wrong today, but the library accepts a configuration it cannot describe
the behavior of. Two ways out, and picking one is the work: design the semantics, or make the
unsupported combination fail loudly at composition time.

**Where:** `api/features/with-row-edit.ts`.

**Blocked on:** whoever specs bulk edit — D32 (mutations) routes bulk *edit* through this
decision.

**Now blocks something too:** **O23** (`applyEditable({ when })`, a declarative openness rule —
see D35). A predicate matching N rows wants N rows open, so a row rule cannot be designed while
`multiple: true` has no semantics. G4 is no longer only a tidiness gap.

### G5 — Optimistic rollback covers update, create, and (now) delete; move stays uncovered *(state layer)*

**Tracked as [#54](https://github.com/DvirMon/acme/issues/54)** (opened 2026-08-26).

**Delete closed 2026-08-27** — [`work/with-optimistic-crud/2-decisions.md`](../with-optimistic-crud/2-decisions.md),
D45–D47. A restore point now carries its index (`RowRestorePoint.at`), and `removeEdit(id)`
captures + removes in one write, so `revertEdit(id)` alone re-inserts it. `ABSENT` is gone
(D46) — the mechanism that made delete unrepresentable no longer exists.

**Move is still uncovered**, and for the reason O22 originally gave: `RowRestorePoint` fixes a
row's *position at capture time*, but no verb reorders rows, and undoing a reorder needs an
inverse-operation representation (from-index/to-index or similar), not a fixed snapshot position.
Re-derive when a `moveRow`/drag-and-drop feature exists — see the product doc's D-2.

**Original text, for history:**

~~**What:** `pending` covers optimistic update (snapshot = prior row) and optimistic create
(snapshot = `ABSENT`). Delete and move are uncovered, structurally: no entry point —
`removeRow(id)` goes through `table.value.update()` and never touches the editing state, so no
restore point is ever captured; `revertEdit` replaces in place and cannot re-insert; a snapshot
holds a **value**, never an index, so position is unrecoverable regardless.~~

**Not closed by the D37 split alone** — that was true until D45. D37 took O22's *ownership* half
(rollback becomes its own feature) and left the *representation* half open; D45–D47 closed the
representation half for delete specifically, leaving move as the one still-open case.

### G13 — `closeAllButLast` may now discard a displaced row's unsaved edit, contradicting D31.2 *(state layer)*

**Where:** `api/features/with-row-edit.ts`, `closeAllButLast()`.

**What:** D31.2 decided single-mode row switching keeps whatever a displaced row's blur already
committed to `data` ("Save, not Cancel" — silently reverting would be the surprise). That
reasoning assumed blur writes `data` directly. Since `with-multiple-edit/`'s `draft` gates the
commit boundary in gated mode (blur no longer writes `data`; a `draft` entry re-derives from
`data` the moment the row is no longer open), a row displaced by `closeAllButLast` now has its
typed-but-uncommitted edit discarded — the opposite of D31.2's outcome — with no decision on
record that this change was intended.

**Why P2, not P1:** nothing crashes and no data is corrupted; the discarded value was never
written to `data` in the first place under the gated/`draft` flow. It is a silent behavior
change from a documented decision, not a defect in what ships today.

**Flagged 2026-09-03** while trimming decision-history narration out of `with-row-edit.ts`'s
comments — the discrepancy surfaced as unresolved product behavior, not documentable history.

**Blocked on:** a product call — is "discard the displaced row's draft" the intended single-mode
outcome under gated/`draft` editing, or should `closeAllButLast` carry the draft forward (e.g.
into the snapshot, or by refusing to displace a row with an unsaved draft)? Tracked as **O26**.

### G6 — Expansion children get no `sourceIndex` *(state layer — engine)*

**What:** `indexById` (`engine/core.ts`) is built from `data()`'s **top-level** entries only. A
nested expansion child has non-null `data` but `sourceIndex === undefined`, so
`*ngpTableRowField` renders nothing for it.

**Why P2:** pre-existing, not introduced by editing — but editing is what makes it visible, and
"editable tree table" is a reasonable thing to ask for.

**Where:** `engine/core.ts`. Needs the children accessor the engine currently does not consult
when building the index.

**Blocked on:** nothing, but it interacts with whatever `withGrouping()` eventually does to
`renderRows`.

> **Rescoped 2026-09-03.** Challenged as a state-layer overreach into consumer-owned expansion UI.
> Verdict: valid, but narrower than written. Detail-panel expansion needs no `sourceIndex` — its
> content is consumer markup, never a render row. G6 is a defect of the **tree** half only, which
> [ADR-0012](../../../adr/0012-split-expansion-into-panel-and-tree.md) moves to a new `withTree()`,
> and [ADR-0011](../../../adr/0011-chained-render-stages.md) reframes as a property of the `'tree'`
> render stage (each stage carries or clears `sourceIndex`) rather than an engine-wide index
> change. Since no story composes the tree path and `depth > 0` appears only in tests, this drops
> below the UI-layer keyboard/focus/a11y work (G1/G9/G10) and largely falls out of implementing
> those two ADRs.

### G7 — Save-gating and dirty state — **MOVED 2026-08-26**

Consumer + UI; no state-layer work. Now in [`3-ui/work/row-editing/5-gaps.md`](../../../3-ui/work/row-editing/5-gaps.md).
The form owns dirty/validity (D1) and `table.editing()` gives the row set — what is missing is the
recipe, not a mechanism.

### G8 — Decision-record defects *(neither layer — docs integrity)*

Three, all cheap, all actively misleading:

**All three fixed 2026-08-25.** Decision numbers are global across this folder and
`../with-mutations/2-decisions.md`, so both collisions were resolved by renumbering on *this*
side, leaving the mutation decisions and the engine `CLAUDE.md` citations untouched:

1. ~~**Two decisions numbered D31 in one file.**~~ `*ngpTableRowField` is now **D33**. Optimistic
   save keeps D31, since D31.1–D31.5 hang off it and the directive decision has no sub-decisions.
2. ~~**D30 is used twice across files.**~~ `rebaseEdit` is now **D34**. The `WritableView` write
   pattern keeps D30 — it is the cross-cutting one, cited by the engine `CLAUDE.md` and
   `row-mutations.md`.
3. ~~**The disposition table claims finding #5 and #6 are dissolved by ADR-0006**, which is
   unimplemented.~~ ADR-0006 is implemented and `accepted`; the claim is now true. See G2.

A collision table at the head of `2-decisions.md`'s renumbered section records both moves, so a
stale cross-reference to "D30" or "D31" resolves rather than silently landing on the wrong
decision.

---

### ~~G12 — Shipped verbs with no demo coverage~~ — **MOSTLY CLOSED 2026-08-26**

**Closed by Storybook** (`src/stories/`, commits `ca5f56f` + `e681fda`). Four stories now cover
what no demo could:

| Was uncovered | Now |
|---|---|
| **`rebaseEdit`** | **closed** — `external-write/` pushes a write to `data` under an open row and calls `rebaseEdit(id, pushed)`. This was the suggested fix below, and it shipped. |
| `clearEditing()` | **closed** — `gated-edit/` has a Close-all button |
| `{ multiple: true }` | **closed** — `gated-edit/` toggles it live |
| D28's reverse order | **dissolved by D36**, not demoed — there is one add path now |
| Pessimistic save | **still open** — every story is optimistic; the row-stays-open-through-the-round-trip path is shown nowhere |
| Single-mode switching (D31.2) | **still open** — reachable, but nothing on screen distinguishes A closing as a Save from a Cancel |

**~~One new gap, from D39~~ — closed 2026-08-26:** the live table + `withOptimistic()` shape now
has `src/stories/live-optimistic/` (S6), driven by focus/blur rather than buttons.

The original entry follows.

**What (2026-08-25):** three demos exist — `table-edit-demo` (E2, live table, composes nothing),
`table-row-field-demo` (the D33 directive), `table-row-edit-demo` (E2b, gated + optimistic).
Between them they exercise `beginEdit`, `endEdit({ keepSnapshot })`, `settleEdit`, `revertEdit`
from both states, and D28's discard order. What no demo could trigger at the time:

| Uncovered | Note |
|---|---|
| **`rebaseEdit`** | shipped public verb, exercised only in unit tests. Its reason for existing is O13 — a restore point going stale from an *external* write — and no demo has an external writer. |
| `clearEditing()` | no affordance anywhere |
| Pessimistic save | E2b is optimistic-only; the row-stays-open-through-the-round-trip path is never shown |
| `{ multiple: true }` | E2b hardcodes single mode |
| D28's reverse order (Cancel = reset, not discard) | lives only in a code comment |
| Single-mode switching (D31.2) | *is* reachable — Edit row A, then Edit row B — but nothing on screen shows that A closed as a Save rather than a Cancel |

**Why it matters beyond tidiness:** E2 and E2b were built to make D24 and D31 falsifiable, and
both found things. `rebaseEdit` has never run outside a unit test, so the same check has not
happened to it.

**One addition covers most of it:** a "simulate server push" control on E2b that writes to `data`
underneath whichever row is open — patch it, and remove it. Patching gives `rebaseEdit` a real
trigger; removing exercises ADR-0006's reconciliation live rather than only in unit tests.

Add **D28's reverse order** to that list as its own affordance now that D35 exists: `addNewRow`
is the discard path, and nothing on screen demonstrates that `addRow` → `beginEdit` still means
reset.

**Where:** `apps/demo/src/app/table-row-edit-demo/`. E2's `table-edit-demo` must keep composing no
editing feature (D29) — it is the reference for the minimal table and is not the place for this.

## Priority 3 — UI layer — **MOVED 2026-08-26**

G9 (focus management), G10 (accessibility beyond keyboard) and G11 (retained-row affordance,
phantom) are now in [`3-ui/work/row-editing/5-gaps.md`](../../../3-ui/work/row-editing/5-gaps.md), alongside G1 and G7.

---

## Not gaps — deliberate

| Not shipped | Why |
|---|---|
| Row actions markup, keyboard, ARIA | D18 — every operation is already expressible through the updaters; an action registry would drag label/icon/ordering into a data-only store. Revisit only on real cross-consumer duplication, and then as a UI directive. |
| Library-detected edit triggers (blur hooks, dirty checking) | D20 — "editing" has exactly one definition: membership in the map. Trigger policy is the consumer's. |
| A store-owned form | D1 — the consumer creates `form(data)` and keeps its full surface. |
| `withRowEdit()` for always-edit tables | D29 — D24 removed the pinning justification; the minimal live table composes nothing. **Narrowed by D39:** still true of `withRowEdit()`, but a live table that wants rollback composes `withOptimistic()`. |
| Pipeline exemption for editing rows | D24 superseded D20's mechanism. `debounce()` holds the row still without the engine knowing who is editing. |
| `moveRow`, bulk arity, `batch()` | D19/D32 — shape settled, no v1 caller; bulk edit additionally blocked on `withSelection()`. |

---

## Open decisions

Every open question that gates a gap in this file, collapsed into one index. **The reasoning stays
in the decision logs** — this table is the answer to "what has to be decided before I can start
G*n*", nothing more. Follow the link before acting on any of them.

| # | Question | Gates | Full text |
|---|---|---|---|
| **O24** | Where does `swapRowId(from, to)` live now that `open` and `snapshots` belong to different features? | **G3** ([#53](https://github.com/DvirMon/acme/issues/53)) — blocking | [with-optimistic](../with-optimistic/2-decisions.md) |
| **O20** | On an id swap: enforce end-edit-first, migrate the orphaned key, or document the sequence? | **G3** — the policy call | [with-mutations](../with-mutations/2-decisions.md) |
| **O22** | *(representation half, delete closed 2026-08-27)* Inverse operation instead of a fixed-position snapshot, so rollback can cover **move**? | **G5** ([#54](https://github.com/DvirMon/acme/issues/54)) — delete no longer blocked | [with-optimistic-crud](../with-optimistic-crud/2-decisions.md) |
| **O23** | Should openness be declarative — `applyEditable({ when })` mirroring `applyVisible()`? | blocked *by* **G4** — a predicate matching N rows forces `multiple: true` | [with-row-editing](./2-decisions.md) |
| **O15** | How does the `filter` stage express "keep these ids even though the predicate rejects them"? | phantom — needs `withFiltering()` | [with-row-editing](./2-decisions.md) |
| **O16** | Where does a *retained* row sit once it no longer matches the filter — in place, or collected? | phantom — same | [with-row-editing](./2-decisions.md) |
| **O11** | Does `withRowEdit()` fire a `rowEditChanged` Observable, or is `editing()` the only notification? | no gap — API surface. Decide with **O6** | [with-row-editing](./2-decisions.md) |
| **O19** | Export an `editableRow(row, columns)` schema fragment so the commit boundary is one call? | no gap — E5 in [`4-increments.md`](./4-increments.md) | [with-row-editing](./2-decisions.md) |
| **O26** | Should a displaced row's unsaved `draft` be discarded (today's behavior) or carried forward when `closeAllButLast` fires? | **G13** | [with-row-edit.ts](../../../../src/api/features/with-row-edit.ts) |

**O17** (`applyEach` validates rows the user cannot see) moved with G7 — see the
[UI register](../../../3-ui/work/row-editing/5-gaps.md).

**O6** (`rowsChanged` event) and **O8** (compile-time feature dependencies, `composed` untyped) are
mutation- and engine-wide, not editing gaps. They live in
[with-mutations](../with-mutations/2-decisions.md).

**Closed since the last pass:** O13→D34, O18→D24, O25→D41+D44, O22's ownership half→D37.

---

## Suggested order

```
G8  docs defects                     DONE 2026-08-25 (D33 / D34 renumber)
G2  dead entry on external removal   DONE 2026-08-25 (ADR-0006 implemented)
G12 demo coverage                    DONE 2026-08-26 (Storybook; pessimistic save remains)
--- the D37 split landed here, 2026-08-26 ---
G3  optimistic create identity       (state, needs the O20 call — swapRowId; after the split, O24)
G4  multiple: true design-or-reject  (state)
G6  expansion child sourceIndex      (engine)
```

### Re-derived 2026-08-28, after the product pass

```
G4  multiple: true semantics         DONE 2026-08-27 (with-multiple-edit/)
G5  delete rollback                  DONE 2026-08-27 (with-optimistic-crud/, D45-D47)
sorting null ordering                DONE 2026-08-27 (sorting-null-ordering/1-handoff.md, 2d13dda)
--- next, in this order (re-derived 2026-09-03) ---
ADR-0011 chained render stages       unblocks withGrouping/withPagination/withSelection
ADR-0012 withExpansion/withTree      depends on ADR-0011
G6  expansion child sourceIndex      (now withTree-only; mostly falls out of ADR-0011/0012)
G3  optimistic create identity       (still blocked on O20 + O24)
G5  move half                        (still blocked on O22's representation; no consumer need)
```

**Not in this register but competing for the same slot:** the UI layer's G1/G9/G10 (keyboard, focus,
a11y) is the largest undesigned item in the whole editing cluster, and every gated table hits it on
the first row a person opens. See the [UI register](../../../3-ui/work/row-editing/5-gaps.md).

### Picking this up cold

1. Read [`0-product/row-editing.md`](../../../0-product/row-editing.md) first — it is the current
   scope statement for editing and carries the resolutions to OQ-1…OQ-7.
2. Then this register and the [UI register](../../../3-ui/work/row-editing/5-gaps.md) for what is
   still missing.
3. `sorting-null-ordering/1-handoff.md` shipped 2026-08-27 (`2d13dda`). One handoff is still ready
   to execute with no open questions:
   [`doc-corrections/1-handoff.md`](../doc-corrections/1-handoff.md).

G5's delete half shipped 2026-08-27 (D45–D47), out of order relative to G3/G4/G6, since a
consumer-visible worst-case failure mode (delete loses the row, no recovery) outweighed the
sequencing. Its move half is still not in the order — no consumer need yet — tracked as
[#54](https://github.com/DvirMon/acme/issues/54).

**The UI-layer order lives with the UI gaps** — G1/G9/G10 are one directive effort, G7 is docs +
demo. See [`3-ui/work/row-editing/5-gaps.md`](../../../3-ui/work/row-editing/5-gaps.md).
