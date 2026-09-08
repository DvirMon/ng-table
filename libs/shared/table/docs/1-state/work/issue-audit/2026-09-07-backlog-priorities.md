---
title: Backlog — table issues re-checked after the selection/expansion re-doc
type: audit
date: 2026-09-07
scope: 6 open table issues + work the new specs created but did not track
supersedes-in-part: ./2026-09-07-open-issue-audit.md
---

# Backlog after the selection/expansion re-doc

Follow-up to [the issue audit](./2026-09-07-open-issue-audit.md), re-run against
`196d0cf` (selection drilled) and `ae67fb7` (expansion audited, `initialExpanded`
and snapshot slice specced).

The headline is not about the existing issues — only one changed status. It is that
**two specs are now ready with no issues cut against them**, and they are the highest-value
work in the repo.

## Did the re-doc invalidate anything?

| Issue | Effect of the re-doc | Verdict |
|---|---|---|
| #51 | Its last open AC is now **moot** — see below | **Close** |
| #52 | Narrowed, not invalidated — both ACs still stand | Keep |
| #54, #5, #6, #7 | Untouched by either commit | Keep |

### #51 — close it

The one outstanding criterion was a doc line: record the `onRowsRemoved` convention in
`architecture.md`'s open-questions list *"so a future `withSelection()` is written with the
hook rather than inheriting the bug."*

`withSelection()` has now been written, and it was written with the hook.
`work/with-selection/3-spec.md` carries it as a settled decision:

> **Removal reconciliation is declared (ADR-0006).** The feature stores row ids, so it
> declares the removal hook and prunes with the shared helper. No exemption — a deleted
> row's id must leave the set.

D11 goes further and settles the emission question the AC could not have anticipated
(reconciliation is silent; it is not a write verb, so it does not emit). The convention
also lives in `CLAUDE.md` and in `features/column-pinning.md` / `features/column-sizing.md`.

The AC was a tripwire for a specific future mistake. That future arrived and the mistake
did not. Close it.

### #52 — still valid, and the re-doc did not touch either AC

Worth stating precisely, because `expansion.md` grew 99 lines and none of them were these:

- **Removal behavior is still undocumented in `expansion.md`.** ADR-0006 appears twice in
  that file: once in the render-layer paragraph (unrelated) and once inside the *stale
  restored ids* open question. Neither documents "an id leaves `expandedRows` when its row
  leaves `data`."
- **The re-add regression test still does not exist.** `with-expansion.spec.ts` covers
  remove; it does not cover remove-then-re-add-the-same-id.

One clarification the re-doc *does* provide: **stale restored ids are a different problem
from removal reconciliation**, and #52 should not absorb them. Removal prunes ids that
arrive as removals; stale restored ids never arrive at all, because they were never in
`data` to begin with. That is its own decision (below), not part of this issue.

---

## Work the new specs created and nobody tracked

### 1. `withSelection()` — spec ready, zero issues

`work/with-selection/state.json` has `"issues": false`. The spec is `status: ready`,
D1–D19 settled, public surface fixed, testing decisions written.

Why it ranks first, in the spec's own words: it is *"the single largest baseline gap in the
state layer: all four competitors ship selection in core."* And it is load-bearing for work
already deferred — `row-mutations.md:196` lists bulk `removeRow(id[])` / `patchRow(id[], partial)`
as blocked on exactly one thing: *"needs a selection source; `withSelection()` does not exist."*

It is also cheap by state-layer standards: one plugin file plus its spec, exported from the
barrel, **no engine changes** (per the spec's Module section).

Cut issues from `3-spec.md`. Its five documentation debts are all still outstanding and
belong in the same batch:

- [ ] `features/selection.md` — frontmatter still `spec: stub`, contract not written in
- [ ] `architecture.md:209` — the "select all scope" cross-cutting question is still open;
      D1 resolved it (no scope, the caller passes an id set)
- [ ] `3-ui/directives/selection.md:18` — "Known Blocker" still says do not drill this file
      until the scope question resolves. It has resolved.
- [ ] `row-mutations.md:196` — change the bulk verbs' blocker from "does not exist" to
      "unblocked, not yet built"
- [ ] regenerate `docs/status.md` (`npm run table:status`) — it still reports
      `selection | stub | none`

### 2. Stale restored ids — one decision, gates two features

Open question in `expansion.md:177`, and the expansion audit flags it as **shared with
selection**. Both features now accept a construction-time id seed (`initialExpanded`,
`initialSelection`) that can carry ids for rows deleted server-side since the state was
saved. ADR-0006's prune never fires for them — they never arrive as removals.

Undecided: drop unknown ids at apply time (safe, but breaks rows that arrive later via async
data) or keep them (consistent with today's design, where synthetic `group:*` ids are
already legitimately absent from `data`).

Small, and it gates the correctness of both seeds. The expansion doc says to decide it once
for both — so decide it before building either seed, not after.

### 3. `initialExpanded` — specced, not implemented

`expansion.md:91` specs `initialExpanded?: readonly RowId[]`, with the reasoning for why it
is deliberately not a signal and not a predicate. `WithExpansionConfig` in
`src/api/features/with-expansion.ts:16` has `childrenAccessor` and `isExpandable` — no
`initialExpanded`. Grep finds the name nowhere in `src/`.

Depends on #2 above.

### 4. Expansion snapshot slice — blocked

`expansion.md:136` specs the slice against `state-persistence.md`'s **proposed**
`FeatureSnapshotSlice` mechanism. That spec is `spec: drafted, code: none`. Nothing to
build until the persistence feature exists.

---

## Proposed order

```
P0  withSelection() implementation          spec ready, unblocks bulk verbs, no engine changes
P0  stale-restored-ids decision             one call, gates initialExpanded + initialSelection
P0  selection doc debts (5 files)           ship with the feature, not after

P1  #52  expansion removal reconciliation   2 small ACs, behavior change already half-landed
P1  initialExpanded implementation          needs the P0 decision first

P2  #6   withGrouping()                     unblocked by ADR-0011; rewrite the stale body first
P2  #5   withFiltering()                    unblocks O15/O16 in the row-editing gaps

P3  #7   pipeline integration verification  blocked on #5 and #6 both existing
P3  #54  move rollback                      blocked on withDragDrop()/moveRow existing

--  #51  close                              last AC moot
```

Dependency edges that actually constrain the order:

```
stale-restored-ids ──▶ initialExpanded
                   └─▶ withSelection(initialSelection)

withSelection() ──▶ bulk removeRow(id[]) / patchRow(id[], partial)

ADR-0011 (shipped) ──▶ #6 withGrouping
#5 + #6 ──▶ #7 pipeline verification
withDragDrop()/moveRow ──▶ #54
state-persistence ──▶ expansion snapshot slice
```

Everything else is parallel-safe. #52 in particular touches only expansion and depends on
nothing above it.

## Non-table backlog, for completeness

Ten open issues are not table work and were not audited here: the wizard primitives
(#23, #24, #27, #28) and the scene/hero work (#40–#45). They have been untouched since
2026-07-23 and 2026-08-09 respectively. Worth a separate pass to decide whether they are
still live or should be closed as abandoned — not mixed into the table ordering.
