---
title: Handoff — three doc corrections
type: plan
status: open — not started
date: 2026-08-28
parent: ../../features/row-editing.md
---

# Handoff — doc corrections

Three independent, small corrections left over from the row-editing product pass. None depends on
another; each can land alone. All three currently mislead a reader.

Parallel-safe with each other and with the sorting work
([`../sorting-null-ordering/1-handoff.md`](../../../sorting/archive/sorting-null-ordering/1-handoff.md)) — no shared files.

---

## 1. `features/row-editing.md` §9 — the "saving flicker" does not exist

**Where:** `docs/1-state/features/row-editing.md`, §9 Accepted Costs, first bullet (~line 595).

**What it says:** a local-only save is `endEdit(id)` + `releaseEdit(id)`, and between them the row
reads as `pending`, so any UI bound to `pending()` shows a one-tick "saving" flicker on a table that
never touches a server.

**Why it is wrong:** both writes are synchronous in one block. Angular signals do not render between
them, so no frame ever shows the intermediate state. The interval is only observable if something
`await`s between the two calls, which a local save has no reason to do.

**Why it matters:** as written it invites consumers to build a spinner-delay threshold against a
problem they do not have.

**Fix:** correct the sentence or drop the bullet. If kept, state the real condition — the row is
briefly `pending` only when the consumer awaits between closing and releasing.

**Source:** product OQ-6, resolved in
[`0-product/row-editing.md`](../../../../../0-product/row-editing.md).

---

## 2. `with-optimistic-crud/2-decisions.md` — two decisions numbered D48

**Where:** `docs/1-state/work/row-editing/archive/with-optimistic-crud/2-decisions.md`, headings at ~line 110 and ~line 153.

| Line | Heading                                                               |
| ---- | --------------------------------------------------------------------- |
| ~110 | `## D48 — O(1) id lookups via indexById`                              |
| ~153 | `## D48 — restored signal dropped, scroll/flash stays consumer-space` |

**Fix:** renumber the second to **D49**. D-numbers are global across the
`with-row-editing` / `with-optimistic` / `with-mutations` / `with-optimistic-crud` folders, so check
nothing else has claimed D49 before assigning it, and grep the repo for citations of "D48" to see
which of the two each one means.

**Why it matters:** this is the exact defect **G8** recorded and renumbered once already
([`with-row-editing/5-gaps.md`](../with-row-editing/5-gaps.md)). A stale cross-reference silently
lands on the wrong decision. G8's fix added a collision table at the head of the renumbered section —
worth doing the same here.

---

## 3. `0-product/row-editing.md` — stale frontmatter

**Where:** `docs/0-product/row-editing.md`, frontmatter `status`.

**What it says:** `draft — scope-setting; not measured against an implementation plan yet`.

**Why it is wrong:** all seven open questions are resolved, and three of the four designs it
generated have shipped — optimistic CRUD (delete rollback), multiple-open semantics, and duplicate.
Only sorting null ordering remains unimplemented.

**Fix:** update `status` to reflect that OQ-1…OQ-7 are resolved and which work has landed. Keep the
ownership banner directly below the title — state-layer efforts are told to link to this file rather
than rewrite it, and that instruction is load-bearing.

**Note:** coverage marks inside the document are maintained from the product side as capabilities
land. Do not sweep them as part of this correction; changing a mark is a product judgement about
what a person can actually do on screen, not a status sync.
