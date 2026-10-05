---
title: Doc inventory — every grouping doc in libs/table/docs, and a consolidation proposal
type: discovery
capability: grouping
date: 2026-09-20
audience: maintainers
---

# Where does grouping documentation live, and what should the minimal source of truth be?

**Date:** 2026-09-20 · **Depth:** standard

> **This is a discovery artifact, not a decision.** Nothing here has been agreed, nothing was
> moved, and no file outside this one was edited. The Proposal section is a recommendation for the
> maintainer to accept, amend or reject. Placed at `1-state/work/grouping/` root (not under
> `active/` or `archive/`) because it is a meta-artifact _about_ that folder, not an effort inside
> it — flag if that placement is itself unwanted.

> **Corrections applied 2026-09-20, after a verification pass against `libs/table/src` and git.**
> The original draft took every status claim from doc frontmatter. Two were wrong:
>
> 1. **B1/B3 — the declarator split (D9) shipped.** Commit `4c86322 refactor(table)!: split
grouping declarators — applyGroupKey, label on initial`; `applyGroupKey` is exported at
>    `src/index.ts:73`. B3's "approved, not started" was stale. [R37][R38]
> 2. **ADR statuses are not unverifiable.** The original grepped YAML `status:` and missed that
>    most ADRs carry `**Status:**` on line 3. All 22 have one — 0019 accepted+amended, 0021
>    accepted, 0022 accepted. [R39]
>
> Both are the same failure the Synthesis warns about — trusting a folder's own status field.
> Rows and sections below are corrected in place; the two verified-good calls (B4, B5) are
> marked as confirmed against source.

## Answer

**The problem is not sprawl, it is that the canonical spec delegates its own contract into
`archive/`.** `1-state/features/grouping.md` is a 70-line superseded-banner wrapped around a
2026-07 draft; for State Shape, Methods and the public surface it points at
`1-state/work/grouping/archive/with-grouping/3-spec.md`, an archived episodic file. [R1][R2]
Worse for an agent reading in: **four independent decision logs each number from D1**, and at
least three of them redefine each other's numbers — `grouping-config-simplification`'s D1
supersedes archived D6/D7, its D2 reverses archived D8, `column-group-index`'s D-set reopens
archived D2. [R3][R4][R5] "D7" today means three different, unrelated things.
Recommendation: **two files** — rewrite `1-state/features/grouping.md` as the real contract
(absorbing `3-spec.md`), and add `1-state/work/grouping/decisions-log.md` as a single globally
numbered index that links out and restates nothing.

## Method

- Search: `grep -i "grouping|withGrouping|groupBy|GroupRow"` across `libs/table/docs/**/*.md` —
  3,576 hits across **265 files**. Most are one-word cross-references; this inventory covers the
  **111 files grouping actually owns**, plus 12 ADRs and a tangential tier.
- Read in full: both permanent specs, the product doc, all four decision logs, all three audits,
  every active work folder's frontmatter, every grouping `state.json`, `status.md`'s grouping row.
- **Task-step files are rolled up per folder, not row-per-file.** 73 of the 111 are
  `step-*.plan.md` / `progress.md` under `docs/tasks/` — `/to-tasks` execution output, not
  rationale. `work/trim-docs/decisions.md` measured the same thing repo-wide: `step-*.plan.md` +
  `progress.md` are 216 files / 34% of all docs. [R6] Rolling them up is a deliberate choice, not
  a gap — say so if you want them enumerated.
- Reliability: `status.json` `checklist` fields and doc `status:` frontmatter **disagree with
  reality in three places** (noted per row). Frontmatter was not trusted where a shipped-code
  claim in `libs/table/CLAUDE.md` or the feature spec contradicted it.

## Inventory

### Tier A — permanent, non-episodic (4 files)

|     | Path                                | Type                   | Holds                                                                                                                                  | Status                                                                                                                                                                                                                                                                                                             | Location OK?                                             |
| --- | ----------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| A1  | `docs/1-state/features/grouping.md` | permanent feature spec | 70-line superseded banner + a 2026-07 draft; pipeline-clustering design, `RenderRow` shape, aggregation contract, prior-art comparison | **current but hollow** — banner is accurate and dense, body is partly superseded by its own banner. State Shape / Methods / public surface all say "see `3-spec.md`, not restated here"                                                                                                                            | yes, but **delegates its contract into `archive/`** [R1] |
| A2  | `docs/0-product/grouping.md`        | product doc            | Person-facing user stories §1–§8, coverage marks per story, cross-feature marks                                                        | **current as of 2026-09-19 rewrite** (grouping-coverage step 5 is `▶ in progress`, so marks may move again)                                                                                                                                                                                                       | yes [R7]                                                 |
| A3  | `docs/3-ui/directives/grouping.md`  | permanent UI spec      | "No new directive"; rejected `ngpTableGroupBy`; 5 open to-drill items                                                                  | **badly stale, actively wrong.** Dated 2026-08-07. Says `withGrouping()` "is unimplemented"; cites `setGrouping(columnId)` (never shipped, D1) and a `_buildRenderRows` override slot (replaced by ADR-0011 render stages); says the group value "comes from `accessor`" — D7 says grouping never reads `accessor` | yes, content is the problem [R8]                         |
| A4  | `docs/status.md`                    | generated roll-up      | `grouping` row: `spec: drilled, code: partial` (state) / `spec: stub, code: none` (UI)                                                 | state half current; **UI half is the honest consequence of A3 being a stub**                                                                                                                                                                                                                                       | yes — generated, never hand-edit [R9]                    |

### Tier B — `1-state/work/grouping/active/` (3 folders, 6 files)

|     | Path                                                                    | Type               | Holds                                                                                                                                                                                                                                                                           | Status                                                                                                                                                                                                                                                        | Location OK?                                |
| --- | ----------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| B1  | `active/grouping-config-simplification/2-decisions.md`                  | episodic decisions | **D1–D9.** D1: `initial` declares levels+order, rules only mask (supersedes archived D6/D7). D2: schema-fn call order carries no meaning (reverses archived D8). D3: a rule naming an undeclared column is inert. D9: split declarators (`applyGroupKey`, `label` on `initial`) | **genuinely active, but smaller than its frontmatter says.** D1–D4 shipped `5ecc437`; **D9 shipped `4c86322`** (frontmatter still says uncommitted); D5/D7 unconfirmed; **D6 open** — verify D6 is the only remaining item before planning around this folder | yes [R3][R37]                               |
| B2  | `active/grouping-config-simplification/1-plan-config-simplification.md` | episodic plan      | Collapse `WithGroupingConfig` 5 fields → `{ initial, when, schema }`; records `applyGroupOrder` stays standalone                                                                                                                                                                | **partly superseded by its own sibling B1** (carries an amendment banner saying so). Phase B gated on ADR-0019's inference spike                                                                                                                              | yes [R10]                                   |
| B3  | `active/grouping-config-simplification/3-plan-declarator-split.md`      | episodic plan      | Execution for D9 only                                                                                                                                                                                                                                                           | **done — its frontmatter is stale.** Says "approved 2026-09-19, not started"; the work landed in `4c86322` and `applyGroupKey` is exported. Retire the plan or mark it executed                                                                               | yes [R11][R37][R38]                         |
| B4  | `active/per-column-group-admission/1-plan-when-enable-rename.md`        | episodic plan      | The `when`/`enable` convention for grouping's two predicates                                                                                                                                                                                                                    | **done, mis-filed as active.** Frontmatter says "rename + ADR-0018 pending"; ADR-0018 now exists and is `accepted`, and `libs/table/CLAUDE.md` documents `applyGrouping({ enable?, when })` as the shipped shape                                              | folder should be `archive/` [R12][R13][R14] |
| B5  | `active/column-group-index/2-decisions.md`                              | episodic decisions | **D1–D7** on `groupIndex`/#81. Corrects the issue body; D3 dropped both the index and the placement                                                                                                                                                                             | **shipped, mis-filed as active.** A1's banner records `groupingLevels()`/`isGroupedBy()` as shipped (#81)                                                                                                                                                     | folder should be `archive/` [R5][R1]        |
| B6  | `active/column-group-index/3-spec.md`                                   | episodic spec      | `status: ready` — the column↔level relation contract                                                                                                                                                                                                                           | same as B5                                                                                                                                                                                                                                                    | same [R15]                                  |

Also: `active/column-group-index/state.json` exists (`checklist: issues false, tasks false` — **stale**, the work shipped). `grouping-config-simplification/` and `per-column-group-admission/` have **no `state.json` at all**, unlike every other work folder in the repo. [R16]

### Tier C — `1-state/work/grouping/archive/` (2 folders, 75 files)

|     | Path                                                                                                                                                   | Type                   | Holds                                                                                                                                                                                                                                     | Status                                                                                                                                    | Location OK?                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| C1  | `archive/with-grouping/2-decisions.md`                                                                                                                 | archived decisions     | **D1–D17** — the foundational grouping decision set. D1 write surface, D3 multi-level `string[]`, D5 group order decoupled from sorting, D7 row-field keys not `accessor`, D9 aggregate-at-every-depth, D16 `rowsOf()`, D17 collapse-safe | **partly superseded** by B1 (D6/D7/D8) and B5 (D2). 2 items still deliberately open: `manual: true`, header-click→`applyGroupOrder`       | archived correctly, **but A1 cites it as live contract** [R2]                             |
| C2  | `archive/with-grouping/3-spec.md`                                                                                                                      | archived spec          | `status: ready` — the full `withGrouping()` contract synthesized from D1–D15                                                                                                                                                              | **current in substance, archived in location.** This is the document A1 sends every reader to for State Shape, Methods and public surface | **the core convention violation** — a permanent spec's contract lives in `archive/` [R17] |
| C3  | `archive/with-grouping/design-group-admission.md`                                                                                                      | archived design        | `when`/`enable` mechanism + rejected alternatives for cluster admission                                                                                                                                                                   | **current in substance**; cited live by A1's banner _and_ by B1 and B4                                                                    | same as C2 — live citation into `archive/` [R1][R10][R12]                                 |
| C4  | `archive/with-grouping/research-*.md` (6 files)                                                                                                        | archived research      | group ordering, state ownership, generic utilities, community pain, internal coverage, UX capabilities                                                                                                                                    | historical; correctly frozen. `research-grouping-community-pain.md` is still cited as live evidence by E4                                 | yes                                                                                       |
| C5  | `archive/with-grouping/issue-graph.md`                                                                                                                 | archived planning      | issue dependency graph for #24/#25/#26/#31/#84/#85/#87                                                                                                                                                                                    | historical                                                                                                                                | yes                                                                                       |
| C6  | `archive/with-grouping/docs/tasks/**` (51 files)                                                                                                       | archived task steps    | 8 step-sets: base (6 steps) + issue-24, -25, -26, -31, -84, -85, -87, each with its own `progress.md`                                                                                                                                     | all complete; execution artifacts, no unique rationale                                                                                    | yes — candidates for deletion per `trim-docs` [R6]                                        |
| C7  | `archive/grouping-expansion-coupling/plan.md`                                                                                                          | archived plan          | The finding that drove ADR-0017: `RenderRow` had `depth` but no parent link, so grouping had to read `expandedRows` itself                                                                                                                | **historical, fully landed** (#98/#99, ADR-0017)                                                                                          | yes [R18]                                                                                 |
| C8  | `archive/grouping-expansion-coupling/spec-132.md`, `architecture-132.md`, `issue-graph.md`, `prior-art.md`, `research-refetch-state-loss.md` (5 files) | archived spec/research | the `parentId` + central-prune design, verified against TanStack/AG Grid/MUI X                                                                                                                                                            | historical; `prior-art.md` is the evidence behind ADR-0017                                                                                | yes                                                                                       |
| C9  | `archive/grouping-expansion-coupling/docs/tasks/**` (8 files)                                                                                          | archived task steps    | 7 steps incl. `step-7-supersede-records`                                                                                                                                                                                                  | complete                                                                                                                                  | yes                                                                                       |

### Tier D — `3-ui/work/` (2 folders, 22 files)

|     | Path                                                 | Type               | Holds                                                                                                                                                                                            | Status                                                                                                                                          | Location OK?                                                   |
| --- | ---------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| D1  | `3-ui/work/grouping-stories/1-gap-analysis.md`       | episodic plan      | Pre-restructure coverage pass; story-by-story build plan                                                                                                                                         | **historical.** Its own frontmatter names `grouping-static/`, `grouping-regressions/`, `grouping-crud/` — all since deleted by D3's restructure | folder should be `archive/` [R19]                              |
| D2  | `3-ui/work/grouping-stories/2-host-audit.md`         | episodic audit     | The four criteria a copyable story host must not violate, applied to 4 hosts                                                                                                                     | historical, `audit complete, no changes applied`                                                                                                | same [R20]                                                     |
| D3  | `3-ui/work/grouping-stories/3-lesson-audit.md`       | episodic decisions | **The "one story, one lesson" restructure decision record** — 5 mixed hosts → 8 single-lesson hosts; `grouping-regressions/` + `grouping-crud/` deleted. Largest single grouping file (136 hits) | **current rationale, done work.** This is a real decisions doc named `*-audit.md`                                                               | same — and it is **not discoverable as a decisions doc** [R21] |
| D4  | `3-ui/work/grouping-stories/4-coverage-reaudit.md`   | episodic audit     | Re-derives every `0-product/grouping.md` mark against the 8-story set; found 4 regressed marks (doc claimed 11/5/1, reality 8/5/4)                                                               | **consumed** — it is D5's stated input, and D5 step 6 will amend it                                                                             | same [R22]                                                     |
| D5  | `3-ui/work/grouping-stories/docs/tasks/**` (9 files) | task steps         | 8 steps, **8/8 done**                                                                                                                                                                            | complete                                                                                                                                        | folder should be `archive/` [R23]                              |
| D6  | `3-ui/work/grouping-coverage/1-plan.md`              | episodic plan      | Executes D1–D4 closing the 4 regressed marks                                                                                                                                                     | **genuinely active**                                                                                                                            | yes [R24]                                                      |
| D7  | `3-ui/work/grouping-coverage/4-tasks/**` (9 files)   | task steps         | 7 steps: 1,2,3,4,7 ✅ done; **5 `▶ in progress`; 6 ☐ todo**                                                                                                                                     | **active**                                                                                                                                      | yes [R25]                                                      |

`grouping-coverage/state.json` points `decisionsPath` at a file in a **different work folder**
(`grouping-stories/4-coverage-reaudit.md`) — the two folders are one effort split in two. [R26]

### Tier E — strays: `docs/work/*`, outside any numbered stream (4 grouping files + 2 non-grouping)

|     | Path                                                            | Type      | Holds                                                                                                                                                                                                                                                  | Status                                                                                                                                                                                                                                                                                               | Location OK?                                                                              |
| --- | --------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| E1  | `docs/work/grouping-doc-audit/report.md`                        | audit     | 21 rows auditing `0-product/grouping.md` **against the engine**: 15 stale, 1 drift, 4 ok, 1 unverified. Carries a `## Resolution — 2026-09-19` section with 3 findings the audit itself missed                                                         | **resolved and applied**; 1 unverified row left open (F-G1's emptied group, needs a story run)                                                                                                                                                                                                       | **NO** — no numbered stream [R27]                                                         |
| E2  | `docs/work/spec-coverage-audit/grouping.md`                     | audit     | 26 stories vs. spec files; covered 14 / story 10 / spec 1 / unverified 1                                                                                                                                                                               | **superseded** by E3, which says so in its first line                                                                                                                                                                                                                                                | **NO** — no numbered stream [R28]                                                         |
| E3  | `docs/work/spec-coverage-audit/grouping-behavior-affordance.md` | audit     | Same corpus re-cut as behavior vs. affordance, deduped by decision point; **6 untested behaviors in bold**                                                                                                                                             | **current** — the live test-gap list for grouping                                                                                                                                                                                                                                                    | **NO** — no numbered stream [R29]                                                         |
| E4  | `docs/work/aggregate-config-placement/1-decisions.md`           | decisions | #100's `aggregateFn` slice: aggregation stays grouping-owned (no `withAggregation()`); `applyAggregate` declared through `GroupingPath`; **`ColumnDef.aggregateFn` deleted outright**; no construction-time validation; sequencing before #47 then #45 | **active, undated D-numbers** — bullets are date-stamped but unnumbered, so nothing else can cite them                                                                                                                                                                                               | **NO** — and it is a **grouping** decision sitting outside `1-state/work/grouping/` [R30] |
| E5  | `docs/work/trim-docs/decisions.md`                              | decisions | Repo-wide docs trimming (#46); the tier-4 measurement quoted in Method                                                                                                                                                                                 | not grouping-owned; same stray-location problem                                                                                                                                                                                                                                                      | **NO** [R6]                                                                               |
| E6  | `docs/work/adr-scope-audit/1-audit.md`                          | audit     | All 18 ADRs judged by "can someone editing a different file violate this?"                                                                                                                                                                             | not grouping-owned. **Not the authoritative status source** — the original draft thought so because it grepped YAML `status:` only; every ADR carries `**Status:**` on line 3, so the ADR file itself is authoritative. This audit is still useful for _scope_ judgements, and covers 0001–0018 only | **NO** [R13][R39]                                                                         |

### Tier F — ADRs, ranked by how load-bearing they are for grouping

|     | ADR                                                               | Status [R13]                                          | Why grouping cares                                                                                                                                                                                                      | Cited by A1 today?       |
| --- | ----------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| F1  | `0017-engine-owned-descendant-prune.md`                           | accepted, implemented (#98)                           | **Collapse/expand is not grouping's code.** The engine `'prune'` stage unions every feature's `expandedRows`; `withGrouping()` emits unconditionally and stamps `parentId`                                              | yes, banner only [R31]   |
| F2  | `0011-chained-render-stages.md`                                   | accepted (stage allocation partly superseded by 0017) | `withGrouping()` claims the `'group'` render stage; `RENDER_ORDER` derives `RenderStages`                                                                                                                               | yes, one link [R32]      |
| F3  | `0021-column-concerns-and-data-concerns-are-separate-surfaces.md` | accepted [R39]                                        | **Governs which path names what.** Grouping's schema fn names _row fields_; `columnsSchema` names _declared column ids_. This is D7's home and E4's controlling ADR; its Open #1 is the field→column-id translation gap | **no** [R33]             |
| F4  | `0018-when-vs-enable-predicate-naming.md`                         | accepted                                              | Grouping is **the only feature** with the two-predicate shape the ADR exists for                                                                                                                                        | **no** [R14]             |
| F5  | `0019-columns-path-keyed-by-declared-column-ids.md`               | accepted 2026-09-18, amended [R39]                    | The ADR D7 amends; B2's Phase B is gated on its inference spike                                                                                                                                                         | **no** [R10]             |
| F6  | `0014-runtime-error-policy.md`                                    | proposed                                              | `aggregateFn` is a consumer callback — must degrade, not throw. Three wrap sites already in `engine/grouping.ts`                                                                                                        | **no** [R13]             |
| F7  | `0022-render-row-cell-values.md`                                  | accepted [R39]                                        | `buildGroupCells` spreads `aggregates` into column-id-keyed `cells` — the mechanism E4's counter-example turns on                                                                                                       | **no** [R30]             |
| F8  | `0006-row-id-state-reconciliation.md`                             | accepted                                              | Group ids are synthetic `RowId`s that enter `expandedRows`; `onRowsRemoved` pruning applies                                                                                                                             | **no** [R13]             |
| F9  | `0012-split-expansion-into-panel-and-tree.md`                     | proposed                                              | Claims `'tree'`, leaving `'group'` free. Read before touching render stages                                                                                                                                             | **no** [R13]             |
| F10 | `0015-feature-member-namespacing.md`                              | accepted, **unimplemented**                           | `grouping` already ships as a `WritableView`; C1's D16 call-site form is pending this                                                                                                                                   | yes, C1 mentions it [R2] |
| F11 | `0007`, `0020`                                                    | accepted / —                                          | member-claim collisions; third-party stage anchoring. Background only                                                                                                                                                   | no                       |

### Tier G — tangential (mentions grouping, does not own a grouping decision)

Listed so they rest under no claim, **not inventoried in depth**: `2-columns/work/pinning/discovery-pinning-under-grouping.md` (44 hits — a real discovery doc, but its question is _pinning_) [R34] · `2-columns/work/column-id-identity/discovery-non-field-column-ids.md` (65) · `2-columns/reference/tier-3-feature-config.md` (10) · `tier-1-intrinsic.md` (3) · `1-state/columns.md` (3) · `1-state/prd.md` (15) · `1-state/architecture.md` (11) · `1-state/state-persistence.md` (6) · `3-ui/stories.md` (47) · `3-ui/architecture.md` (12) · `0-product/performance.md` (7) · `1-state/work/core/active/prune-stage-revisit/**` (grouping-adjacent — revisits ADR-0017's stage) · `1-state/work/core/active/render-row-cell-values/4-tasks/step-4,-6,-8` (three steps operate on grouping code) · `1-state/work/meta/archive/state-feature-competitive-audit/gap-analysis.md` (A1's cited competitive reasoning).

### Counts

| Bucket                           | Files                             |
| -------------------------------- | --------------------------------- |
| Tier A permanent + generated     | 4                                 |
| Tier B active state-layer work   | 6                                 |
| Tier C archived state-layer work | 75 (24 rationale + 51 task steps) |
| Tier D UI-layer work             | 22 (7 rationale + 15 task steps)  |
| Tier E strays under `docs/work/` | 4 grouping + 2 adjacent           |
| **Grouping-owned total**         | **111**                           |
| ADRs grouping cares about        | 12                                |
| Files mentioning grouping at all | 265                               |

## Synthesis

Where the sources disagree, and what each disagreement implies:

- **A1 vs. C2 — who holds the contract.** A1 is the permanent spec; C2 holds the contract A1
  describes. Both are correct documents; the convention is what broke. An agent following
  `CLAUDE.md`'s "locate the spec in the stream folder" lands on A1 and reads a superseded-banner
  page that tells it to go read an archived file. Implies: **A1 must absorb C2, not link to it.**
- **Four D-namespaces, three of them mutually redefining.** C1 D1–D17 · B1 D1–D9 · B5 D1–D7 ·
  E4 unnumbered. B1's D1 supersedes C1's D6/D7; B1's D2 reverses C1's D8; B5 reopens C1's D2.
  Nothing tells a reader which D-space a bare "D7" is in. Implies: **the rollup is the deliverable,
  not a nice-to-have** — and it must carry its own numbering, not reuse any folder's.
- **`status:` frontmatter and `state.json` disagree with shipped code, four times.** B3 says
  "not started" for work that shipped in `4c86322`; B4 says
  "pending" for work ADR-0018 records as accepted; B5's `state.json` says `issues: false,
tasks: false` for work A1 records as shipped; A3/A4 say the UI layer is `stub`/`none` while the
  UI layer's actual claim ("no directive needed") was decided and holds. Implies: **do not trust
  a work folder's own status field** — this is the concrete instance of the global rule that
  always-loaded status goes stale silently. The original draft of this very document then did
  exactly that on B3, which is why the corrections banner exists: **check `src` and `git log`, not
  frontmatter, before any archive/active call.**
- **Three audits, three axes, no consolidation.** E1 audits the product doc against **the engine**
  (resolved). E3 audits **spec coverage** by decision point (current — 6 untested behaviors).
  D4 audits the product doc against **the stories** (consumed by D6). None supersedes another; D4
  explicitly says so. Implies: they are not duplicates and **must not be merged** — but E3's six
  bolded untested behaviors are live engineering work sitting in a stray folder with no owner.
- **The stray `docs/work/` folders are not an accident, they are a second convention.** Six
  folders, three of them domain-wide by design (`trim-docs` says so in its first line: "Workspace
  is domain-wide, not tier-scoped"). E4 is the odd one out — a purely grouping decision that
  landed there because the effort was filed against issue #100, not against grouping. Implies:
  **the repo-wide ones may have earned the location; E4 did not.**

## Proposal

> **Superseded 2026-09-20 by
> [`active/doc-consolidation/1-plan.md`](active/doc-consolidation/1-plan.md).**
> That plan accepts this section's core — two files, fold the archived spec into the permanent
> one, own `G`-numbering, an explicit ADR section — with three changes:
>
> 1. The decisions log moves **out of `work/`** to `docs/decisions/grouping.md`. `work/` is
>    episodic by this repo's own definition, so a permanent read-first artifact there gets
>    archived with its neighbours — and a log spanning product, state and UI should not sit
>    inside a numbered stream either. `docs/` root already holds `adr/`, `work/` and
>    `status.md` unnumbered for that reason.
> 2. A **rollup step** is added (a work folder cannot be archived until its decisions are
>    registered in the log). Without it this cleanup is a one-off and the sprawl returns.
> 3. The log format is defined **capability-agnostically** and piloted on grouping, so
>    filtering/selection/expansion do not each invent their own.
>
> Read the plan for the executable form; the sections below remain as the reasoning behind it.

### 1. The minimal source of truth — two files

**`docs/1-state/features/grouping.md`** becomes the actual contract. Fold `archive/with-grouping/3-spec.md` (C2) into it: State Shape, Methods, Public surface, group admission. Delete the
70-line superseded banner — a banner explaining what an old draft got wrong is only needed while
the old draft is still the body. Keep from today's file: pipeline clustering, `RenderRow`/
`renderRows` design, aggregation contract, prior-art comparison, competitive verdict. Add an
explicit **"ADRs that constrain this feature"** section (see 4). Bump `version`, keep the
`capability`/`spec`/`code` frontmatter so `status.md` still regenerates.

**`docs/1-state/work/grouping/decisions-log.md`** — new, and it is the piece that does not exist
today. One chronological table, **its own numbering** (`G1…Gn`, never reusing a folder's D-number),
one line per decision, a link to the full record, and nothing restated:

|     | Decision (one line)                                                 | Date       | Status            | Full record                               |
| --- | ------------------------------------------------------------------- | ---------- | ----------------- | ----------------------------------------- |
| G1  | Write surface is `table.grouping.update(updater)`, not bare setters | 2026-09-10 | shipped           | `archive/with-grouping/2-decisions.md` D1 |
| …   | …                                                                   |            | superseded by G14 |                                           |

Supersession is expressed **in the log**, so a reader never has to reconstruct it by diffing four
folders. Rule for the log: if a row needs a second line, it belongs in the linked record.

Why two files and not one: the contract answers _what does this do today_; the log answers _why,
and what was tried_. Merging them puts 40 rows of history in front of the contract. Why not
three: `0-product/grouping.md` is deliberately a different audience and the docs convention
already owns that split — it stays as is.

### 2. Archive these — the work is done

| Folder                                                     | Move to                               | Evidence                                                                                                                                   |
| ---------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `1-state/work/grouping/active/per-column-group-admission/` | `…/archive/`                          | ADR-0018 accepted; `CLAUDE.md` documents the shipped `{ enable?, when }` shape                                                             |
| `1-state/work/grouping/active/column-group-index/`         | `…/archive/`                          | A1 records `groupingLevels()`/`isGroupedBy()` shipped (#81); fix its stale `state.json` checklist on the way                               |
| `3-ui/work/grouping-stories/`                              | `3-ui/work/archive/grouping-stories/` | 8/8 steps done. **Before moving, promote `3-lesson-audit.md`** — it is the restructure decision record, not an audit, and D6 depends on it |

Stay active: `grouping-config-simplification` (D6 open, D9 unbuilt, D5/D7/D9 uncommitted) and
`grouping-coverage` (steps 5 `▶`, 6 `☐`).

Note: `3-ui/work/` has no `archive/` subfolder today, unlike `1-state/work/<capability>/`. Either
create one or adopt the same `<capability>/active|archive` shape on the UI side — a convention
decision, flagged not taken.

### 3. Move the strays

| From                                                                            | To                                                              | Why                                                                                                                                                                       |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/work/aggregate-config-placement/`                                         | `docs/1-state/work/grouping/active/aggregate-config-placement/` | Purely a grouping decision (aggregation stays grouping-owned, `applyAggregate` through `GroupingPath`). Number its bullets `D1…Dn` on the way so the rollup can cite them |
| `docs/work/grouping-doc-audit/`                                                 | `docs/1-state/work/grouping/archive/doc-audit/`                 | Resolved; keep for the 1 unverified row                                                                                                                                   |
| `docs/work/spec-coverage-audit/grouping.md` + `grouping-behavior-affordance.md` | `docs/1-state/work/grouping/active/spec-coverage/`              | E3 is **active engineering work** — 6 untested behaviors with named owners. Keep E2 alongside it, marked superseded, since E3 references it                               |

Leave `docs/work/trim-docs/` and `docs/work/adr-scope-audit/` where they are — both are genuinely
domain-wide and say so. But `CLAUDE.md`'s docs table should name `docs/work/<slug>/` as the
sanctioned home for cross-stream efforts, so it stops reading as a violation.

### 4. ADRs the feature spec must cite explicitly

In descending order of "an agent will get this wrong without it": **0017** (collapse is not
grouping's code — the single most load-bearing, and A3 still documents the pre-0017 world),
**0021** (row fields vs. column ids — the surface every new grouping declarator lands on),
**0018** (`when`/`enable` — grouping is the only feature with this shape), **0011** (the `'group'`
render stage), **0014** (`aggregateFn` degrades, never throws), **0019** (what 0021's D7 amends),
**0022** (`buildGroupCells` and the `aggregates`→`cells` spread). Cite **0012** and **0006** as
background. Nine of these are uncited by A1 today.

### 5. Fix or retire `3-ui/directives/grouping.md`

It is the only grouping doc that is wrong rather than merely incomplete, and `status.md` publishes
it as the UI-layer answer. Either rewrite it against shipped code, or reduce it to its one durable
decision ("no `ngpTableGroupBy` directive, and why") plus the open to-drill list, and drop every
API reference. The five open to-drill items are still genuinely open and worth keeping.

### 6. Deletion, deliberately not proposed

The 66 task-step files in C6/C9/D5 are `trim-docs`' stated target. **Not recommended here** — that
is `trim-docs`' decision to make repo-wide, not grouping's to make unilaterally. Named so it is on
the record.

## Not researched

- `libs/table/src/**` — **partially closed 2026-09-20.** The grouping declarator/member surface
  was verified (`index.ts`, `with-grouping/**`, `engine/grouping/**` by grep). Everything else —
  render-stage wiring, aggregation internals — still rests on docs.
- GitHub issue state. Issues #7, #24–#26, #31, #45, #47, #81, #84–#87, #98–#100, #115, #134 are
  named across these docs; none was opened. Several archive/active calls would sharpen with it.
- Git history — **partially closed 2026-09-20.** `git log` on `with-grouping/` was read and
  corrected B1/B3. D7's "uncommitted" claim is still doc-quoted, not checked.
- The 73 rolled-up task-step files were not read individually.
- `apps/site/` — the docs site may render grouping content not counted here.

## Unverified

- ~~**B4 and B5 are "done".**~~ **Resolved 2026-09-20 — both confirmed against source.**
  `groupingLevels`/`isGroupedBy` at `src/api/features/with-grouping/feature.ts:74,78,179`;
  `enable`/`when` at `feature.ts:116`. Both archive calls stand. [R37]
- **D3 (`3-lesson-audit.md`) is a decisions doc, not an audit.** Read only its first 30 lines —
  §0 is explicitly "Decisions… taken story by story with the user". §2–§4 were not read and may be
  pure analysis.
- **Whether `0-product/grouping.md` is currently accurate.** Its rewrite is `▶ in progress` as
  grouping-coverage step 5; its frontmatter marks (11/5/1) match the plan's _target_, and step 6
  has not run.
- ~~**ADR statuses for 0019, 0021, 0022.**~~ **Resolved 2026-09-20 — the premise was wrong.**
  Every ADR carries `**Status:**` on line 3 (bold markdown, not YAML frontmatter); the original
  grep looked for the YAML form only. 0019 accepted+amended, 0021 accepted, 0022 accepted. [R39]
- E1's one remaining `unverified` row (F-G1, an emptied group disappearing) needs a story run, not
  a doc edit — still open.

## Sources

|     | Source                                                                                                                                                       | Verified                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | `libs/table/docs/1-state/features/grouping.md:15-70` (superseded banner)                                                                                     | yes — read; the banner is what reclassified A1 from "canonical spec" to "shell"                                                                                 |
| R2  | `libs/table/docs/1-state/work/grouping/archive/with-grouping/2-decisions.md:1-30`                                                                            | yes — read; `status:` confirms D1–D17 settled, 2 open                                                                                                           |
| R3  | `libs/table/docs/1-state/work/grouping/active/grouping-config-simplification/2-decisions.md:1-60`                                                            | yes — read; D1/D2 explicitly supersede archived D6/D7/D8                                                                                                        |
| R4  | `libs/table/docs/1-state/work/grouping/active/grouping-config-simplification/2-decisions.md:38-43`                                                           | yes — read; "D7's accepted consequence is retired" — the collision that proves the D-namespace problem                                                          |
| R5  | `libs/table/docs/1-state/work/grouping/active/column-group-index/2-decisions.md:1-30`                                                                        | yes — read; "Directly re-opens **D2**" in the archived set                                                                                                      |
| R6  | `libs/table/docs/work/trim-docs/decisions.md:1-45`                                                                                                           | yes — read; supplied the tier-4 measurement used in Method                                                                                                      |
| R7  | `libs/table/docs/0-product/grouping.md:1-70`                                                                                                                 | yes — read; frontmatter dated 2026-09-19                                                                                                                        |
| R8  | `libs/table/docs/3-ui/directives/grouping.md:37`                                                                                                             | yes — read; "`withGrouping()` itself is unimplemented" — the claim that makes A3 actively wrong                                                                 |
| R9  | `libs/table/docs/status.md:24`                                                                                                                               | yes — read; the grouping capability row                                                                                                                         |
| R10 | `libs/table/docs/1-state/work/grouping/active/grouping-config-simplification/1-plan-config-simplification.md:1-40`                                           | yes — read; carries its own amendment banner                                                                                                                    |
| R11 | `libs/table/docs/1-state/work/grouping/active/grouping-config-simplification/3-plan-declarator-split.md:1-40`                                                | yes — read; `status:` "approved 2026-09-19, not started"                                                                                                        |
| R12 | `libs/table/docs/1-state/work/grouping/active/per-column-group-admission/1-plan-when-enable-rename.md:1-40`                                                  | yes — read; `status:` "rename + ADR-0018 pending" — contradicted by R13                                                                                         |
| R13 | `libs/table/docs/work/adr-scope-audit/1-audit.md:20-40`                                                                                                      | yes — read; the only per-ADR status table in the repo. Corrected R12: ADR-0018 is accepted, not pending                                                         |
| R14 | `libs/table/CLAUDE.md` — `when` vs `enable` invariant                                                                                                        | yes — read; documents `applyGrouping({ enable?, when })` as the shipped shape, confirming R12's rename landed                                                   |
| R15 | `libs/table/docs/1-state/work/grouping/active/column-group-index/3-spec.md:1-25`                                                                             | yes — read; `status: ready`                                                                                                                                     |
| R16 | `libs/table/docs/1-state/work/grouping/active/column-group-index/state.json`                                                                                 | yes — read; `checklist.issues`/`tasks` false, contradicted by R1's shipped claim                                                                                |
| R17 | `libs/table/docs/1-state/work/grouping/archive/with-grouping/3-spec.md:1-30`                                                                                 | yes — read; `status: ready`, and explicitly "**Supersedes** `features/grouping.md`" — an archived file superseding a permanent one                              |
| R18 | `libs/table/docs/1-state/work/grouping/archive/grouping-expansion-coupling/plan.md:1-25`                                                                     | yes — read; the `RenderRow` parent-link gap behind ADR-0017                                                                                                     |
| R19 | `libs/table/docs/3-ui/work/grouping-stories/1-gap-analysis.md:1-20`                                                                                          | yes — read; frontmatter names three since-deleted stories                                                                                                       |
| R20 | `libs/table/docs/3-ui/work/grouping-stories/2-host-audit.md:1-20`                                                                                            | yes — read; "audit complete, no changes applied"                                                                                                                |
| R21 | `libs/table/docs/3-ui/work/grouping-stories/3-lesson-audit.md:1-30`                                                                                          | yes — read §0 only; "This section is the record"                                                                                                                |
| R22 | `libs/table/docs/3-ui/work/grouping-stories/4-coverage-reaudit.md:1-30`                                                                                      | yes — read; names E1 and D1 as neither superseded                                                                                                               |
| R23 | `libs/table/docs/3-ui/work/grouping-stories/docs/tasks/progress.md`                                                                                          | yes — read; "8 / 8 complete"                                                                                                                                    |
| R24 | `libs/table/docs/3-ui/work/grouping-coverage/1-plan.md:1-45`                                                                                                 | yes — read; D1–D4 and the 11/5/1 vs 8/5/4 discrepancy                                                                                                           |
| R25 | `libs/table/docs/3-ui/work/grouping-coverage/4-tasks/progress.md`                                                                                            | yes — read; step 5 `▶`, step 6 `☐`                                                                                                                             |
| R26 | `libs/table/docs/3-ui/work/grouping-coverage/state.json`                                                                                                     | yes — read; `decisionsPath` points into `grouping-stories/`                                                                                                     |
| R27 | `libs/table/docs/work/grouping-doc-audit/report.md`                                                                                                          | yes — read in full; 15 stale / 1 drift / 4 ok / 1 unverified, plus the Resolution section                                                                       |
| R28 | `libs/table/docs/work/spec-coverage-audit/grouping.md:1-40`                                                                                                  | yes — read; superseded by R29                                                                                                                                   |
| R29 | `libs/table/docs/work/spec-coverage-audit/grouping-behavior-affordance.md:1-45`                                                                              | yes — read; first line states it supersedes R28; 6 bolded untested behaviors                                                                                    |
| R30 | `libs/table/docs/work/aggregate-config-placement/1-decisions.md`                                                                                             | yes — read in full; `ColumnDef.aggregateFn` deleted outright, `applyAggregate` via `GroupingPath`                                                               |
| R31 | `libs/table/docs/adr/0017-engine-owned-descendant-prune.md` (title line)                                                                                     | yes — title read; substance cross-read via R1, R18, R29                                                                                                         |
| R32 | `libs/table/docs/adr/0011-chained-render-stages.md` (title line)                                                                                             | yes — title read; stage-claim substance via R13 row 0011                                                                                                        |
| R33 | `libs/table/docs/adr/0021-column-concerns-and-data-concerns-are-separate-surfaces.md` (title line)                                                           | yes — title read; grouping relevance established via R30, which cites it as controlling                                                                         |
| R34 | `libs/table/docs/2-columns/work/pinning/discovery-pinning-under-grouping.md:1-20`                                                                            | yes — read; confirmed its question is pinning, so filed tangential                                                                                              |
| R35 | `grep -ci "grouping\|withGrouping\|groupBy\|GroupRow" libs/table/docs/**/*.md`                                                                               | yes — ran; 3,576 hits / 265 files                                                                                                                               |
| R36 | `libs/table/CLAUDE.md` — "Docs structure — three streams"                                                                                                    | yes — read; the convention every location verdict is measured against                                                                                           |
| R37 | `libs/table/src/api/features/with-grouping/feature.ts:74,78,116,179`, `schema.ts:54,74,122`, `src/index.ts:73`                                               | yes — grepped 2026-09-20; confirms `groupingLevels`/`isGroupedBy`/`enable`/`when`/`applyGroupKey`/`applyGroupOrder` all ship, and `applyAggregate` does **not** |
| R38 | `git log --oneline -- libs/table/src/api/features/with-grouping/` → `4c86322 refactor(table)!: split grouping declarators — applyGroupKey, label on initial` | yes — ran 2026-09-20; the commit that invalidates B3's "not started"                                                                                            |
| R39 | `grep -i "^(status\|\*\*Status)" libs/table/docs/adr/` → 22 matches                                                                                          | yes — ran 2026-09-20; every ADR carries a status line, most as `**Status:**` not YAML. 0019 accepted+amended, 0021 accepted, 0022 accepted                      |
