# Issue graph — #110's direct children (ADR-0024)

Epic: [#110](https://github.com/DvirMon/ng-table/issues/110) — the column
accessor is the single value source. Its own tracked
[`issue-graph.md`](issue-graph.md) covers only the #129 sub-epic's execution
chain (#130–#141, all closed) and explicitly excludes #110's direct children
(#100, #115, #116, #117) as "outside this graph's node set". This file fills
that gap.

All external blockers this graph once had — #111, #112, #113, #114, #125,
#129 — are now closed and shipped. Every remaining edge below is internal to
this node set.

## Nodes

| # | Title | State | Depends on | Blocks |
|---|---|---|---|---|
| [#100](https://github.com/DvirMon/ng-table/issues/100) | `sortFn`/`enableSorting` move off `ColumnDef` into `withSorting()`'s schema | 🟡 OPEN — `needs:tasks` | — (all cleared: #111, #129/R1) | #117 |
| [#115](https://github.com/DvirMon/ng-table/issues/115) | Filtering reads the accessor; criteria key by column id | ✅ CLOSED 09-25 (7dda2e5) | — (all cleared: #111, #113, #125, #129) | #117 |
| [#116](https://github.com/DvirMon/ng-table/issues/116) | ADR for the schema-declaration surface — keying, authoring forms, resolver naming | 🟡 OPEN — `needs:triage` | — (none, ever) | none (docs-only; #117 doesn't block on it) |
| [#117](https://github.com/DvirMon/ng-table/issues/117) | Rule contexts resolve declared columns — `valueOf`/`criterionOf`/`stateOf` | 🟡 OPEN — `needs:tasks` | #100 (open), #115 (cleared) | — |

## Graph

```
#100      ──┐
             ├──► #117
#115[✅] ──┘

#116  (independent — no edge to any other node in this set)
```

- **#100 → #117** — #117's acceptance criterion explicitly defers `sortFn`'s
  resolver spelling to #100 ("settle with #100 rather than inventing a third
  spelling here"). Ruling R6 (`decisions.md`) made this edge tracker-visible
  by adding #100 to #117's `Blocked by` list — **already applied**, #117's
  live body carries it today.
- **#115 → #117** — #117 needs the accessor-reading path filtering ships
  (V2/V3) before a rule callback has a legal way to read a declared column's
  value through a carrier column. Already recorded in #117's `Blocked by`.
- **#116 has no edge to #100/#115/#117.** It is a pure documentation ADR
  whose *content* is already settled (R2 and R3 corrections are both already
  folded into #116's live body — see "Already-applied corrections" below).
  Nothing in #100/#115/#117 is blocked on #116 landing first, and #116 is not
  blocked on anything. It races independently.

A single convergent shape, not a chain: two independent nodes (#100, #115)
gate one downstream node (#117), and a fourth node (#116) sits off to the
side entirely.

## Summary

- **Parallel-safe:** #100, #115, #116 were three independent nodes, no shared
  files. #100 touches `with-sorting.ts`, `ColumnDef`/`ColumnDefInput`,
  `docs/decisions/sorting.md`. #115 touched `with-filtering.ts`'s input
  contract, filter types, filtering stories/fixtures. #116 touches only ADR
  files (`adr/0019`, `adr/0020`, `adr/0021`, `adr/0024`, `adr/0025`) and
  `docs/decisions/grouping.md`'s G-rows. No file collision among the three.
- **Sequenced:** #117 after both #100 and #115 close (either order between
  those two — #117 needs both, not one-then-the-other). #115's half of that
  gate is now cleared.
- **Current frontier:** **#100 and #116** — #115 shipped and closed
  2026-09-25 (7dda2e5), clearing its half of #117's gate. #117 remains
  blocked on #100 alone. #100 and #116 are both still unblocked and
  independent of each other and of #115's closure.

## Readiness

| # | rung (as labeled) | actual readiness | why |
|---|---|---|---|
| #100 | `needs:tasks` | **ready for `/to-tasks` now** | Design fully settled (Rule A chosen, Q1–Q5 answered, aggregate half already split to #114/shipped). The only open blocker (#111) is closed and R1 already resolved the #129 ship-order question — #129 is closed. Nothing left to re-litigate; next step is task-slicing the implementation itself, not further design. |
| #115 | `needs:tasks` (stale label) | **shipped and closed** | `/to-tasks` (8 steps), `/implement` and `/ship` all ran 2026-09-25 — commit 7dda2e5, pushed directly to `main`, closed by the closing keyword in the commit message. All 9 acceptance criteria checked off on the issue. |
| #116 | `needs:triage` | **effectively ready-for-agent; label lags content** | Its own 2026-09-20 assessment says "low difficulty, docs only, content already settled... Proposes ready-for-agent; not self-granted, per the assessment rule." That self-imposed caveat is the only thing keeping it off `ready-for-agent` — a human/agent just needs to apply the label. Both R2 and R3 scope additions (2026-09-24) are already written into its acceptance criteria. |
| #117 | `needs:tasks` | **blocked, correctly labeled** | Cannot start until #100 and #115 both ship — its resolver signatures for `sortFn` and filtering depend on what those two land. Once unblocked, still high difficulty per its own assessment (breaking rename, three-feature span) — genuinely needs `/to-tasks` when its turn comes. |

## Already-applied corrections (informational — no action needed)

`decisions.md`'s Conflict-audit rulings section (2026-09-24) marks several
edits as "owed" at ruling time. Re-checked against the **live** issue bodies
just now — all but one are already done:

- **R6** ("owed, not done: the edit to #117's `blocked-by` field") — ✅
  already applied. #117's `Blocked by` list live today includes "#100 — the
  sorting schema. Added 2026-09-24 (R6)".
- **R2** ("owed a correction in both #117 and #116") — ✅ already applied to
  both. Both issues carry the live "Correction, 2026-09-24 (R2)" paragraph
  removing `order` from the `stateOf` example.
- **R3** ("Owed to #116, not done here") — ✅ already applied. #116's body
  has a live "Added to scope 2026-09-24 (R3) — reader naming goes into
  ADR-0025" section, and its acceptance criteria include the ADR-0025
  reader-naming bullet.
- **R5** (ADR-0020's stale header, "amended now, on its own") — likely ✅.
  The working tree has an uncommitted modification to
  `libs/table/docs/adr/0020-open-stage-registration-for-third-party-features.md`
  (see `git status`), consistent with this fix being in flight or done but
  not yet committed. Not verified against the ADR's actual text by this
  pass — confirm before relying on it.

## Punch list — genuinely still outstanding

Only one open item found, and it is a comment on #100, not a `decisions.md`
ruling:

- **#100's "Aggregate config — resolved (2026-09-19)" section still carries
  stale reasoning.** A comment on the issue (unresolved, not yet applied)
  flags that the paragraph justifying `applyAggregate`'s placement through
  `GroupingPath` cites three now-dead premises (D7, reversed by ADR-0024;
  ADR-0019's Amendment, re-amended 2026-09-20 to say the opposite; ADR-0021's
  path-vocabulary rule, superseded by ADR-0024) and that its stated
  trade-off ("a value only ever produced inside an accessor... can never be
  aggregated") is now false under ADR-0024's carrier-column mechanism. The
  comment's suggested fix: strike that paragraph's justification and point
  at #114 + #116 instead. **Not applied to the issue body as of this
  read.** This is a `gh issue edit` on a shared tracker — flagging it here
  rather than making the edit.

## Source

Edges derived from: `decisions.md`'s Conflict-audit rulings section
(R1–R8, 2026-09-24) and its inline #100/#115/#116/#117 sequencing notes
(search terms: G53–G59, V1–V3, K3–K4, S1–S2); each issue's own live
`Blocked by` / `Pipeline` block, fetched fresh via `gh issue view --json`
2026-09-25; `gh issue list --state open` (2026-09-25) confirming #111–#114,
#125 and #129 are all closed. Re-mapped at execution grain per
`decompose-by-dependency-graph`'s method — presentation order in the issue
bodies (#100 before #115 before #116 before #117) is not treated as an edge;
only artifact dependencies named in `Blocked by` fields or `decisions.md`
rulings count.

Refreshed 2026-09-25 after `/ship` pushed 7dda2e5 — `#115` closed;
`gh issue list --state all` (scoped to this workspace's full `githubIssues`
set) confirms `#100`/`#116`/`#117` still open, unchanged by this run.

Related docs: [`2-spec.md`](2-spec.md) ·
[`3-architecture.md`](3-architecture.md) · [`decisions.md`](decisions.md) ·
[`issue-graph.md`](issue-graph.md) (the #129 sub-chain, closed) ·
[ADR-0024](../../../../adr/0024-single-value-source-accessor.md)
