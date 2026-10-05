# Decisions — optimistic state architecture

Design decisions taken from [research.md](research.md), 2026-09-05. Numbering is
folder-local (D1, D2, …), matching the sibling `state-feature-competitive-audit/`
work folder — not the global D-series used in the feature specs.

These are taken **design-first**: what the architecture should be, decided without
reference to what `src/` currently does. Reconciling the two comes after; a
decision here that the current code already satisfies is a coincidence, not a
justification.

---

## D1 — The table holds the rollback state

The alternative is that the consumer's data layer holds it (TanStack Query, RTK
Query, NgRx and Apollo all snapshot before a write already) and the table holds
only presentation status.

Rejected, on two grounds:

**Position is view-only information.** Undoing a delete means restoring the row
_where it was_. Its index in the current sorted/filtered/grouped order is a fact
only the view holds — a consumer's store has a collection, not an ordering. A
table that holds no restore point cannot make delete-rollback correct, only
approximate.

**Consumers without a mutation layer are the common case.** A plain fetch, a
service, a signal. A feature named "optimistic" that requires an external
mutation library to be useful has failed at the thing it is named after.

### The obligation this creates

The genuine argument against was never _"the table shouldn't hold it"_ — it was
_"two layers must not both hold it."_ That failure is symmetric: consumer-only
and table-only are both correct; only _both_ is broken, and it breaks silently
(table restores V1, store restores V0, store's data flows back down, table
renders V0 while believing it restored V1 — no error anywhere).

So D1 is conditional on making exclusivity legible:

1. **Composing the feature must read as a transfer of authority** — "the table is
   now the rollback authority; your store should not also snapshot." If a
   consumer can plug this in next to a `onMutate`/`onError` pair without
   noticing they now have two, the divergence bug ships to everyone.
2. **An unreleased restore point must not be silently retained.** The table never
   observes the server response, so it holds state whose termination condition it
   cannot detect. Either the capture is scoped to something that ends on its own,
   or a leaked restore point is visibly detectable.

Point 2 is a real, unavoidable cost of D1 — not an argument against it, but not
something to leave unhandled either.

---

## D2 — A restore point is the prior row plus its position

Three candidate representations of "what do we keep in order to undo":

|                 | What is stored               | Undo is                                        |
| --------------- | ---------------------------- | ---------------------------------------------- |
| **Prior value** | the whole row + its index    | put the copy back                              |
| Inverse diff    | the changed fields, reversed | merge the old fields in                        |
| Replay log      | the operation itself         | drop it, reset to server data, re-run the rest |

**Chosen: prior value.**

**Replay log rejected on contract cost.** It changes what consumers write.
Mutations would have to be replayable operations — deterministic, serializable
args, no ids generated inside the body, safe to run twice. That is a sync
engine's programming model (confirmed against Replicache's source: replay is
unconditional and re-invokes stored args verbatim, so determinism is a hard
requirement, not a convention). Too large an ask in exchange for a row edit. It
also inverts the expected performance profile — replay recomputes the full row
set on every server response, where a snapshot restore dirties one row.

**Inverse diff rejected because it does not replace the prior-value form, it
adds to it.** Delete has no inverse diff: there is no "reverse the fields" for a
row that is gone, so delete falls back to storing the whole row and its position
regardless. Choosing inverse diff therefore means maintaining _two_
representations of "how to undo" permanently, in exchange for one benefit —
concurrent writes to different fields of the same row not clobbering each other
— which D3 rules out as a scenario. Its other advantage, a smaller stored value,
is measured in bytes and is not a real constraint.

---

## D3 — One write per row in flight at a time

Confirmed as a product fact, not a limitation to design around: a row edit opens
the row, changes several fields, and saves once. Cell-level editing where
individual cells save independently on blur is not the interaction model.

This is what makes D2 safe. The prior-value form's weakness is that a second
capture on a row overwrites the first; with at most one write in flight per row,
that case does not arise.

It also means the state is keyed by row id with a single value per key — not a
per-row stack or queue.

**If this ever changes** — if independently-saving cells are introduced — D2 must
be revisited, not patched. That is the condition under which inverse diff becomes
the better representation.

---

## D4 — Fresh server data moves the fallback forward; it never moves the display

When server data arrives for a row that has a write in flight, the held prior
value is a value the server has already moved past. Restoring it on failure would
put stale data back on screen and leave the table silently disagreeing with the
server until the next refetch.

**Two things are separated here, and only one of them changes:**

|                     | On incoming server data for an in-flight row                           |
| ------------------- | ---------------------------------------------------------------------- |
| **Displayed value** | unchanged — the user's optimistic value stays until the write resolves |
| **Held fallback**   | replaced with the newer server value                                   |

So a failed write lands on current truth rather than on a value that no longer
exists anywhere. The user's edit is lost, which is correct — it failed — but what
replaces it is real.

The display deliberately does _not_ jump mid-flight. An optimistic value that
flickers to a third party's value while the user's own save is still pending is
worse than either endpoint.

**Delete is covered by the same rule.** A delete holds a fallback like any other
op; if a newer version of that row arrives before the delete resolves, undoing a
failed delete re-inserts the latest row rather than the stale one.

**Rejected — freeze the fallback at capture time.** Simpler and fully
predictable, but it is exactly the gap every query-cache library researched
leaves open; RTK Query documents the resulting race in prose with zero
code-level guard. Predictability is not worth shipping a known
silent-disagreement bug.

**Rejected — flag the collision and let the consumer resolve it.** Most correct
in principle, but it puts conflict-resolution work on every consumer, including
the majority who never hit the case. Viable as a later opt-in layer on top of
D4's default, not as the default itself.

---

## D5 — The restore point is tagged with the operation it undoes

D2's "prior row + position" covers update and delete. Create breaks it: there is
no prior row, because the row did not exist. Undoing a create means _removing_ a
row, not restoring one — the opposite action, from a store that otherwise only
restores.

So one shape carries a tag, and rollback branches on it:

| tag      | undo does                                    |
| -------- | -------------------------------------------- |
| `update` | replace the row with the held copy           |
| `delete` | re-insert the held copy at its held position |
| `create` | remove the row                               |

**Rejected — infer it from what is stored.** A create could leave no prior row,
letting rollback read "prior row present → restore, absent → remove." The absence
is ambiguous: it also describes a row never captured, or one whose restore point
was already spent. Guessing wrong on that deletes a real row. An inference whose
failure mode is silent data loss is not worth the field it saves.

**Rejected — separate calls per operation.** Explicit and nothing inferred, but
it moves the branch into every consumer and makes calling the wrong one a silent
corruption. It also makes a generic failure handler impossible — the caller must
still know which write it fired at the point where it handles the error, which is
often not where the write was issued.

The tag is the fact a consumer cannot re-derive from the stored value alone, so
it is stored rather than recomputed.

---

## The resulting design

One store, keyed by row id, holding at most one entry per row:

```
RestorePoint = { row, at, op }
  row : the value before the write   (meaningless for op = create)
  at  : its index at capture time    (used only when the row is absent)
  op  : create | update | delete
```

- **Owned by the table** (D1), which makes the table the sole rollback authority
  — the consumer's data layer must not also snapshot.
- **Captured before the write, released on success, applied on failure.** The
  table cannot observe the server response, so all three are driven by calls it
  must be told to make (D1's second obligation).
- **One entry per row** (D3) — a second capture on a live row is not a case that
  arises.
- **The entry's `row` moves forward** when fresher server data arrives for a row
  with a write in flight; the displayed value does not (D4).
- **`op` decides the direction of the undo** (D5) — restore, re-insert, or
  remove.

Out of scope: `move`. A moved row's rollback needs an inverse-operation
representation, which D2 explicitly did not choose.
