---
title: "Step 7 — Documentation: applyGroupOrder replaces config.groupOrder"
type: task-step
issue: 87
---

# Step 7 — Documentation: `applyGroupOrder` replaces `config.groupOrder`

**PR scope:** The state-layer surface docs and the design/graph tracking docs this slice owns.
The product doc's OQ-5/OQ-6 decision (`0-product/grouping.md`) belongs to #88 and is deliberately
not here — same split issue #85's own docs step drew.

**Task type:** docs

**Skills used:** audit-docs, concise-docs

**Depends on:** Steps 1-6 — describes the shape those steps actually landed, not the proposal.

**Scaffolding agent:** none — main thread.

## Files

- `libs/table/docs/1-state/work/grouping/archive/with-grouping/3-spec.md` (edit)
- `libs/table/docs/1-state/work/grouping/archive/with-grouping/design-group-admission.md` (edit)
- `libs/table/docs/1-state/work/grouping/archive/with-grouping/issue-graph.md` (edit)
- `libs/table/docs/1-state/features/grouping.md` (edit)

## Why This Step Exists

`3-spec.md`'s Public surface section is the only full statement of `WithGroupingConfig`, and it
still lists `groupOrder?: (a, b) => number; // D4` as a config member — a reader would write code
against a field this slice deletes. `design-group-admission.md`'s own frontmatter already tracks
per-issue shipped status for #84/#85/#86 and says "`applyGroupOrder` remains proposed, not
implemented — that is #87" — that line is now wrong. `issue-graph.md`'s #87 row still reads
`🟡 OPEN`. `docs/1-state/features/grouping.md`'s banner still describes `groupOrder` as "on
`withGrouping()`'s config."

## What To Do

### 1. `3-spec.md` § Public surface (~line 176)

Replace:

```ts
groupOrder?: (a: GroupSummary<TRow>, b: GroupSummary<TRow>) => number;  // D4
```

with a note that the member is gone, pointing at its replacement — do not leave a silently
deleted line with nothing marking why. Follow this file's own convention for a superseded member
(see how `initialGrouping` was handled when #84 renamed it) — a struck-through mention or an
inline "(removed — see `applyGroupOrder`, #87)" note, whichever this file already does elsewhere
for a member that moved rather than one that was added.

Every other `groupOrder` mention in this file (lines ~23, 68, 93, 96, 129, 206-207, 226, 235, 273,
340, 380, 384, 398, 424-430, 451, 456) is describing the **concept** ("group order, over
contents, decoupled from sort") which is unchanged — only its declaration site moved. Do not
rewrite these wholesale; add one clarifying line near the first substantial mention (~line 68 or
226) stating the comparator is now declared per-column via `applyGroupOrder(path.x, cmp)`
(#87), not as one config member applied at every depth, and that the *behavior* described
everywhere else in this file (siblings-only comparison, decoupled from sort, throw-falls-back-to-
stable, D4/D5/D15) is exactly what shipped.

### 2. `design-group-admission.md` frontmatter (top `status:` block)

Update the sentence "`applyGroupOrder` remains proposed, not implemented — that is #87." to state
it shipped in #87, matching the sentence structure already used for #85/#86 in the same block.

### 3. `issue-graph.md` (~line 14)

Flip #87's row from `🟡 OPEN` to whatever this table's own convention marks a shipped issue as
(check how #84/#85/#86's rows read once you `git log`/tracker-check their actual current state —
if this table is more broadly stale across several rows, only correct **#87's own row** in this
step; a full sweep of the table is not this slice's job).

### 4. `docs/1-state/features/grouping.md`

- Banner section (~lines 25-29): "Cluster order is `groupOrder` on `withGrouping()`'s config (D4,
  issue #24)" → "Cluster order is `applyGroupOrder(path.x, cmp)`, declared per column (D4 amended,
  issue #87) — a comparator orders that column's own siblings only; two levels can order by
  different criteria in one table." Keep the rest of that bullet (omitted ⇒ stable
  first-occurrence order; decoupled from sorting per D5) — that part is still accurate.
- Line ~65: "Still open, deliberately unbuilt: `manual: true` and routing a header click to
  `groupOrder`" — update `groupOrder` → `applyGroupOrder` (the concept name pointing at its new
  declaration site), sentence otherwise unchanged (still open, still unbuilt).
- Lines ~180-183, ~198: these describe `groupOrder`'s *behavior* (decoupled from sort, orders
  siblings within a parent), not its declaration site — leave as-is unless the wording implies a
  single table-wide slot; if it does, adjust to "per column" without changing the underlying
  claim.

## Implementation Notes

- **This is a rename of a declaration site, not a behavior change** — every doc edit in this step
  should read as "same guarantee, new spelling," never as introducing new semantics. If an edit
  reads like new behavior, it's out of scope for this step (check whether it actually belongs in
  Steps 1-6 instead, or in #88).
- Keep edits scoped to `groupOrder`/`applyGroupOrder` mentions. Don't touch this workspace's other
  stale content (e.g. other issues' status rows in `issue-graph.md`) while in these files —
  narrow, targeted edits only.

## Risks / Watchouts

- Don't touch `0-product/grouping.md` (§4.2/§4.3, OQ-5/OQ-6) or
  `libs/table/docs/1-state/work/grouping/archive/with-grouping/2-decisions.md`'s D4 entry — #88's
  acceptance criteria explicitly own "`2-decisions.md` records admission as settled, with D4's
  amended declaration site" and the product-doc decision. Touching either here duplicates #88's
  work and risks the two slices disagreeing about wording.

## Non-Goals

- No product-doc changes (#88).
- No `2-decisions.md` changes (#88).
- No full audit of `issue-graph.md`'s other stale rows.

## Acceptance Checks

- [ ] `3-spec.md`'s Public surface no longer lists `groupOrder` as a live `WithGroupingConfig`
      member; a reader can tell it moved to `applyGroupOrder` and find the new call shape.
- [ ] `design-group-admission.md`'s status frontmatter says #87 shipped, not proposed.
- [ ] `issue-graph.md`'s #87 row reflects its shipped state.
- [ ] `docs/1-state/features/grouping.md`'s banner and Open-Questions mentions of `groupOrder`
      point at `applyGroupOrder` as the declaration site, without changing any behavioral claim.
- [ ] No claim in any touched doc contradicts the code Steps 1-6 shipped.

---
← [Step 6: Tests](step-6-tests.plan.md)
