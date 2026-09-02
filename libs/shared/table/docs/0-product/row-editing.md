---
title: Product — Row Editing User Stories
type: product
status: OQ-1…OQ-7 resolved 2026-08-27. Shipped since: optimistic delete rollback (D45–D47),
  multiple-open semantics (with-multiple-edit), duplicate row (gated), sorting null/empty ordering.
  Remaining work is UI-layer (G1/G9/G10 keyboard/focus/a11y) and three leftover doc corrections
  (see doc-corrections/1-handoff.md).
date: 2026-08-27
audience: product, design, engineering
---

# Row Editing — user stories

What a person sitting in front of an editable table needs to be able to do, and what they should
experience when it goes wrong. Engineering derives API from this document, not the reverse.

> **Ownership.** This file is maintained by the product pass and carries the resolutions to OQ-1…
> OQ-7. State-layer efforts should **link** to it, not rewrite it — coverage marks here are updated
> from the product side as capabilities land.

## Scope

**Editing means full CRUD**: add a row, duplicate a row, delete a row, change values in place. The
codebase splits these across `withRowEdit()`, `withOptimistic()` and core row mutations for
implementation reasons. That split is invisible to the person using the table and is ignored here.

Two modes, genuinely different products:

| Mode | What the person sees |
|---|---|
| **Gated (by-row)** | Row is read-only text. An Edit affordance opens it. Explicit end: Save or Cancel. |
| **Live** | Every row is always an input. No Edit button. The "session" is wherever focus happens to be. |

Where the two modes need different answers to the same need, they get separate stories rather than
one story that papers over the difference.

## Coverage marks

| Mark | Meaning |
|---|---|
| ✅ **covered** | Demonstrable today in `src/stories/` or a demo app, with the failure path included |
| 🟡 **partly covered** | The mechanism exists but the person's experience of it does not — no affordance, no message, no recipe, or the happy path only |
| ❌ **not covered** | Nothing on screen anywhere; or structurally impossible with what ships |

Coverage was judged against the six stories in `src/stories/`, the two demo apps, and the two gap
registers ([state](../1-state/work/with-row-editing/5-gaps.md),
[UI](../3-ui/work/row-editing/5-gaps.md)). Coverage is **not** a scope limit — the uncovered
stories are the point of the document.

---

# 1. Change values in place

Ordered by how badly the person is hurt if it is missing.

## 1.1 — Correct a wrong value and keep it *(both modes)* — ✅ covered

> As someone correcting a shipping address that was typed wrong, I want to click into the address
> cell, fix the street number, and have my correction stick — without leaving the table, opening a
> side panel, or losing my place in the list.

**Acceptance criteria**

- *Gated:* the row shows plain text with an Edit affordance. Activating it turns that row's
  editable cells into inputs, all at once, and the row keeps its position on screen while I do it.
  Save returns the row to text showing my new value.
- *Live:* the cell is already an input. I type; my typing appears in the cell immediately.
- Both: while I am typing, **no other row on screen moves, disappears, or changes**.
- Both: after the value is committed, the value shown in the row is the value I typed, not a
  round-tripped, reformatted, or reverted version of it.

**Failure behavior**

- If the save fails, the row returns to the value it had before I started, and I am told the save
  failed and why, near the row — not only in a corner toast that is gone before I look up.
- If the save is slow, the row shows that it is still saving, and I can keep working elsewhere in
  the table while it resolves.
- If the row is still saving and I edit it again, my newer input is not overwritten by the outcome
  of the older save. (Consumer policy — see OQ-4; the table exposes `pending()` to make it
  guardable.)

**Mode note.** Gated has one commit point (Save). Live commits per field when I leave the field.
The person's mental model differs accordingly: in gated mode the whole row is one unit of work; in
live mode each cell is.

**Coverage:** gated — `gated-edit/`, `optimistic-save/`, `table-row-edit-demo`. Live —
`live-table/`, `live-optimistic/`, `table-edit-demo`. Failure path shown in both optimistic
stories. Per-row error placement is not: 🟡 for the error-message half (UI gap G10).

## 1.2 — Abandon an edit and get the old value back *(gated only)* — ✅ covered

> As someone who started editing the wrong row, I want to back out and have the row exactly as it
> was, without remembering what it said.

**Acceptance criteria**

- A Cancel affordance is visible for the whole time the row is open — I do not have to guess that
  clicking elsewhere cancels.
- Cancel restores **every** field of the row, not just the one I last touched.
- Cancel restores the value the row had when I opened it, even if I opened it, typed, tabbed
  between several cells, and paused.
- After Cancel the row is read-only again and nothing about it is marked as changed.

**Failure behavior**

- If the row changed underneath me while it was open (a colleague's save, a background refresh),
  Cancel must not resurrect stale data over their newer value silently — see §1.5.
- If the row was deleted underneath me while it was open, Cancel closes the editor rather than
  re-creating a deleted row, and I am told the row is gone.

**Mode note — live has no equivalent, and this is the sharpest product difference between the
modes.** There is no session to cancel: the last committed value *is* the value. A live table
therefore needs §1.3 (undo) to give a person any way out of a mistake. Treating "live mode has no
Cancel" as acceptable without shipping undo leaves the live table with **no** recovery path.

**Coverage:** ✅ for the mechanism (`gated-edit/`, `external-write/`). The stale-data half of the
failure behavior is 🟡 — the story shows the consumer resolving it manually, and the person is never
told a conflict happened.

## 1.3 — Undo my last change *(live especially; both)* — ❌ not covered

> As someone who tabbed out of a cell after typing into the wrong row, I want to press Undo and put
> the value back, because in this table there was never a Cancel button to press.

**Acceptance criteria**

- An Undo affordance is reachable from the keyboard (⌘Z / Ctrl+Z) and visible somewhere persistent
  — not only in a toast that expires.
- Undo restores the previous value **and** scrolls the affected row into view and highlights it, so
  I can see what was undone.
- Undo of a committed change is itself a change: if the first change was saved to a server, the
  undo is saved too, and can fail like any other save (§1.1's failure behavior applies recursively).
- Undo history is per-person and per-session, not shared, and never resurrects a change someone
  else made.

**Failure behavior**

- If the row I am undoing has since been changed by someone else, undo is refused with an
  explanation rather than clobbering their value.
- If the row has since been deleted, undo of a *value* change does nothing and says so.

**Coverage:** ❌. No undo of any kind exists in any story or demo. In live mode this is a P1 hole,
not a nicety — see §1.2's mode note. Related: §3.2 (undo a delete) is the same affordance and
should be one feature, not two.

## 1.4 — Know a row is saved, saving, or failed *(both)* — 🟡 partly covered

> As someone editing a table connected to a slow backend, I want to know at a glance which of my
> changes have actually landed, so I do not close the tab on unsaved work.

**Acceptance criteria**

- A row with an in-flight save is visibly distinct from a settled row, at row level (not a
  page-level spinner).
- The state is announced to a screen reader, once per transition, not on every keystroke.
- When every save has settled, nothing lingers — no permanent "saving" badge on a table that never
  touches a server.
- If I try to leave the page with unsaved or failed changes, I am warned.

**Failure behavior**

- A failed save leaves a persistent, dismissible marker on the row. It does not silently revert and
  leave no trace — a silent revert reads as "my typing did not register" and the person types it
  again.
- Retry is available from the row itself.

**Coverage:** 🟡. `live-optimistic/` renders a per-row state column and `pending()` exists, so the
mechanism is there. What is missing: the announcement (G10), the leave-page warning, retry, and a
documented recipe (G7). Note the state layer's own accepted cost — a local-only save flickers
through `pending` for one tick, which would show a "saving" flash on a table with no server.

## 1.5 — Be told when someone else changed the row I am editing *(both)* — ❌ not covered

> As someone editing an order that a colleague is also working on, I want to be told their change
> arrived, and to choose whose version wins — not to discover afterwards that I overwrote them, or
> that my edit was silently thrown away.

**Acceptance criteria**

- When an external change arrives for the row I have open (gated) or focused (live), the row is
  marked as changed underneath me.
- I am shown **what** changed, per field, not just that something did.
- I choose: keep mine, take theirs, or merge field by field. The default when I do nothing is
  never a silent overwrite in either direction.
- If the external change is for a row I am *not* editing, it applies quietly and does not steal
  focus or move my cursor.

**Failure behavior**

- If a conflict is detected only when I hit Save (server-side version check), the save is refused
  with the same choice offered, and my typed values are not lost while I decide.

**Coverage:** ❌ as a user experience. The library's position is explicitly that it cannot tell an
external write from any other data change, and the consumer resolves it by calling `captureEdit`
(D34/D40). `external-write/` demonstrates the consumer doing this — with **no on-screen indication
to the person that anything happened**. That is the gap: the plumbing is covered, the story is not.

## 1.6 — Drive the whole edit from the keyboard *(gated primarily; live for Escape)* — ❌ not covered

> As someone entering fifty corrections in a row, I want to work through the table without
> reaching for the mouse.

**Acceptance criteria**

- Enter (or a documented equivalent) on a focused row opens it; Enter within the row saves it.
- Escape cancels the open row (gated) or reverts the field I am in (live).
- Tab moves between cells within the open row and does not escape into the rest of the page
  mid-edit.
- Opening a row moves focus into its first editable cell. Closing a row returns focus to the
  affordance I opened it from — not to the top of the page.
- Every state transition (opened, saved, cancelled, failed) is announced.

**Failure behavior**

- If a save fails while focus has already moved on, focus is **not** yanked back; the row is
  marked and reachable.
- If the row is destroyed and recreated (an id swap after a server-assigned id arrives), focus is
  not lost. This is a known defect today.

**Coverage:** ❌. UI gaps G1 (keyboard), G9 (focus), G10 (a11y) — none of it exists anywhere in the
stack. Both reference implementations (MUI X, AG Grid) bind Escape. Rated P1 in the UI register and
agreed here: an edit mode with no Escape is incomplete, not unpolished.

## 1.7 — Be stopped from saving something invalid *(both)* — ❌ not covered

> As someone typing a quantity into a stock table, I want the table to stop me at the cell rather
> than let me save and hand me a server error thirty seconds later.

**Acceptance criteria**

- An invalid cell is marked at the cell, with the reason, while I am still in the row.
- *Gated:* Save is disabled, or gives the reason on activation, while the row is invalid.
- *Live:* an invalid value is not committed; the cell holds it and stays marked until I fix or
  revert it. The rest of the table is unaffected — one bad cell does not block edits elsewhere.
- Validation errors are associated with their inputs for screen readers.

**Failure behavior**

- A server-side validation failure lands on the specific field the server complained about, not as
  a generic row-level error.

**Coverage:** ❌. G7 in the UI register: the form owns validity and the table exposes the open-row
set, so everything needed exists, but there is no recipe, no save-gating, no cross-row "any row
invalid" signal, and the demo validates server-side only.

## 1.8 — Edit several rows before committing *(gated only)* — 🟡 partly covered

> As someone reclassifying twenty records, I want to open several rows, make all the changes, then
> save once — rather than a round trip per row.

**Acceptance criteria**

- Multiple rows can be open at once, and I can see which.
- A single commit affordance covers all open rows; it reports which succeeded and which failed.
- Cancelling all open rows at once is possible and asks for confirmation, because it discards more
  than one row's work.

**Failure behavior**

- A partial failure leaves the failed rows marked with their reason and recoverable; successful rows
  settle. The table does not roll all of them back because one failed.
- *Refined by the design (2026-08-27):* Save All **closes every row it saves**, so each row shows its
  own saving state and a failure reopens or marks that row alone. Rows do not stay open across the
  round trip — N open editors the person must not touch, with no indication which are still live, is
  the failure mode this avoids.

**Mode note.** Gated only. In live mode the session is wherever focus is, which is inherently one
row, so there is no multi-row session to commit.

**Coverage:** 🟡. `multiple: true` ships and `gated-edit/` toggles it live. Semantics are now
designed and shipped — [`with-multiple-edit/1-design.md`](../1-state/work/with-multiple-edit/1-design.md):
bulk edit is optimistic-only (a save closes its row before firing), so the N-open-rows ×
M-in-flight-saves hazard is unreachable with no new state, and a mode flip `true` → `false` now
closes every open row rather than stranding one. What is still missing is the "save all" affordance
itself — a UI component, not a state-layer gap.

---

# 2. Add a row

## 2.1 — Add a record without leaving the table *(both)* — ✅ covered (gated) / 🟡 (live)

> As someone entering a new supplier, I want a blank row to appear where I can see it, with my
> cursor already in the first field, so I can start typing.

**Acceptance criteria**

- The new row appears **in view** — not appended below the fold of a thousand-row table.
- *Gated:* the new row appears already open, with Save and Cancel, without a separate Edit click.
- *Live:* the new row appears as inputs like every other row; focus lands in the first editable
  cell.
- The row is visually distinguishable as new/unsaved until it is committed.
- Nothing else on screen moves.

**Failure behavior**

- If creating the record fails on the server, the blank row **and my typed values** are still
  there, marked as failed, so I can retry without retyping.
- If a required field is empty, §1.7 applies.
- If the server assigns its own id on save, nothing visible changes — the row does not blink,
  re-render, lose focus, or drop out of edit mode.

**Coverage:** gated ✅ for the add-and-fill flow (`gated-edit/` "Add row", inserted at index 0).
Live 🟡 — `live-table/` has an Add row button, but focus does not land in it and it is not marked as
new. The server-id half of the failure behavior is ❌ today: the temp-id swap silently drops the row
out of edit mode and destroys focus (G3 / [#53](https://github.com/DvirMon/acme/issues/53)).

## 2.2 — Find the row I just added, under a sort *(both)* — ❌ not covered

> As someone adding a row to a table sorted by name, I want the blank row to stay where I can see
> it until I have filled it in — not to jump to wherever an empty name sorts.

**Acceptance criteria**

- A newly added, not-yet-committed row holds its on-screen position for the duration of the fill.
- On commit it moves to its sorted position, visibly — it does not silently teleport off screen.
- If it lands off screen, I am told where it went and can jump to it.

**Coverage:** ❌. The comparator half is now fixed — `applySortNulls()` gives a blank row a
predictable, direction-stable placement (§5, S-2). What remains is holding the row's on-screen
position for the duration of the fill (OQ-3's row-hold), which is designed but not implemented.
Tagged to sorting in §4, but listed here because the person meets it during Add.

## 2.3 — Add several rows in a run *(both)* — ❌ not covered

> As someone entering a batch of ten new records from a printed list, I want each Save to leave me
> ready to type the next one.

**Acceptance criteria**

- A commit affordance that saves and immediately opens a fresh blank row below the one just saved.
- Rows accumulate in the order I entered them while I am still adding.
- The run ends explicitly (Escape, or an empty row committed), not by guessing.

**Coverage:** ❌. Nothing anywhere shows a repeat-add flow.

---

# 3. Delete a row

## 3.1 — Remove a record I do not want *(both)* — 🟡 partly covered

> As someone clearing a cancelled order out of a list, I want to remove that row and see it go.

**Acceptance criteria**

- The delete affordance is on the row, and it names what it deletes (screen-reader label includes
  the row's identity, not just "Delete").
- The row disappears immediately on activation. Rows below close the gap without the rest of the
  table jumping.
- Deleting a row does not change the values, dirty state, or edit state of any *other* row.

**Failure behavior**

- If the server refuses the delete, the row **comes back where it was**, and I am told why. It does
  not stay gone with the failure reported elsewhere.
- If the row was already deleted by someone else, the outcome I see is the same (it is gone) and I
  am not shown an error for having wanted what already happened.

**Coverage: ✅ for the mechanism and the failure path, shipped 2026-08-27** (D45–D47,
[`1-state/work/with-optimistic-crud/2-decisions.md`](../1-state/work/with-optimistic-crud/2-decisions.md)).
`removeEdit(id)` captures row + position and removes the row in one call; a failed delete rolls
back via `revertEdit(id)`, no consumer bookkeeping required. `src/stories/live-optimistic/` now
demonstrates it end to end — Delete button, simulated server failure, row reappearing. "Delete
failed, row lost" is no longer the shipped behavior.

**Still 🟡 for the surrounding UX:** the screen-reader label naming what's deleted, and telling the
person *why* a delete failed near the row rather than in a corner toast, are UI-layer work not
covered by this change (G10). The state layer's part — recover the row, expose that it happened —
is done.

## 3.2 — Undo a delete *(both)* — ❌ not covered

> As someone who deleted the wrong row, I want it back — with everything it had in it, where it
> was — without re-typing it or finding it in an audit log.

This is deliberately worked out here because the docs do not reach it.

**Acceptance criteria**

- **The affordance:** an Undo action that persists long enough to be used — reachable by keyboard
  (⌘Z / Ctrl+Z) and from a visible control. A five-second toast alone is not sufficient: a person
  who deleted the wrong row usually notices after they look back at the list.
- **Where the row reappears:**
  - *No sort active:* at its original index. Adjacent rows are the ones that were adjacent before.
  - *Sort active:* wherever the sort puts it — which may not be where it was. Restoring it to its
    old *visual* slot would contradict the sort. Therefore the row is **scrolled into view and
    briefly highlighted**, so the person sees it return even when it returns elsewhere. *(Split by
    layer per OQ-2: the state layer exposes which rows just returned; a UI directive does the
    scrolling and flashing.)*
  - *Filter active and the row no longer matches:* it comes back and stays visible, flagged as not
    matching, until the filter next changes — the same retention rule as a row edited out of the
    filter (D25). Restoring a row into invisibility reads as "undo did nothing".
- **What comes back:** the whole row, including values that were never displayed in a visible
  column, and its selection/expansion state if it had any.
- **Ordering:** undo is last-in-first-out over my own actions. It does not reach across to
  someone else's deletes.
- **Confirmation vs. undo:** undo is the primary safety net; a confirmation dialog on every delete
  is not, because people learn to dismiss it. Confirm only for bulk deletes (§3.3).

**Failure behavior**

- The un-delete is itself a server write and can fail: if it does, the row does not reappear, the
  failure is explained, and the undo stays available to retry.
- If the row's id was reused or a conflicting row now exists, undo is refused with an explanation
  rather than creating a duplicate.
- If the underlying data set has been re-fetched since the delete, undo still works — it does not
  depend on a client-side index that a refresh invalidates.

**Coverage:** ❌ for the affordance — unbuilt — but the mechanism it needs **shipped 2026-08-27**
(D45–D47). `RowRestorePoint` gives a snapshot a position, so "put the row back where it was" is
representable and implemented: `removeEdit(id)` + never calling `releaseEdit(id)` is the undo-a-
delete state, and `revertEdit(id)` performs the undo. `pending()` already reports exactly the set
of undoable deletes — no new state-layer surface is needed. What remains is genuinely product
work: the **affordance** (where Undo lives, how long it lasts, keyboard binding) and OQ-2's answer
for the sorted case.

Product position unchanged: §3.1's failure behavior and this story are the same mechanism, and §3.1
is not shippable without it. Undo for delete and undo for value changes (§1.3) should be designed
together — one history, one affordance.

## 3.3 — Delete several rows at once *(both)* — ❌ not covered

> As someone clearing out fifty archived records, I want to select them and delete them in one go,
> and undo that in one go too.

**Acceptance criteria**

- Selection is visible, counted ("50 selected"), and clearing it is one action.
- One confirmation for the batch, naming the count — not fifty confirmations and not none.
- Undo restores the entire batch as a single step, not fifty steps.

**Failure behavior**

- Partial failure states plainly how many were deleted and how many were not, and which. Rows that
  failed remain, marked.

**Coverage:** ❌. There is no selection feature; bulk shape is settled in the API decisions
(widened arity plus a batching write) but has no caller. Tagged to selection in §4.

---

# 4. Duplicate a row

## 4.1 — Copy an existing record and change a couple of fields *(both)* — ✅ covered (gated) / ❌ (live)

> As someone entering next quarter's version of an existing contract, I want to duplicate the
> current one and change the two fields that differ, instead of retyping fourteen fields.

**Acceptance criteria**

- The duplicate affordance is on the row being copied.
- The copy appears **immediately below its source**, not at the top and not appended — proximity to
  the source is the whole point of the operation, and the person needs to compare the two.
- The copy is visibly marked as new and unsaved.
- *Gated:* the copy appears already open. *Live:* focus lands in its first editable cell.
- Fields that must be unique (identifiers, names, codes) are visibly flagged as needing a change,
  rather than being silently blanked out or silently copied into a collision.

**Failure behavior**

- If the copy fails to save, both rows remain: the source untouched, the copy marked as failed with
  my edits intact.
- If the source row changes or is deleted after I started the copy, the copy is unaffected — it is
  its own row from the moment it appears.

**Coverage: gated ✅, shipped 2026-08-27** — [`1-state/work/with-duplicate-row/1-design.md`](../1-state/work/with-duplicate-row/1-design.md),
`src/stories/gated-edit/` "Duplicate" action. No new library API: `beginEdit(newId, { insert:
{...source}, at: sourceIndex + 1 })`, the blank-row flow with a different starting value. The copy
lands directly below its source, opens already open, and the copied `name` is flagged as needing a
change rather than silently copied into a collision.

**Live ❌.** A real gap remains — no insert-with-rollback verb exists, so an optimistic duplicate has
no restore point unless the consumer hand-rolls one.

**One acceptance criterion above cannot be met under an active sort.** "The copy appears immediately
below its source" is storage order; the pipeline reorders it, and no insertion index can target a
display position. It holds when no sort is active, and otherwise wants OQ-3's row-hold — duplicate
is the strongest case for that hold, since comparing source against copy is the whole point of the
operation.

## 4.2 — Cancelling a duplicate versus cancelling an add *(both)* — ❌ not covered, and the current default is wrong for both

The brief asks whether these should behave the same. Working it through:

|  | Add | Duplicate |
|---|---|---|
| Starts from | nothing | an existing row |
| Person's intent on Cancel | "forget it, I did not mean to add" | "forget it, I did not mean to copy" |
| A "reset" result | an empty row still sitting there | a row that is still a full copy of its source |
| Is the reset result useful? | no — an empty row is litter | no — a stray duplicate is *worse* than litter; it looks like real data |

**Resolved 2026-08-27: the library takes no position.** Both outcomes are legitimate product
choices — some tables want the row kept, some want it gone — and the consumer owns both the Cancel
button and its handler. The table's job is to make each outcome equally cheap to express, not to
pick one. Add and duplicate are still the same story in this respect: whatever a product decides for
one, it will want for the other.

**Acceptance criteria**

- Whichever outcome the product chose, Cancel on a just-added or just-duplicated row is **one
  call**, not a composed sequence — discard and reset cost the same.
- Cancel on a row that **existed before** I opened it restores it and keeps it (§1.2) — the
  difference the person perceives is "was this row here before I clicked?", nothing else.
- If the product chose removal, that removal is undoable through the same undo as §3.2, so a
  mis-click is not destructive.

**Coverage:** ❌ for duplicate (does not exist). For add: 🟡 — both behaviors are reachable, but they
are not equally cheap: reset is one call, removal is three composed calls. That asymmetry is the
remaining work, not the choice of default.

---

# 5. Cross-feature interactions

Editing collides with other features. **Each story below belongs to the feature that has to change
its behavior to resolve the collision**, not to editing. Only sorting is built today.

## Owned by sorting *(built)*

### S-1 — A row must not move while I am working in it — 🟡 partly covered *(gated behavior decided, OQ-3)*

> As someone fixing a name in a table sorted by name, I want the row to stay under my cursor while
> I type, and I want to know where it went when it moves.

**Acceptance criteria**

- Typing never re-sorts.
- When the value does commit and the row moves, the move is perceptible: the row is followed
  (scrolled into view) or its departure is announced. It does not vanish silently.
- Re-sorting triggered by *me* (clicking a header) while a row is open does not lose my in-progress
  edit.

**The existing engineering decision, examined as asked.** D24 delays a text field's commit until
the field loses focus, so the row cannot re-sort mid-keystroke. **Confirmed as far as it goes** —
it is what the person wants while typing, it matches both reference grids, and it falls out of the
data model rather than needing a rule.

**Where it is not what the person wants:** the commit boundary is the **field**, not the **row**.
In gated mode, tabbing from the name cell to the next cell in the same row commits the name — and
the row can re-sort out from under the cursor **mid-row-edit**, while I am still working in it. The
person's unit of work is the row (they were shown Save and Cancel; that is a row-level contract),
so the position should hold until the row-level session ends. Live mode is fine as specified — the
field *is* the session there.

**Decided 2026-08-27 (OQ-3):** hold the edited row's display position for the lifetime of the open
session in gated mode, releasing it on Save or Cancel; keep field-level commit in live mode. Tagged
to sorting because sorting is what must change. Note this re-introduces a scoped form of the pinning
D24 removed — narrower (one row, gated only, session-bounded), but the same mechanism family, so it
is worth re-reading D20/D24 before implementing.

### S-2 — A blank or empty value must sort somewhere predictable — ✅ covered

> As someone who just added a blank row to a sorted table, I want it in a predictable place, and in
> the same place regardless of which way the column is sorted.

**Shipped** — `applySortNulls()` (`schema/column-rules.ts`), wired into `withSorting()`. Empties
resolve before the comparator and **outside** the direction multiplication, which closes the crash
on nullable date columns and the direction-flip together. Default `'last'`; `""` stays a real value
unless a column opts it into the empty branch (`emptyString: 'is-empty'`); per-column override is a
declarative rule (single-writer metadata key), not a `ColumnDef` field. The spec's nine parked "what
is an empty row" scenarios (S1–S9) stay parked **because of OQ-3** — the edited row now holds its
position, so null ordering no longer has to keep a row the person is filling in visible. If OQ-3's
row-hold is ever dropped, those scenarios come back.

## Owned by filtering *(unbuilt)*

### F-1 — My own edit must not make the row vanish — ❌ not covered (forward-looking)

> As someone changing a row's status while filtered to "open", I do not want the row to disappear
> the instant I change it — I have not finished with it.

**Acceptance criteria**

- A row edited out of the active filter stays visible and in place, flagged as no longer matching,
  with a plain explanation of why it is still showing. It leaves on the next filter change or
  refresh.
- The same rule applies to a row I add that does not match the filter — otherwise "I clicked Add
  and nothing appeared."

The state layer has already decided the retention rule (D25) and flagged that it needs a chip or
muted styling (G11). Story belongs to filtering.

## Owned by grouping *(unbuilt)*

### G-1 — Changing the grouping field moves my row to another group — ❌ not covered (forward-looking)

> As someone changing a person's department in a table grouped by department, I expect the row to
> move to the new group — but I want to see it happen, and I do not want my next keystroke to land
> in a different row.

**Acceptance criteria**

- The row moves to its new group, is scrolled into view, and is briefly highlighted.
- Focus follows the row, or is explicitly released — it never silently lands on whichever row
  slid into that screen position.
- The move is announced.
- A dropdown commits immediately, so this happens the instant the selection changes. That is
  intended, and the announcement is what makes it survivable.

### G-2 — Adding a row while grouped — ❌ not covered (forward-looking)

> As someone adding a row to a grouped table, I want to say which group it joins, or add it from
> inside a group header.

**Acceptance criteria**

- Add is available per group, and the new row appears inside that group already carrying the
  group's value in the grouped column.
- Adding into a collapsed group expands it rather than filling an invisible row.

## Owned by drag-and-drop *(unbuilt)*

### D-1 — Reordering must not disturb an open editor — ❌ not covered (forward-looking)

> As someone dragging rows into priority order, I do not want a row that is mid-edit to be
> reorderable out from under itself, and I do not want the drag to discard my typing.

**Acceptance criteria**

- A row with an open editor is either not draggable, or dragging it commits/keeps the edit — never
  discards it.
- Drop targets do not shift while an editor above them changes height (validation messages).

### D-2 — Undo a reorder — ❌ not covered, and blocked (forward-looking)

Same mechanism as §3.2, and **still blocked after it**: the agreed design gives a restore point a
position, which covers delete, but a *move* needs the inverse-operation representation O22 actually
rejected. If drag-and-drop ships before that is designed, it ships without undo.

## Owned by pagination / virtual scroll *(pagination unbuilt; virtual scroll drafted)*

### P-1 — An open row must not be destroyed by scrolling — ❌ not covered (forward-looking)

> As someone editing a row that scrolls out of view in a virtualised table, I do not want my typing
> discarded because the row was recycled.

**Acceptance criteria**

- An open or dirty row is not recycled, or its state survives recycling intact.
- Navigating to another page with unsaved rows warns me first.
- A validation error on a row I cannot see (another page, filtered out) never blocks a save without
  telling me which row and letting me get to it. The state register already flags this as O17.

## Owned by selection *(unbuilt)*

### X-1 — Bulk delete and bulk edit — ❌ not covered (forward-looking)

§3.3 and §1.8 both need a selection source. Bulk *edit* additionally needs the multiple-open
semantics resolved first (G4) — the two features cannot be specified independently.

## Owned by expansion *(built)*

### E-1 — Editing a child row of an expanded parent — ❌ not covered

> As someone editing a line item inside an expanded order, I expect the child row to be editable
> the same way the parent is.

Today a nested child renders no editable field at all (G6, an engine-level index gap). Belongs to
expansion because expansion is what the engine's index does not consult.

---

# 6. Open questions

Each carries a recommendation and what would settle it. None silently picked.

**OQ-1 — Does cancelling an add or a duplicate remove the row, or blank it? — RESOLVED 2026-08-27: neither; not a library decision.**
The table exposes verbs that can do both and the consumer owns the Cancel affordance and its handler,
so the choice is theirs per table: some products want the new row kept, some want it discarded. The
library ships no default policy here. What it must keep is that **both outcomes stay one call each** —
if discard costs three composed calls and reset costs one, the library has picked a default by
ergonomics. That is the only remaining product requirement from §4.2; the branch itself is consumer
spec.

**OQ-2 — Where does an undone delete reappear, and how does the person notice? — RESOLVED
2026-08-27.** Position is not a choice: the row re-inserts at its stored index and the pipeline
sorts it, so under an active sort it lands wherever the sort puts it — possibly off screen. What is
a choice is the feedback, and it splits by layer:

- ~~**State layer (now):** the table exposes *which rows just returned* as a signal~~ —
  **overturned 2026-08-27** in the state layer's own grilling (`with-optimistic-crud/2-decisions.md`,
  the `restored`-signal decision). The fact is genuinely state-layer-only — `revertEdit` clears the
  snapshot in the same call that reinserts, so no consumer or custom feature can tell a reinsert
  from an ordinary add — but the API surface was judged not worth it. Scroll/flash is driven from
  the consumer's own `error:` callback, which already has the id, guarded with `afterNextRender`
  because `writeData` is synchronous while Angular's DOM update is not.
- **UI layer (later):** an opt-in directive reads that signal and scrolls the restored row into
  view and flashes it. It belongs with the G1/G9/G10 directive effort (keyboard, focus,
  announcements), not as a separate piece of work — a restored row also needs announcing, which is
  the same directive's job.

*Consequence for §3.2's acceptance criteria:* "scrolled into view and briefly highlighted" is
correct as a **product** requirement and is delivered by the UI layer, not by the state layer.
Sequencing it means the state signal ships with the delete-rollback work; the visible behavior
arrives with the editing directive.

**OQ-3 — Is the commit boundary the field or the row, in gated mode? — RESOLVED 2026-08-27: the
row.** In gated mode the edited row holds its display position from Edit until Save or Cancel. Live
mode keeps field-level commit, where the field genuinely *is* the session. The person was shown
Save and Cancel; that is a row-level promise, and a row that re-sorts on Tab breaks it while the
buttons are still on screen.

*What this costs, stated plainly:* D24 deleted the pinning machinery precisely because the
field-level boundary made it unnecessary. Holding a row for a session brings back a **scoped**
version of it — one row, gated mode only, lifetime bounded by the open session. It is narrower than
what D24 removed (which was per-row exemption across the whole pipeline), and its lifetime has a
clear start and end, which the old design lacked. Whoever implements it should re-read D20/D24
before choosing a mechanism, and should confirm the exemption applies to **sort only** — a row
edited out of the *filter* is a different rule (D25, retention-with-flag).

*Sequencing:* this is a sorting-owned change (§5, S-1), not an editing one. It was blocked on the
sorting comparator defects in S-2, which have since shipped (`applySortNulls()`), so nothing external
gates it now — it can be specced.

**OQ-4 — When a slow save fails on a row the person has since started editing again, who wins? —
RESOLVED 2026-08-27: the consumer's, entirely.** Which value wins is a product choice, and the app
owns the focus/blur wiring that would act on it. The library ships both paths and documents the
hazard; it takes no position.

*Not a library defect, checked.* The concern was that a live table's documented pattern calls
`captureEdit(id)` on every focus, and `captureEdit` always overwrites (D40) — so re-focusing a row
whose save is still in flight replaces the pre-save restore point with the unconfirmed value, and a
later rejection would restore exactly what the server refused. That is real, but it is guardable
from outside with state the library already exposes:

```ts
onFocus(id) {
  if (!this.table.pending().has(id)) {          // an in-flight save still holds the restore point
    this.table.editing.update(captureEdit(id));
  }
}
```

`pending()` is precisely "holds a restore point and is not open," which on a live table is the
in-flight set. Gated mode never had the problem — re-opening goes through `beginEdit`, which is
capture-if-absent.

*What this does leave:* a **docs and story defect**, not an API one. `src/stories/live-optimistic/`
and `features/row-editing.md` §5 both show the unguarded `captureEdit` on every focus, so the
pattern shipped as the reference has the hazard in it. Add the guard to the story and a sentence to
the spec.

**OQ-5 — Delete: confirm, or undo, or both? — the library half is RESOLVED 2026-08-27.** The table
will support undoing a delete: the restore point carries its position and `removeEdit(id)` captures
it without a separate call
([D45–D47](../1-state/work/with-optimistic-crud/2-decisions.md)). What stays open is the product half
below.
*Recommendation:* undo for single deletes, confirm for bulk (§3.2, §3.3). Per-row confirmation
trains dismissal.
*To decide:* whether undo can be guaranteed to reach the server in the deployments this table
targets. If a delete is irreversible server-side, confirmation is the only safety net and the
recommendation flips.

**OQ-6 — Does a "saving" state show on tables with no server? — RESOLVED 2026-08-27: no, and the
premise was wrong.** A local save is `endEdit(id)` then `releaseEdit(id)`, two synchronous writes in
one block. Signals do not render between them, so no frame ever shows the intermediate `pending`
state and nothing flickers. The interval is only observable if something `await`s between the two
calls, which a local save has no reason to do.

*Action:* `features/row-editing.md` §9 lists this as an accepted cost ("a one-tick 'saving' flicker
on a table that never touches a server"). That is inaccurate as written and should be corrected or
removed — it invites consumers to build a delay threshold against a problem they do not have.

**OQ-7 — Multiple open rows: design it, or refuse it? — RESOLVED 2026-08-27: design the semantics
now.** Refusing was rejected on a practical ground as well as a product one: "an optimistic flow" is
a consumer wiring pattern, not config, so there is nothing reliable to detect at composition time.

*What designing it actually involves.* Less than "undesigned" suggests — restore points are already
per-row (`snapshots` is a map keyed by id), so N open rows × M in-flight saves is not a
representation problem. What is genuinely unspecified:

- **Save-all**: one affordance over N open rows — is it N independent saves or one batched write?
  D32 says a batched write is *one* rollback unit, not N, which is a different failure story from N
  independent ones.
- **Partial failure**: which rows close, which stay open, and how the person is told. §1.8's
  acceptance criteria are the product answer; the state layer has to be able to express it.
- **`clearEdit()` with saves in flight**: it drops the restore points of every open row, so a
  later rejection has nothing to roll back to. Harmless in single mode; not in bulk.
- **Single-mode trim does not apply**, so the D14 invariant that keeps `open` bounded is gone.

*What it unblocks:* bulk edit (D32 routes it through this decision) and **O23** (declarative
openness — `applyEditable({ when })`, which cannot be designed while a predicate matching N rows has
no defined behavior).

*Sequencing:* it needs `withSelection()` for the affordance, which does not exist. The **semantics**
can be specced without it; the **UI** cannot. Spec first, ship with selection.

**Specced 2026-08-27** — [`1-state/work/with-multiple-edit/1-design.md`](../1-state/work/with-multiple-edit/1-design.md).
Most of the "N × M" concern turned out already well-defined (restore points are per row, so partial
failure is three ordinary calls). What was real is one defect with two entry points: **`clearEdit()`
and the single-mode trim drop every open row's restore point**, which under `multiple: true` can
discard rollbacks for saves still in flight — reachable through the config's own documented idiom
`multiple: () => isWide()`, i.e. a window resize. Resolution: bulk edit is optimistic-only (a save
closes its row before firing), which makes the hazard unreachable with no new state. One open
question remains there — whether a mode collapse should silently end N edit sessions.

---

# 7. Not user-facing

Real problems, but the integrating developer's, not the person using the table. Listed so they are
not mistaken for missing stories.

- **How a row reaches its form field** — index bridging between the data array and rendered rows.
  Pure integration plumbing.
- **Which feature is composed for which mode** — the person cannot tell whether a table composes
  one feature or two.
- **Composing both editing features throwing at construction** — a build-time error for the
  developer.
- **Whether a save is one call or two** — invisible, except through OQ-6's flicker.
- **The number of form nodes held for a large data set** — a performance budget, not a story;
  becomes user-facing only if it makes typing lag.
- **Whether change notification is a signal or an event** — API-surface shape.
- **Whether per-column commit timing is declared per column or by a shared schema fragment** —
  developer ergonomics.
- **Field dirty/touched state misattributing after a structural change** — an upstream framework
  limitation. It becomes user-facing if it makes a wrong row *look* edited; worth re-checking
  against §1.4's badge before dismissing it.
- **Whether Cancel on a new row discards or resets it** — consumer product policy (OQ-1), not a
  library default. What *is* the library's problem is keeping both one call.
- **Temp id versus server id** — the person never sees an id. Its *consequences* (focus loss, row
  dropping out of edit mode) are user-facing and are in §2.1.
