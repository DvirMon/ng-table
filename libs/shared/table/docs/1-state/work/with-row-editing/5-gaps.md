---
title: Gaps — Row Editing, prioritized and split by layer
type: plan
status: open
date: 2026-08-25
parent: ./2-decisions.md
---

# Gaps — what editing does not cover yet

Written after E1–E4, E2b and E5' shipped. Every entry is something a consumer building an
editable table hits, or a defect in what was already delivered. Deliberate non-goals are listed
at the end so they are not mistaken for oversights.

Specs this register measures against: [`../../features/row-editing.md`](../../features/row-editing.md)
and [`../../row-mutations.md`](../../row-mutations.md).

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

Two gaps are neither: they are defects in the decision record itself (G8).

---

## Priority 1 — shipped behavior is wrong or incomplete

### G1 — No keyboard story at all *(UI layer)*

**What:** no Escape-to-cancel, no Enter-to-save, no Tab containment, nowhere in the stack.

Both references bind Escape to revert — MUI X (`stopRowEditMode({ ignoreModifications: true })`)
and AG Grid. We bind nothing. D31.2 flagged this as "missing affordance, noted not decided" and
left it.

**Why P1:** an edit mode without Escape is incomplete, not unpolished. It is also the only P1
item that every single gated table hits, on the first row a user opens.

**Where:** a row-scoped directive in `directives/`, calling the updaters that already exist.
Needs a `docs/3-ui/work/<slug>/` folder and a ticket — no state-layer change.

**Blocked on:** nothing. All the verbs it needs shipped in E4.

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

---

## Priority 2 — shipped surface is under-specified

### G4 — `{ multiple: true }` is a flag with no design *(state layer)*

**What:** the config ships, has no reference implementation, no demo, and no test beyond the
single-mode trim. D31.2 states outright that `multiple: true` combined with optimistic save is
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

### G5 — Optimistic rollback covers update and create only *(state layer, deferred by decision)*

**What:** `pending` covers optimistic update (snapshot = prior row) and optimistic create
(snapshot = `ABSENT`). Delete and move are uncovered, structurally:

- no entry point — `removeRow(id)` goes through `table.value.update()` and never touches the
  editing state, so no restore point is ever captured;
- `revertEdit` replaces in place and cannot re-insert;
- a snapshot holds a **value**, never an index, so position is unrecoverable regardless.

A table with a Delete button and no editing feature (D18 — actions are consumer template code)
has no rollback story at all.

**Status: deliberately not designed** (decided 2026-08-25, recorded as **O22**). Option 2 there —
a pending-mutations slice holding an *inverse operation* rather than a value snapshot — needs a
representation the library does not have, and no consumer needs optimistic delete yet.

**Listed here so it is visible, not to schedule it.** Re-derive when a consumer needs it. Read
O22 against ADR-0006 (which locks in "no optimistic delete" rather than fixing it) and against
D32 (a batched write is one rollback unit, not N).

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

### G7 — Save-gating and dirty state are unaddressed *(consumer + UI; no state-layer work)*

**What:** F5 (dirty / validation / commit) was in this cluster's stated scope and nothing
addresses it. There is no documented recipe for disabling Save while a row is invalid, no
table-level "any row dirty" signal, and no unsaved-changes guard. E2b validates server-side
only.

**Why it is not a state-layer gap:** the form already owns dirty, touched and validity (D1), and
`table.editing()` already gives the row set. Everything needed exists; what is missing is the
recipe and, for a "Save all" affordance, a UI component.

**Where:** a section in [`features/row-editing.md`](../../features/row-editing.md) plus a demo
addition. **O17** (validation scope — `applyEach` validates rows the user cannot see) stays
phantom until filtering or pagination exists.

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

### G12 — Shipped verbs with no demo coverage *(demo app)*

**What:** three demos exist — `table-edit-demo` (E2, live table, composes nothing),
`table-row-field-demo` (the D33 directive), `table-row-edit-demo` (E2b, gated + optimistic).
Between them they exercise `beginEdit`, `endEdit({ keepSnapshot })`, `settleEdit`, `revertEdit`
from both states, and D28's discard order. What no demo can trigger:

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

## Priority 3 — UI layer, after G1

### G9 — Focus management *(UI layer)*

Nothing moves focus into the row on `beginEdit`, and nothing restores it to the Edit button on
close. Related: D26 notes that the temp-id swap destroys and recreates the `<tr>`, taking focus
inside it with it.

### G10 — Accessibility beyond keyboard *(UI layer)*

No announcement of edit-mode entry or exit, no `aria-*` contract for an editing row, no
error-association pattern for a failed save. `ColumnDef.statusMessage` is drafted in specs and
not wired to anything.

WCAG exposure is already documented in the research: 3.2.2 On Input for a row that moves or
vanishes mid-interaction — D24 removes the mid-typing case, but a committed edit still moves the
row with no announcement.

### G11 — Retained-row affordance *(UI layer — phantom)*

D25 says a row edited out of the active filter stays visible and flagged until the filter
changes. It needs a chip or muted styling so the user can tell why an out-of-filter row is
showing. **Phantom** — `withFiltering()` does not exist. Do not build from these notes;
re-derive when the stage does.

---

## Not gaps — deliberate

| Not shipped | Why |
|---|---|
| Row actions markup, keyboard, ARIA | D18 — every operation is already expressible through the updaters; an action registry would drag label/icon/ordering into a data-only store. Revisit only on real cross-consumer duplication, and then as a UI directive. |
| Library-detected edit triggers (blur hooks, dirty checking) | D20 — "editing" has exactly one definition: membership in the map. Trigger policy is the consumer's. |
| A store-owned form | D1 — the consumer creates `form(data)` and keeps its full surface. |
| `withRowEdit()` for always-edit tables | D29 — D24 removed the pinning justification; the minimal live table composes nothing. |
| Pipeline exemption for editing rows | D24 superseded D20's mechanism. `debounce()` holds the row still without the engine knowing who is editing. |
| `moveRow`, bulk arity, `batch()` | D19/D32 — shape settled, no v1 caller; bulk edit additionally blocked on `withSelection()`. |

---

## Suggested order

```
G8  docs defects                     DONE 2026-08-25 (D33 / D34 renumber)
G2  dead entry on external removal   DONE 2026-08-25 (ADR-0006 implemented)
G12 demo coverage       ← gives rebaseEdit its first real run outside a unit test
G3  optimistic create identity       (state, needs the O20 call — swapRowId)
G1  keyboard                         (UI — own work folder + ticket)
G9  focus            ──┐
G10 a11y             ──┴─ same directive effort as G1; scope together
G4  multiple: true design-or-reject  (state)
G6  expansion child sourceIndex      (engine)
G7  save-gating recipe               (docs + demo)
```

G5 and G11 are not in the order — one is deferred by decision, the other is phantom.

**G1, G9 and G10 are one effort, not three.** They share a directive, a work folder and a
ticket; splitting them produces a keyboard handler with no focus story, which is worse than
neither.
