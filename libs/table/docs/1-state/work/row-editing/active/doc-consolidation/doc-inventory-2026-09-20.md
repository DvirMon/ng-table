---
title: Doc inventory — every row-editing doc in libs/table/docs, verified against src
type: discovery
capability: row-editing
date: 2026-09-20
audience: maintainers
---

# Which documents carry decisions or claims about row-editing, and what do they disagree on?

**Date:** 2026-09-20 · **Depth:** standard

> **This is a discovery artifact, not a decision.** Nothing here has been agreed, nothing was
> moved, and no file outside this one was edited. Step 1 of
> [`docs/agents/capability-docs.md`](../../../../../agents/capability-docs.md). No consolidation
> plan is proposed — that is the main session's next step.

## Answer

**Row-editing does *not* have grouping's core defect.** No archived file claims to supersede
`1-state/features/row-editing.md`; every work folder opens with "this file is the reasoning, not
the contract." [R6][R9][R10][R11] What it has instead are three different problems.
**(1) One global `D1…D57` sequence spans five folders** — deliberately, and it mostly works — but
**three further `D1…Dn` namespaces sit inside it** (`optimistic-ui-state-patterns` D1–D5,
`row-edit-keyboard-a11y` D1–D2, and `with-mutations`' own global D1–D5), and
`with-optimistic-crud` **numbers two decisions D48**, a defect logged 2026-08-28 and still
unfixed. [R7][R13][R17][R20] **(2) The permanent spec is stale against shipped code in five
verified places** — `RowRestorePoint.detached` was replaced by `op`, `EditingState` gained
`unconfirmed`, `OptimisticMembers` gained `pendingOps`/`unconfirmed`, `RowEditMembers` "adds
nothing" but actually adds `draft`, and §8 names two stories that no longer exist. [R1][R22][R24]
**(3) `table.draft` — a shipped public member — has no decision record at all**, in any
namespace. [R24][R12]

## Method

- Search: `grep -i "withRowEdit|withOptimistic|beginEdit|captureEdit|RowRestorePoint|row-edit|
  optimistic"` over `libs/table/docs/**/*.md` — 1,230 hits across 122 files. [R40] This inventory
  covers the **51 files row-editing owns** plus 10 ADRs and 3 adjacent core folders.
- Read in full: all three permanent docs, all 8 state-layer decision/design files, all 5
  UI-layer files, 4 `state.json`s, ADR-0006 and ADR-0013.
- **Source verified, not doc-derived:** `src/index.ts`, `src/api/features/editing/state.ts`,
  `src/mutations/*.ts`, `src/api/features/with-row-edit.ts`, `src/api/features/with-optimistic.ts`,
  `src/engine/rows.ts`, `src/api/types.ts`, `src/stories/row-edit/**` (by grep + glob).
- **Task-step files are rolled up per folder, not row-per-file.** 23 of the 42 state-layer files
  are `step-*.plan.md` / `progress.md` under `docs/tasks/` — execution output, not rationale.
- **Reliability — git history could not be read.** No shell tool is available in this session
  (`Bash` disabled, no PowerShell tool exposed), and `.git/logs/HEAD` only reaches back to
  2026-09-17, after every row-editing commit. [R41] Every "shipped / not shipped" call below is
  therefore made against **`src/` only**, which is the stronger check the procedure asks for —
  but commit hashes quoted in the docs are unverified.

## Inventory

### Tier A — permanent docs (4 files)

| | Path | Type | Holds | Status | Location OK? |
|---|---|---|---|---|---|
| A1 | `docs/1-state/features/row-editing.md` | permanent state spec | v2.1, dated 2026-08-27. `capability: row-editing · spec: drilled · code: shipped`. The full contract: three shapes, the two features, `EditingState`/`RowRestorePoint`, the nine updaters, flows, accepted costs, open questions O11/O15–O17/O19 | **holds its own contract — but stale in 5 verified places** (see Comparison). Its 6 work-folder links are all broken paths | yes [R1] |
| A2 | `docs/1-state/row-mutations.md` | permanent **core-API** spec | v1.1, 2026-09-09. `table.value.update()`, `insertRow`/`removeRow`/`patchRow`, `at` splice semantics, temp-id swap, `batch()`/bulk deferral, O6/O20 | **not a row-editing feature spec — D8 puts mutation in core.** Free-text `status:`, no `capability:` field, so it is invisible to `status.md` | yes [R2] |
| A3 | `docs/0-product/row-editing.md` | product doc | 2026-09-05. Full CRUD user stories for gated + live, coverage marks, §6 seven open questions, §7 "not user-facing" | **current**; its frontmatter `status:` is **gone** — which silently closes item 3 of the doc-corrections handoff (A5) | yes [R3][R4] |
| A4 | `docs/status.md` | generated roll-up | `row-editing` row: state `spec: drilled, code: shipped`; UI `—`; Decisions `—` | accurate. `—` in Decisions = not consolidated, which is why this run exists | yes — generated [R5] |

**There is no `docs/3-ui/directives/row-editing.md`** — confirmed by glob; the directives folder
holds 9 files and none is row-editing. [R25] **There is also no `docs/3-ui/cookbook/`**, the
location D2 of `row-edit-keyboard-a11y` chose for the recipe that replaces a directive. [R26]
What covers the UI layer today is four work files (Tier D) plus the shipped
`*ngpTableRowField` directive (`src/directives/ngp-table-row-field.directive.ts` +
`src/forms/index.ts`, D33), which is documented **only inside A1 §1**, not in a UI doc. [R23]

### Tier B — `1-state/work/row-editing/active/` (4 folders, 9 rationale files + 2 `state.json`)

| | Path | Type · numbering | Holds | Active or archived? |
|---|---|---|---|---|
| B1 | `active/with-row-editing/2-decisions.md` | decisions · **D10, D13–D18, D20–D25, D28, D29, D31(+.1–.5), D33, D34, D35, D36, D49** (global series) | The editing cluster's foundational grill, 1,209 lines. Also holds an unnumbered "Analysis — form scope", the E3/E4 review disposition table, and the G8 renumbering table | **misfiled as active — every decision in it is shipped or superseded.** Only its Open section still carries live items | [R6] |
| B2 | `active/with-row-editing/5-gaps.md` | gaps · **G1–G13** (state) + an O-index | The state-layer gap register. G2/G3/G4/G8/G12 closed; **G5 (move) and G13 (`closeAllButLast` discards a draft) open**; G6 in progress elsewhere. Carries two "superseded in part" banners | **genuinely active** (G5, G6, G13) — but its body still uses v1.0 verb names throughout, by its own admission [R12] |
| B3 | `active/with-row-editing/4-increments.md` | plan · **E1–E6, E2b, E5'** | Delivery slicing; the finding that D25/O15/O16/O17 are phantom on `withFiltering()` | **stale — `status: proposed`, dated 2026-08-13**, and its central premise ("`api/features/` contains only `with-sorting.ts` and `with-expansion.ts`") is false: filtering, grouping, selection all ship now [R14][R21] |
| B4 | `active/with-row-editing/3-research-edit-pipeline.md` | research · unnumbered | AG Grid / MUI X / Excel / Airtable / WCAG 3.2.2 evidence behind O14→D20 | historical, correctly frozen. The one load-bearing claim was fetched from ag-grid.com and verified [R15] |
| B5 | `active/optimistic-pessimistic-api/1-proposal.md` | plan · steps 0–7 | The sequenced plan: four verb families, `commitEdit`/`closeEdit` split, `beginEdit` loses `{ insert }`, pessimistic-create composer form, R1–R5 risks, an ASCII step graph | **genuinely active and its status is accurate** — steps 0/1/2 done, 3a onward not started. Verified against `src/`: `commitEdit`/`closeEdit` do not exist, `BeginEditOptions` still exported [R16][R22] |
| B6 | `active/optimistic-pessimistic-api/2-decisions.md` | decisions · **D50, D53, D54 written; D51, D52, D55–D57 reserved** | D50 (call-site facts), D53 (`detached`→`op`), D54 (`unconfirmed` slice). Reserves the rest of the global sequence so a concurrent effort cannot take D50 | **active.** D53 and D54 are **shipped and verified in `src/`**; D51/D52/D55–D57 are titles only [R17][R22] |
| B7 | `active/doc-corrections/1-handoff.md` | plan · 3 unnumbered items | (1) A1 §9's "saving flicker" is not real; (2) `with-optimistic-crud`'s two D48s; (3) A3's stale frontmatter | **`status: open — not started`, dated 2026-08-28. Partly rotted:** item 3's premise is gone (A3 has no `status:` field at all now), item 1 is still true in A1 §9, item 2 is still true [R13][R1][R3] |
| B8 | `active/doc-consolidation/state.json` | run state | This run. `capabilityLogPath: libs/table/docs/decisions/row-editing.md`, `decisionsPath: .../1-decisions.md` | correct; neither target file exists yet [R18] |
| B9 | `active/with-row-editing/state.json` | run state | `checklist: { spec: false, issues: false, tasks: false }` | **wrong twice.** The spec (A1) exists and is `drilled`; and every path inside points at the **acme monorepo** (`libs/shared/design-system/src/ui/table/...`), not this repo [R19] |

`active/optimistic-pessimistic-api/` and `active/doc-corrections/` have **no `state.json`** —
B5 names that as an unfinished part of its own step 0. [R16]

### Tier C — `1-state/work/row-editing/archive/` (7 folders, 8 rationale files + 23 task steps + 2 `state.json`)

| | Path | Type · numbering | Holds | Notes |
|---|---|---|---|---|
| C1 | `archive/with-mutations/2-decisions.md` | decisions · **D1–D9, D11, D12, D19, D26, D27, D30, D32** (global) | The mutation core: `data` is the single source of truth, no CRUD methods, `updateRows`→`table.value.update`, `at` splice semantics, temp ids, bulk-as-arity. Plus two unnumbered sections ("Engine review", "Insertion position") | **the parent of the whole cluster.** A2 is its contract. Its D1 is *not* `optimistic-ui-state-patterns`' D1 (C6) [R9] |
| C2 | `archive/with-optimistic/2-decisions.md` | decisions · **D37–D44**, plus **A1, A2** amendments | The two-feature split. D37 ownership, D38 naming, D39 live tables, D40 `captureEdit`, D41 `endEdit`/`releaseEdit`, D42 `beginEdit({insert})`, D43 triggers, D44 `clearEditing`. A1 dropped `cancelEdit`; **A2 corrected D37 itself** — both features call one `createEditingStore()`, neither composes the other | **A2 is load-bearing and is still mis-cited elsewhere** — ADR-0015 repeats D37's superseded framing [R10][R30] |
| C3 | `archive/with-optimistic-crud/2-decisions.md` | decisions · **D45, D46, D47, D48 — and a second D48** | Delete rollback: restore point carries `at`+`detached`; `ABSENT` deleted (breaking); `removeEdit`/`patchEdit`; O(1) `indexById` lookups. Second D48 drops the `restored` signal. Own local **OQ-A…OQ-D** namespace | **the D48 collision is the single worst numbering defect in the capability.** Flagged by B7 on 2026-08-28, unfixed [R11][R13] |
| C4 | `archive/with-multiple-edit/1-design.md` | design · **no numbering at all** | Closes G4/product OQ-7. Finds the real defect (`clearEdit`/`closeAllButLast` drop live restore points under `multiple: true`), resolves it by making bulk edit optimistic-only, and **decides mode-flip `true`→`false` closes all rows with no survivor** | **carries real, citable decisions with no number to cite.** Also: it never mentions `draft`, though B2's G13 attributes `draft` to this folder [R20][R12] |
| C5 | `archive/with-duplicate-row/1-design.md` (+ 5 task files) | design · **no numbering** | Duplicate needs no new API; `at: sourceIndex + 1` placement rule; two breaking renames (`addRow`→`insertRow`, `clearEditing`→`clearEdit`) | same problem as C4 — two shipped breaking renames with no D-number [R27] |
| C6 | `archive/optimistic-ui-state-patterns/decisions.md` | decisions · **D1–D5, folder-local** | Design-first optimistic architecture: table holds the rollback state; restore point = prior row + position; one write per row in flight; fresh server data moves the fallback; **D5 tags the restore point with its operation** | **a second `D1…Dn` namespace inside the capability**, stated in its own header. **Its D5 is the design that later became global D53** — reached twice, in two namespaces, and only D53 shipped [R7][R17] |
| C7 | `archive/optimistic-ui-state-patterns/research.md` | research · unnumbered | TanStack Query / Apollo / RTK Query / Replicache / Linear / Figma / AG Grid, source-verified for the open-source five | historical; correctly frozen [R28] |
| C8 | `archive/swap-row-id/1-handoff.md` | plan · implements **D49** | Why "enforce end-edit-first" was rejected; the effect-scheduling invariant the two-call order relies on | shipped 2026-09-03; `swapRowId` verified in `src/mutations/optimistic-mutations.ts:197` [R29][R22] |
| C9 | `archive/with-mutations/docs/tasks/**` (18 files) + `with-duplicate-row/docs/tasks/**` (5) | task steps | issue-11 data ingress, issue-12 row mutations, issue-13 column mutations; the 4 duplicate-row steps | execution artifacts, **rolled up not enumerated**. `step-2-fix-beginedit-invariant-doc.plan.md` is the one carrying a real finding [R27] |
| C10 | `archive/with-mutations/state.json`, `with-duplicate-row/state.json` | run state | both point at acme-monorepo paths (`libs/shared/design-system/...`, `libs/shared/table/...`); `with-mutations` lists `githubIssues: [46,47,48]` while its body says "shipped as issue #12" | stale from the repo extraction [R19] |

### Tier D — UI layer, `3-ui/work/` (3 folders, 5 files)

| | Path | Type · numbering | Holds | Status |
|---|---|---|---|---|
| D1 | `3-ui/work/row-editing/5-gaps.md` | gaps · **G1, G7, G9, G10, G11** — the *same* G-numbers as B2, moved not renumbered | The UI register: no keyboard story, no focus management, no a11y contract, retained-row affordance (phantom), save-gating. Indexes **O17** | **open — nothing in it has shipped.** Re-scoped 2026-09-04 by D2 below [R31] |
| D2 | `3-ui/work/row-edit-keyboard-a11y/2-decisions.md` | decisions · **D1, D2 folder-local** | D1: G1/G9/G10 close via a **documented recipe, not a shipped directive** — shelved, not rejected. D2: the recipe lives at `docs/3-ui/cookbook/row-edit-keyboard-a11y.md` | **D1 is a real, live decision. D2's target file does not exist** — the folder it names is absent [R32][R26] |
| D3 | `3-ui/work/row-edit-keyboard-a11y/state.json` | run state | `checklist` all false; paths correct for this repo | accurate [R33] |
| D4 | `3-ui/work/row-edit-stories/1-proposal.md` | plan · **S1, S2, S4, S5, S6** + **F1–F11** feature inventory | The original Storybook proposal. `status: delivered` | **superseded by D5 and by the 9-story reality** — every verb name in it is v1.0, and the stories it names (`gated-edit/`, `optimistic-save/`) no longer exist [R34][R35] |
| D5 | `3-ui/work/row-edit-stories/2-gap-analysis.md` | plan · unnumbered | Re-measures the 6 stories against A3's user stories; finds `optimistic-save/` is a near-subset of `gated-edit/`; lists what is never demonstrated anywhere | **`status: open — proposal, nothing here built yet`, dated 2026-08-31 — but its target 4-story set was overtaken:** `src/stories/row-edit/` now holds **9** hosts with different names [R36][R35] |

### Tier E — ADRs that constrain row-editing (Decision sections read, not summaries)

| | ADR | Status (line 3) | What its **Decision** binds for row-editing | Cited by A1? |
|---|---|---|---|---|
| E1 | `0013-optimistic-and-pessimistic-are-call-site-facts.md` | **proposed** [R37] | The only row-editing-specific ADR. Six decisions: the definition; mode is a call-site fact (no `optimisticX`/`pessimisticX` pairs); **the invariant** "a row is in `pending` iff an optimistic write is in flight"; four verb families; a pessimistic create shows no row at all; the library owns `op` + `unconfirmed`, never per-row error state | **no** [R38] |
| E2 | `0007-feature-member-claims.md` | accepted — implemented 2026-08-26 [R37] | Composing `withOptimistic()` and `withRowEdit()` together **throws at construction**, either order — the duplicate `editing` member claim | yes, §3 [R1] |
| E3 | `0006-row-id-state-reconciliation.md` | accepted — implemented 2026-08-25 [R37] | A feature storing `RowId`s declares `onRowsRemoved` and prunes itself; **exemptions are per feature, not centralized** | yes, §3 [R1] |
| E4 | `0015-feature-member-namespacing.md` | accepted — decided 2026-09-13, **unimplemented** [R37] | Would move `pending`/`pendingOps`/`unconfirmed`/`draft` onto `table.editing` as a callable slice. Rejects a per-feature namespace | no [R30] |
| E5 | `0014-runtime-error-policy.md` | **proposed** [R37] | Construction throws, consumer callbacks degrade. Row-editing has no consumer callback today, so it binds any future one | no |
| E6 | `0011-chained-render-stages.md` | accepted [R37] | Supplies the render slot ADR-0013 **declines** to use for pessimistic create; also reframes G6 | no |
| E7 | `0012-split-expansion-into-panel-and-tree.md` | **proposed** [R37] | G6 (`sourceIndex` for expansion children) narrows to the `withTree()` half | no |
| E8 | `0008-api-folder-split.md` | accepted [R37] | Why the editing updaters live in `mutations/`, not `api/` | no |
| E9 | `0010-no-angular-lifecycle-names-on-engine-concepts.md` | accepted [R37] | Naming constraint on `onRowsRemoved`/`setup` | no |
| E10 | `0004-table-source-layout.md` | accepted [R37] | `index.ts` is the only barrel — which is what makes `src/forms/index.ts` (D33's secondary entry point) an explicit exception | no |

**All 24 ADRs carry a status**; most as `**Status:**` in bold on line 3, four as YAML `status:`.
A negative result from one grep pattern would have been wrong here. [R37]

### Tier F — adjacent folders that carry row-editing decisions but are not filed under it

| | Path | Why it matters |
|---|---|---|
| F1 | `1-state/work/core/active/feature-member-namespacing/` (`spec.md`, `architecture.md`, + research) | **Active**, implements ADR-0015. Its rename table covers `editing`, `pending`, `pendingOps`, `unconfirmed` and `draft`, and it decides "`draft` lands on `editing`" as a corollary the ADR does not state. A live constraint on row-editing's public surface [R30] |
| F2 | `1-state/work/core/archive/computed-state-mechanism/docs/tasks/issue-40-row-edit-optimistic-feature-contract/` (6 step plans + progress) | Holds `step-6-shared-store-finding.plan.md` — the shared-store rationale behind A2. Execution artifacts, but one carries a finding [R39] |
| F3 | `1-state/work/meta/archive/state-feature-competitive-audit/gap-analysis.md` | The "ahead of all four" competitive verdict A1 cites, and the only doc outside `src/` that names `draft` as part of the shipped model [R39] |
| F4 | `3-ui/stories.md` §"An on-canvas toggle…" (lines 383–397) | **Carries the exact claim ADR-0013 says it supersedes, with no supersession banner** — and ADR-0013 cites it as `:142`, which is now a different paragraph entirely [R38][R43] |

### Counts

| Bucket | Files |
|---|---|
| Tier A permanent + generated | 4 |
| Tier B active state-layer | 11 (9 rationale + 2 `state.json`) |
| Tier C archived state-layer | 31 (8 rationale + 23 task steps) + 2 `state.json` |
| Tier D UI-layer | 5 |
| **Row-editing-owned total** | **51** (of which **24** carry decisions or claims) |
| ADRs that constrain it | 10 |
| Adjacent folders (Tier F) | 4 |
| Files mentioning row-editing at all | 122 |

## The decision namespaces

**Five namespaces, four of them numbering from `D1` or `G1`.**

### 1. The global `D` series — D1…D57, spanning five folders

Deliberate and declared: C2's header says "D-numbers and O-numbers are global across the
`with-row-editing`/`with-optimistic`/`with-mutations` folders", and B6 reserves D50–D57 for
exactly this reason. [R10][R17] It has been renumbered once already (G8: D30→D34, D31→D33).

| Range | Folder | Gloss, one line each |
|---|---|---|
| D1–D9, D11, D12 | C1 `with-mutations` | D1 store never creates a form · D2 store exposes row CRUD · D3 writes go to `data` · D4 `data` is always a `WritableSignal` · D5 no CRUD methods, generic write + pure updaters · D6 `updateRows(table, updater)` · D7 `setData()` removed · D8 **mutation is core, not a feature** · D9 pipeline interaction deferred to editing · D11 `data` is the single source of truth · D12 all writes are free functions |
| D10, D13–D18 | B1 `with-row-editing` | D10 edit mode is a store slice · D13 always-edit is not state-layer · D14 `{ multiple }`, default single · D15 Signal Forms binds the same `data` · D16 no edit verbs on the store · D17 editing state is `Map<RowId,TRow>` · D18 **row actions are consumer template code** |
| D19 | C1 | ships three updaters: `addRow`/`removeRow`/`patchRow` |
| D20–D25 | B1 | D20 editing rows are pipeline-exempt · D21 `withRowEdit()` serves both modes · D22 one array form, no per-row forms · D23 `RenderRow.sourceIndex` · D24 **commit boundary is `debounce()`** · D25 a row edited out of the filter stays visible |
| D26, D27 | C1 | temp ids are the consumer's · `at` is `splice` semantics |
| D28, D29 | B1 | `revertEdit` derives add-cancel via `ABSENT` · `withRowEdit()` is optional |
| D30, D32 | C1 | writes move onto the store as members, `data`→`value` · bulk is widened arity + `batch()` |
| D31, D31.1–.5 | B1 | optimistic save; `beginEdit` never re-captures; single-mode switching; impl resolutions; "snapshot" leaves the API; **state = restore points + open ids, `pending` derived** |
| D33, D34 | B1 | `*ngpTableRowField` behind `@ngp/table/forms` · the restore point is writable |
| D35, D36 | B1 | `addNewRow` add-and-open · `addNewRow` stops forcing `ABSENT` |
| D37–D44 (+A1, A2) | C2 `with-optimistic` | D37 rollback is its own feature · D38 the name must carry its scope · D39 live tables compose `withOptimistic()` · D40 `captureEdit` replaces `rebaseEdit` · D41 `endEdit` closes, `releaseEdit` drops · D42 `beginEdit({insert})` replaces `addNewRow` · D43 trigger detection stays out · D44 `clearEditing` stays atomic · **A1** `cancelEdit` dropped · **A2** both features call one factory |
| D45–D48, **D48** | C3 `with-optimistic-crud` | D45 restore point carries position · D46 `ABSENT` removed (breaking) · D47 `removeEdit`/`patchEdit` · D48 O(1) `indexById` lookups · **D48 (second)** `restored` signal dropped |
| D49 | B1 | `swapRowId(from,to)`, no forced end-edit |
| D50, D53, D54 | B6 `optimistic-pessimistic-api` | optimistic/pessimistic are call-site facts · `detached`→`op` · `unconfirmed` becomes a library slice |
| D51, D52, D55–D57 | B6 | **reserved, titles only** — `beginEdit` loses `{insert}` · `endEdit` splits into `commitEdit`/`closeEdit` · per-row error stays consumer-side · pessimistic create shows no row · dev-mode session-verb warning |

### 2. `optimistic-ui-state-patterns` D1–D5 — folder-local, inside the same capability

| | Gloss | Collides head-on with |
|---|---|---|
| D1 | The table holds the rollback state (not the consumer's query cache) | global D1 "store never creates a form" |
| D2 | A restore point is the prior row plus its position | global D2 "store exposes row mutation methods" |
| D3 | One write per row in flight at a time | global D3 "store writes back to `data`" |
| D4 | Fresh server data moves the fallback forward, never the display | global D4 "`data` is always a `WritableSignal`" |
| D5 | **The restore point is tagged with the operation it undoes** | global D5 "no CRUD surface on the store" |

Its own header names the collision ("folder-local, … not the global D-series"), so this is
declared, not accidental. [R7] But it is dated **2026-09-05 — the same day as B6** — and its D5
is the same conclusion as global D53. A bare "D5" in this capability means two unrelated things
decided on two different days.

### 3. `row-edit-keyboard-a11y` D1–D2 — a third `D1`

D1 "scope is documentation, not a shipped directive"; D2 "recipe lives at
`3-ui/cookbook/row-edit-keyboard-a11y.md`". [R32] Neither carries any marker that it is
UI-scoped and folder-local.

### 4. `G` gaps — the same numbers in two files, on purpose

B2 holds G1–G13 (state). D1 holds G1, G7, G9, G10, G11 — **the same entries, moved on
2026-08-26 and deliberately not renumbered**, with one-line stubs left behind in B2 so older
references still read. [R12][R31] Not a collision, but a bare "G7" needs a file to resolve.

### 5. `O` / `OQ` — three open-question namespaces

- **Global `O2`–`O26`**, interleaved with the D series across C1/B1/C2/B2.
- **`OQ-A`–`OQ-D`** — local to C3, resolved in the same file. [R11]
- **`OQ-1`–`OQ-7`** — A3's product questions, cited by number across five state-layer files
  **but no longer numbered in A3 itself**: §6 is seven unnumbered bullets, so a cite like "OQ-7"
  resolves only by counting. [R4]

### Where two files decide the same question differently

| Question | Decided | Then re-decided | And again | Live answer |
|---|---|---|---|---|
| How does a row stay still while typed in? | **D20** pipeline exemption | **D24** `debounce()` commit boundary — mechanism replaced, intent kept | — | D24 [R6] |
| Does an always-edit table need a feature? | **D13** no | **D21** yes, it needs `withRowEdit()` | **D29** no · **D39** it composes `withOptimistic()` | D29+D39 [R6][R10] |
| What does single-mode row switching do to the displaced row? | **D31.2** (2026-08-19) an implicit **Save** | **D31.2 again** (2026-09-03, same heading) it **discards the draft** | — | discards — and B2's **G13/O26 say there is no decision on record that this was intended** [R6][R12] |
| Discard-vs-reset on a cancelled add | **D28** by call order, via `ABSENT` | **D35** `addNewRow` forces `ABSENT` | **D36** captures the row itself · **D42** folds into `beginEdit({insert})` · **D46** `ABSENT` deleted | D46 [R6][R10][R11] |
| Move an open row's restore point forward | **D34** `rebaseEdit`, open-guarded | **D40** `captureEdit`, no guard | — | D40 [R6][R10] |
| Close + drop the restore point | **D31** `endEdit({ keepSnapshot })` | **D41** two verbs, flag removed | **D52** (reserved) split again into `commitEdit`/`closeEdit` | D41; D52 unbuilt [R6][R10][R17] |
| How do the two features share state? | **D37** `withRowEdit()` composes `withOptimistic()` | **A2** both call one `createEditingStore()`; neither composes the other | — | A2 — **but ADR-0015 still states D37's version** [R10][R30] |
| What does a restore point carry? | **D45** `{ row, at, detached }` | **C6 D5** tag it with the operation (design-first, archived) | **D53** `{ row, at, op }` | D53, verified in `src` [R11][R7][R22] |
| Who owns "which rows were just created"? | stories hand-roll `pendingCreateIds` | **D54** `unconfirmed` becomes a library slice | — | D54 shipped — **but all 6 stories still hand-roll it** [R17][R22][R42] |

## Comparison — A1 (`features/row-editing.md`) against `src/`

Every row verified by reading source, never a doc.

| Claim in A1 | Source | Verdict |
|---|---|---|
| `RowRestorePoint { row; at: number; detached: boolean }` (§3) | `src/api/features/editing/state.ts:25-30` — `{ row; at: number; op: PendingOp }` | **stale.** `detached` does not exist; `op` does. D53 shipped [R22] |
| `EditingState { snapshots; open }` (§3) | `state.ts:56-63` — also `readonly unconfirmed: ReadonlySet<RowId>` | **stale.** D54 shipped [R22] |
| `OptimisticMembers { editing; pending }` (§2) | `src/api/features/with-optimistic.ts:8-23` — also `pendingOps`, `unconfirmed` | **stale** [R24] |
| "`RowEditMembers<TRow>` extends `OptimisticMembers<TRow>` and **adds nothing**" (§3) | `src/api/features/with-row-edit.ts:30-34` — adds `readonly draft: WritableSignal<TRow[]>` | **wrong, not merely stale.** `draft` is a shipped public member with no decision record [R24] |
| ADR-0006 exemption is "`ABSENT` entries (D28)" (§3 table) | `state.ts:247,251` — `(value) => value.op === 'delete'`; `unconfirmed` pruned with the same exemption | **stale** [R22] |
| Nine updaters (§4) | `src/mutations/` — **eleven** exported: `beginEdit`, `createRow`, `endEdit`, `clearEdit`, `captureEdit`, `releaseEdit`, `revertEdit`, `discardEdit`, `removeEdit`, `patchEdit`, `swapRowId` | count stale; `createRow` is documented in §4 but not in the "nine" [R22][R23] |
| Stories `gated-edit/` and `optimistic-save/` (§8) | glob of `src/stories/row-edit/**` — neither exists. Nine hosts: `live-table`, `live-optimistic`, `gated-single-optimistic`, `gated-single-pessimistic`, `gated-multiple-optimistic`, `gated-bulk-optimistic`, `external-write`, `form-write-mutations`, `sorting-editing` | **stale** — 2 named stories gone, 4 unlisted [R35] |
| `src/stories/live-table/` and `apps/demo/src/app/table-edit-demo/` (§1, §8) | actual path is `src/stories/row-edit/live-table/`; **no `apps/demo` exists in this repo** (only `apps/site`) | paths stale; the demo table is explicitly marked "(acme monorepo)" so it is honest but unreachable [R35][R44] |
| §9 "one-tick saving flicker" | contradicted by A3 §6 and by B7 item 1 | **known-wrong, correction not applied** [R3][R13] |
| ADR-0007 throw on composing both | `with-row-edit.ts:114-116` JSDoc + `state.ts` single `editing` claim | **accurate** [R24] |
| `sourceIndex` derived by the engine, `undefined` for synthesized rows | `src/api/types.ts:65-68` | **accurate** [R23] |
| D33 `*ngpTableRowField` behind `@ngp/table/forms` | `src/forms/index.ts`, `src/directives/ngp-table-row-field.directive.ts` | **accurate — shipped** [R23] |

### What a doc calls unbuilt that actually shipped, and vice versa

| Doc claim | Reality in `src/` |
|---|---|
| B5 "step 1 done (D53); step 2 done (D54); step 3a not started" | **accurate.** `op`/`unconfirmed`/`pendingOps` present; `commitEdit`/`closeEdit` absent; `BeginEditOptions` still exported at `index.ts:84` [R22] |
| ADR-0013 `**Status:** proposed` | **half of it shipped.** Decision 6 (`op` + `unconfirmed`) is in `src`; Decisions 2/4/5 are not. A proposed ADR with implemented clauses [R37][R22] |
| ADR-0006 Decision quotes `pruneByIds`' Set overload with **no** `keep` parameter, and names `ABSENT` as the exemption | `src/engine/rows.ts:87-91` — the Set overload **has** `keep?: (id: V) => boolean` (added by D54), and the exemption is `op === 'delete'` [R22] |
| ADR-0013 "obliges an update to ADR-0006 **:198-209** 'Open'" | ADR-0006 is **72 lines** and has no Open section. The citation cannot resolve [R37] |
| B3 `4-increments.md`: "`api/features/` contains **only** `with-sorting.ts` and `with-expansion.ts`" | `src/index.ts` exports `withSorting`, `withFiltering`, `withExpansion`, `withRowEdit`, `withOptimistic`, `withGrouping`, `withSelection`, `withComputed` [R21] |
| B7 item 3: A3's frontmatter says `draft — scope-setting` | A3 has **no `status:` field**. Item 3 is already moot [R3] |
| B9 `with-row-editing/state.json`: `spec: false` | A1 exists and is `spec: drilled` [R19][R1] |
| ADR-0013 supersedes `3-ui/stories.md` **:142** | the claim is at **:387–392** and carries no supersession banner [R43] |
| CLAUDE.md: `api/features/editing-state.ts` | file is `api/features/editing/state.ts`, with a sibling `editing/draft-rows.ts` [R22][R45] |
| CLAUDE.md: `optimistic-mutations.ts` holds six verbs | seven — `swapRowId` is missing from the list. `row-edit-mutations.ts` likewise omits `createRow` [R22][R45] |

## Contradictions between permanent docs

- **A1 vs. A3 on the saving flicker.** A1 §9 lists it as an accepted cost; A3 §6 resolves it as
  not real and says so explicitly ("`features/row-editing.md` §9 lists this as an accepted cost,
  which is inaccurate"). B7 item 1 is the unexecuted fix. [R1][R3][R13]
- **A1 vs. A3 on the unguarded `revertEdit` snippet.** A3 §6 flags "`features/row-editing.md` §5
  still shows the unguarded pattern"; C3's own correction 2 gives the `pending()` guard. A1 §5
  still shows it unguarded. [R1][R3][R11]
- **A1 vs. C4 on pessimistic save under `multiple: true`.** A1 §5 documents pessimistic save with
  no `multiple` caveat; C4 rules it **unsupported** under `multiple: true` and makes that
  load-bearing for the mode-flip semantics. [R1][R20]
- **`3-ui/stories.md` vs. ADR-0013.** The gated-only save-mode framing is still published, and
  ADR-0013's supersession does not reach it — wrong line number, no banner in the target. [R38][R43]
- **ADR-0015 vs. C2's A2.** ADR-0015:14-15 states "`withRowEdit()` composes `withOptimistic()`
  internally"; A2 corrected exactly that on 2026-08-26, seventeen days before ADR-0015 was
  accepted. [R30][R10]
- **No archived file claims to supersede a permanent spec.** Grep for "supersedes
  `features/row-editing.md`" returns nothing; every work file states the reverse. **Grouping's
  core defect does not exist here.** [R8][R6][R9][R10][R11]

### Broken links — ~70 references to the pre-restructure flat paths

`docs/1-state/work/` no longer holds `with-row-editing/`, `with-optimistic/`,
`with-mutations/`, `with-multiple-edit/`, `with-duplicate-row/`, `swap-row-id/` or
`optimistic-pessimistic-api/` — all moved under `row-editing/{active,archive}/`. Files still
pointing at the old paths: **A1 (6), A3 (9), A2 (3), `3-ui/work/row-editing/5-gaps.md` (5),
`3-ui/stories.md` (1), ADR-0013 (1), ADR-0012 (1), ADR-0011 (1), ADR-0007 (1),
`row-edit-keyboard-a11y/2-decisions.md` (1), `1-state/architecture.md` (2),
`row-edit-stories/1-proposal.md` (2)** and others — 70 hits across 36 files. ADR-0006 also links
`work/row-id-state-reconciliation/` (now under `work/core/active/`). [R8][R46]

## Open questions still outstanding

| # | Question | Owner file | Deadline / precondition — passed? |
|---|---|---|---|
| **O22** (representation half) | Inverse-operation representation so rollback can cover **move** | C3, indexed in B2 | **precondition still holds** — `moveRow`/`withDragDrop()` do not exist in `src`. Correctly deferred [R11][R12][R22] |
| **O23** | Should openness be declarative — `applyEditable({ when })`? | B1, indexed in B2 | **unblocked 2026-08-27** by C4 closing G4; nothing has picked it up since [R6][R20] |
| **O26** | Should `closeAllButLast` carry a displaced row's unsaved `draft` forward? | B2 (G13); `with-row-edit.ts:46` JSDoc points at a **stale path** | **open, and its subject has no decision record** — the `draft` mechanism it questions was never D-numbered [R12][R24] |
| **O11** | `rowEditChanged` event, or is the signal the only notification? | B1, paired with **O6** in C1 | open since 2026-08-11; "decide both together" never happened [R6][R9] |
| **O6** | `rowsChanged` event on a row write? | C1 | same [R9] |
| **O19** | Export an `editableRow(row, columns)` schema fragment? | B1; B2 routes it to E5 in B3 | **its router is stale** — B3 is a 2026-08-13 plan whose premise is false [R6][R12][R14] |
| **O15 / O16** | Filter-stage retention of an edited-out row; where a retained row sits | B1 | **precondition has passed.** Both are marked "phantom — needs `withFiltering()`"; `withFiltering` ships (`index.ts:15`). These should be re-derived or closed [R6][R12][R22] |
| **O17** | `applyEach` validates rows the user cannot see | D1 (UI register) | **same — `withFiltering` ships.** Still marked phantom [R31][R22] |
| **O20 / O24 / O25 / O13 / O18 / O8** | id-swap policy · `swapRowId`'s home · bulk `releaseEdit` · stale snapshot · keystroke cost · compile-time feature deps | C1/B1/C2 | all closed (D49, D41+D44, D34, D24, #33) [R6][R10][R12] |
| **D51, D52, D55–D57** | Reserved but unwritten | B6 | open by design; gated on steps 3a–6 of B5, none started [R17][R16] |
| **A3 §6 bullet 5** | Delete: confirm, undo, or both — the *product* half | A3 | open; settles "once it's confirmed undo reliably reaches the server in target deployments" — no evidence anyone is measuring that [R4] |
| **D2's cookbook page** | `3-ui/cookbook/row-edit-keyboard-a11y.md` | D2 | **decided 2026-09-04, file never created.** The folder does not exist [R32][R26] |
| **B7 items 1 and 2** | The flicker sentence; the double D48 | B7 | `status: open — not started` since 2026-08-28; both still true in the target files [R13][R1][R11] |

## Naming — which folders belong to this capability

| Folder | Belongs to row-editing? | Why |
|---|---|---|
| `1-state/work/row-editing/active/with-row-editing/` | **yes** — the core log | [R6] |
| `.../active/optimistic-pessimistic-api/` | **yes** — active, owns D50–D57 | [R16][R17] |
| `.../active/doc-corrections/` | **yes** — two of three items target row-editing files | [R13] |
| `.../archive/with-optimistic/`, `with-optimistic-crud/` | **yes** — `withOptimistic()` is one of the two editing features | [R10][R11] |
| `.../archive/with-multiple-edit/`, `with-duplicate-row/`, `swap-row-id/` | **yes** — each closes a named row-editing gap (G4, duplicate, G3) | [R20][R27][R29] |
| `.../archive/optimistic-ui-state-patterns/` | **yes** — but design-first and folder-locally numbered; its D5 duplicates D53 | [R7] |
| `.../archive/with-mutations/` | **boundary case — it is the *core* log, filed under row-editing.** Its D8 puts mutation in core, "not a `with-*()` feature", and its own note calls the slug "a misnomer… no `withMutations()` feature will ship". Its contract is **A2 `row-mutations.md`**, a core-API spec with no `capability:` field. The log should cover D9/D19/D26/D27/D32 (which editing depends on) without claiming ownership of D1–D8/D11/D12/D30, which are core decisions | [R9][R2] |
| `3-ui/work/row-editing/` | **yes** — the UI gap register | [R31] |
| `3-ui/work/row-edit-keyboard-a11y/` | **yes** — D1/D2 are live UI decisions | [R32] |
| `3-ui/work/row-edit-stories/` | **yes**, but both files are overtaken by the 9-story reality | [R34][R36] |
| `docs/1-state/row-mutations.md` | **no — core-API spec (D8).** A sibling of `state-persistence.md`, not a member of `features/` | [R2][R9] |
| `1-state/work/core/active/feature-member-namespacing/` | **no — core**, but it actively constrains row-editing's member surface | [R30] |
| `1-state/work/core/archive/computed-state-mechanism/.../issue-40-row-edit-optimistic-feature-contract/` | **no — core**, but the folder name reads as row-editing's and it holds the shared-store finding behind A2 | [R39] |
| `src/stories/row-edit/` | the code folder; **9 hosts**, not the 6 A1 names or the 4 D5 proposes | [R35] |

## Not researched

- **GitHub issue state.** #12, #19, #20, #33, #40, #46, #47, #48 are cited across these files;
  none was opened. `with-mutations/state.json` lists `[46,47,48]` while its body says "#12" —
  unreconciled.
- **Git history.** No shell tool in this session; `.git/logs/HEAD` starts 2026-09-17, after every
  row-editing commit. Commit hashes quoted in the docs (`5170003`, `2d13dda`, `ca5f56f`,
  `e681fda`) are unverified.
- The 23 `step-*.plan.md` / `progress.md` files under `archive/*/docs/tasks/` were not read
  individually.
- The 9 story-host `.ts`/`.html` files were greped, not read. Their internal correctness against
  A1's flows is not assessed.
- `apps/site/` — the docs site may publish row-editing content not counted here.
- `libs/table/CONTEXT.md` and `llms.txt` were not checked for row-editing claims.

## Unverified

- **Whether `with-mutations` should move out of `row-editing/`.** The evidence points both ways:
  its D-numbers are in row-editing's global sequence (so extracting it would break the sequence),
  but its contract is a core spec. Recorded as a finding, not a call.
- **Whether `draft` ever had a decision record that was deleted.** Searched every `.md` under
  `libs/table/docs`: `table.draft`/`createDraftRows` appear only in B1 (D31.2's 2026-09-03
  correction), B2 (G13/O26), B5, ADR-0013's rejected-alternatives table, F1, F3 and two archived
  task steps — never as a decision. C4, which B2 credits with introducing it, does not mention
  the word. Absence of a record is confirmed; whether one was ever written is not.
- **Whether A3's §6 bullets were ever numbered OQ-1…OQ-7 in this file.** The ownership banner
  says they are, the body does not number them, and git is unavailable to check.
- **C6's placement in `archive/`.** It is dated 2026-09-05, the same day as B6, and its D5 is the
  design D53 implements — so archiving it while D53's folder is active may be a mis-file. Reading
  its `status:` ("complete — informs future ADRs") suggests deliberate; not confirmed.
- ADR-0013's `:142` and `:198-209` citations both fail to resolve today. Whether the targets moved
  after the ADR was written, or the citations were wrong when made, cannot be determined without
  git.

## Sources

| | Source | Verified |
|---|---|---|
| R1 | `libs/table/docs/1-state/features/row-editing.md` | yes — read in full (670 lines); frontmatter `spec: drilled, code: shipped`, v2.1, 2026-08-27 |
| R2 | `libs/table/docs/1-state/row-mutations.md:16` | yes — read in full; "Core API, not a `with-*()` feature (D8)"; free-text `status:`, no `capability:` |
| R3 | `libs/table/docs/0-product/row-editing.md:1-80` | yes — read; frontmatter has `capability`/`date`/`audience` and **no `status:`** |
| R4 | `libs/table/docs/0-product/row-editing.md:716-782` | yes — read; §6 is seven unnumbered bullets; §7 "not user-facing" |
| R5 | `libs/table/docs/status.md:35` | yes — read; `row-editing` row, Decisions column is `—` |
| R6 | `libs/table/docs/1-state/work/row-editing/active/with-row-editing/2-decisions.md` | yes — read in full, 1,209 lines across two passes |
| R7 | `libs/table/docs/1-state/work/row-editing/archive/optimistic-ui-state-patterns/decisions.md:1-11` | yes — read in full; "Numbering is folder-local (D1, D2, …) … not the global D-series" |
| R8 | `grep "work/with-row-editing|work/with-optimistic|work/with-mutations|work/with-multiple-edit|work/with-duplicate-row|work/swap-row-id|work/optimistic-pessimistic-api" libs/table/docs/**/*.md` | yes — ran 2026-09-20; 70 hits across 36 files, all pre-restructure paths |
| R9 | `libs/table/docs/1-state/work/row-editing/archive/with-mutations/2-decisions.md` | yes — read in full; D8's note "the work-folder slug `with-mutations` is now a misnomer" |
| R10 | `libs/table/docs/1-state/work/row-editing/archive/with-optimistic/2-decisions.md` | yes — read in full; A2 at :291 corrects D37 |
| R11 | `libs/table/docs/1-state/work/row-editing/archive/with-optimistic-crud/2-decisions.md:114,157` | yes — read in full; two `## D48` headings confirmed at those lines |
| R12 | `libs/table/docs/1-state/work/row-editing/active/with-row-editing/5-gaps.md` | yes — read in full; G13/O26 at :210-231, open-decisions index at :364-381 |
| R13 | `libs/table/docs/1-state/work/row-editing/active/doc-corrections/1-handoff.md` | yes — read in full; `status: open — not started`, 2026-08-28 |
| R14 | `libs/table/docs/1-state/work/row-editing/active/with-row-editing/4-increments.md:1-55` | yes — read; `status: proposed`, 2026-08-13; the false `api/features/` premise at :17 |
| R15 | `libs/table/docs/1-state/work/row-editing/active/with-row-editing/3-research-edit-pipeline.md:1-20` | yes — read; AG Grid claim fetched from ag-grid.com and marked verified |
| R16 | `libs/table/docs/1-state/work/row-editing/active/optimistic-pessimistic-api/1-proposal.md` | yes — read in full; step status, R1–R5, the step graph |
| R17 | `libs/table/docs/1-state/work/row-editing/active/optimistic-pessimistic-api/2-decisions.md` | yes — read in full; D50/D53/D54 written, D51/D52/D55–D57 reserved |
| R18 | `libs/table/docs/1-state/work/row-editing/active/doc-consolidation/state.json` | yes — read; `capabilityLogPath` names `docs/decisions/row-editing.md` |
| R19 | `libs/table/docs/1-state/work/row-editing/active/with-row-editing/state.json` | yes — read; `workspaceRoot` is `libs/shared/design-system/src/ui/table/...` |
| R20 | `libs/table/docs/1-state/work/row-editing/archive/with-multiple-edit/1-design.md` | yes — read in full; no D-numbers; "Pessimistic save is unsupported under `multiple: true`" at :96 |
| R21 | `libs/table/src/index.ts:14-49` | yes — read; `withSorting`, `withFiltering`, `withExpansion`, `withRowEdit`, `withOptimistic`, `withGrouping`, `withSelection` all exported |
| R22 | `libs/table/src/api/features/editing/state.ts:19-63,201-269` · `libs/table/src/mutations/optimistic-mutations.ts:34,60,88,117,140,167,197` · `libs/table/src/mutations/row-edit-mutations.ts:50,105,160,179` · `libs/table/src/engine/rows.ts:82-96` | yes — greped and read 2026-09-20; `{row, at, op}`, `unconfirmed`, `op === 'delete'` pruning, `keep` on the Set overload, 11 updaters, no `commitEdit`/`closeEdit` |
| R23 | `libs/table/src/index.ts:57-65,82-94` · `libs/table/src/api/types.ts:65-81` · glob `libs/table/src/forms/index.ts`, `src/directives/ngp-table-row-field.directive.ts` | yes — read; `PendingOp`/`RowRestorePoint` exported from `./api/features/editing/state`; `sourceIndex?: number`; the forms entry point exists |
| R24 | `libs/table/src/api/features/with-row-edit.ts:14-124` · `libs/table/src/api/features/with-optimistic.ts:8-23` | yes — read; `RowEditMembers = OptimisticMembers & { draft }`; `OptimisticMembers` has `editing`, `pending`, `pendingOps`, `unconfirmed`; `closeAllButLast` JSDoc at :46 cites a stale doc path |
| R25 | glob `libs/table/docs/3-ui/directives/*.md` | yes — ran; 9 files, none named `row-editing.md` |
| R26 | glob `libs/table/docs/3-ui/cookbook/**` | yes — ran; no files found |
| R27 | `libs/table/docs/1-state/work/row-editing/archive/with-duplicate-row/1-design.md:1-60` | yes — read; no D-numbers; `at: sourceIndex + 1`; the two renames |
| R28 | `libs/table/docs/1-state/work/row-editing/archive/optimistic-ui-state-patterns/research.md:1-22` | yes — read; `type: research`, "not itself a decision record" |
| R29 | `libs/table/docs/1-state/work/row-editing/archive/swap-row-id/1-handoff.md:1-50` | yes — read; `status: shipped 2026-09-03` |
| R30 | `libs/table/docs/adr/0015-feature-member-namespacing.md:12-61` · `libs/table/docs/1-state/work/core/active/feature-member-namespacing/spec.md:191-211` · `.../architecture.md:32,69,87` | yes — greped and read; ADR-0015:14-15 repeats D37's superseded composition claim; the spec decides "`draft` lands on `editing`" as a corollary |
| R31 | `libs/table/docs/3-ui/work/row-editing/5-gaps.md` | yes — read in full; G1/G7/G9/G10/G11, O17 index |
| R32 | `libs/table/docs/3-ui/work/row-edit-keyboard-a11y/2-decisions.md` | yes — read in full; D1 and D2, both folder-local |
| R33 | `libs/table/docs/3-ui/work/row-edit-keyboard-a11y/state.json` | yes — read; paths correct for this repo, checklist all false |
| R34 | `libs/table/docs/3-ui/work/row-edit-stories/1-proposal.md:1-60` | yes — read; `status: delivered`, v1.0 verb names, S1–S6 and F1–F11 |
| R35 | glob `libs/table/src/stories/row-edit/**/*-story-host.component.ts` | yes — ran 2026-09-20; exactly 9 hosts, names listed in the Comparison table |
| R36 | `libs/table/docs/3-ui/work/row-edit-stories/2-gap-analysis.md:1-45` | yes — read; `status: open — proposal, nothing here built yet`, 2026-08-31 |
| R37 | `grep "^\*\*Status:\*\*|^status:" libs/table/docs/adr/` | yes — ran 2026-09-20; **24 ADRs, all carry a status**; 20 as `**Status:**` bold on line 3, 4 as YAML |
| R38 | `libs/table/docs/adr/0013-optimistic-and-pessimistic-are-call-site-facts.md` | yes — read in full; Decision section's six clauses; obligations list at :145-157 |
| R39 | `grep "table\.draft|createDraftRows|draft-rows" libs/table/docs/**/*.md` | yes — ran; `draft` appears in 8 docs, in none as a numbered decision; includes F2's `step-6-shared-store-finding.plan.md` and F3's gap-analysis |
| R40 | `grep -ci "withRowEdit|withOptimistic|beginEdit|captureEdit|RowRestorePoint|row-edit|rowEdit|optimistic" libs/table/docs/**/*.md` | yes — ran 2026-09-20; 1,230 hits / 122 files |
| R41 | `libs/table/../.git/logs/HEAD` | yes — greped; earliest entry reachable is 2026-09-17, after every row-editing commit. Git log is unavailable — no shell tool in this session |
| R42 | `grep "pendingCreateIds|commitEdit|closeEdit|unconfirmed()" libs/table/src/stories/row-edit/` | yes — ran; `pendingCreateIds` hand-rolled in `ui/row-flags.ts` and read by 5 hosts; **zero** occurrences of `table.unconfirmed()`, `commitEdit` or `closeEdit` |
| R43 | `libs/table/docs/3-ui/stories.md:378-397` | yes — read; the gated-only save-mode claim sits at :387-392, not :142, and carries no supersession banner |
| R44 | glob `apps/**/project.json` | yes — ran; only `apps/site/project.json` — `apps/demo` does not exist in this repo |
| R45 | `libs/table/CLAUDE.md` file table (injected, read in session) | yes — read; names `api/features/editing-state.ts`, six optimistic verbs, three row-edit verbs |
| R46 | `libs/table/docs/adr/0006-row-id-state-reconciliation.md` | yes — read in full (72 lines); Decision cites `ABSENT` and a `keep`-less Set overload; Related link points at `work/row-id-state-reconciliation/`, now under `work/core/active/` |
