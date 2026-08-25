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

### G2 — A row removed externally while open leaves a dead entry *(state layer)*

**What:** `revertEdit` restores by mapping over `data`
(`data.map(row => trackBy(row) === id ? snapshot : row)`). A row that is gone matches nothing, so
the write is a **silent no-op** — and the map entry is never cleared, so the row stays "open"
forever from the store's point of view.

**Why P1, and why it is easy to miss:** the E3/E4 review raised this as finding #5, and the
disposition table marks it *"Dissolved by ADR-0006 — the entry is reconciled away at removal, so
the case cannot arise."* **ADR-0006 is not implemented.** It is an untracked, deferred file. So
the record reads resolved while the code still has the defect.

**Where:** `api/features/with-row-edit.ts` (the reconciliation effect ADR-0006 specifies), or a
narrower fix in `revertEdit`.

**Blocked on:** the ADR-0006 decision — it touches shipped `withExpansion()` and was deferred to
its own PR. **First action is not code:** correct the disposition table so it stops claiming a
fix that does not exist.

### G3 — Optimistic create has no identity story *(state layer)*

**What:** D26 says the consumer supplies a temp id. `pending` is keyed by it. The server returns
the real id, and nothing carries the `pending` entry across the swap — `settleEdit(tempId)` is
settling a key that is about to stop existing.

D26's recommended order (`endEdit` first, *then* `patchRow` the new id in) makes the orphaning
harmless. **The optimistic path cannot follow that order** — the whole point is that the row
closed before the server answered, so the swap arrives after `endEdit` has already moved the
entry into `pending`.

**Why P1:** optimistic *create* shipped in E2b. Its identity story did not. This is a real
sequence a consumer will write.

**Where:** `api/row-edit-mutations.ts`. Candidates: `settleEdit(tempId, serverId?)` doing the
swap as one write, or the ADR-0006 reconciliation covering it.

**Blocked on:** **O20** (mutation decisions) — enforce the order, migrate the orphaned key, or
document only. O20 was written before optimistic save existed and should be re-read with it in
mind.

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

1. **Two decisions numbered D31 in one file.** `2-decisions.md` has *"D31 — Optimistic save"*
   (line ~606) and *"D31 — `*ngpTableRowField`"* (line ~786). Any cross-reference to "D31" is
   ambiguous.
2. **D30 is used twice across files.** `rebaseEdit` here; the `WritableView` write pattern in the
   mutation decisions, which the engine `CLAUDE.md` also cites. Already flagged in the file, not
   yet fixed.
3. **The disposition table claims finding #5 and #6 are dissolved by ADR-0006**, which is
   unimplemented. See G2.

Renumber before an agent reads two of these files in one session and silently conflates them.

---

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
G8  docs defects        ← cheapest, and G2 is invisible until this is done
G2  dead entry on external removal   (state, needs the ADR-0006 call)
G3  optimistic create identity       (state, needs O20 re-read)
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
