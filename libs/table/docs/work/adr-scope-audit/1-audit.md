# ADR scope audit — one test, 18 records

Read-only audit of `libs/table/docs/adr/0001`–`0018`. No ADR was edited.

## The test

Every ADR here is judged by one question, and only this one: **can someone editing a different
file violate this decision?** If yes, the record is correctly an ADR — the decision constrains
code outside its own feature, so a person who never opens the owning file can still break it
(a shared type, a registry or slot, a naming rule, a folder/barrel layout, an import edge, a
pipeline or render stage, a public export). If no — violating it requires editing the feature
itself — it is misfiled, and belongs in a feature spec (`docs/1-state/features/<x>.md`) or an
episodic decisions doc (`docs/*/work/<slug>/2-decisions.md`). Blast radius is the whole question:
"is it architectural?" and "is it feature-level?" are explicitly *not* the test, and a
feature-scoped decision can pass (ADR-0012 claims a render stage every other feature author must
leave alone; ADR-0016 moved an import edge between two folders).

## Verdicts

| ADR | Title (short) | Status | Verdict | Constrains |
|---|---|---|---|---|
| 0001 | Single-column sort default | accepted | **FAIL** | own feature only — `api/features/with-sorting.ts` |
| 0002 | `createTable()` returns an instance | accepted | PASS | the public factory call shape at every call site, and the "store reaches directives by input, never DI" rule — `directives/table.tokens.ts:8` provides the *directive*, not the store |
| 0003 | In-house composition engine | accepted | PASS | the feature contract itself — `engine/types.ts` `TableFeatureSpec`; every `with-*()` file implements it |
| 0004 | Source layout by lifecycle phase | accepted (3 amendments) | PASS | folder layout + "one barrel per domain" — `src/index.ts:1-6` is the only public surface; exactly 4 `index.ts` files exist under `libs/table/src` |
| 0005 | Generic table host (`<table>` + `<div>`) | proposed (shipped) | PASS | all four directive selectors (`ngp-table.directive.ts:22`, `-row:8`, `-header-cell:9`, `-cell:6`), and the `totalRowCount` override carve-out in `engine/slots.ts:6` |
| 0006 | Features reconcile row-id state | accepted | PASS | `engine/types.ts:91` `onRowsRemoved`, implemented by four unrelated features (`with-expansion.ts:227`, `with-selection.ts:181`, `editing-state.ts:244`, `compose-features.ts:154`) |
| 0007 | Features claim member keys | accepted | PASS | `engine/slots.ts` `SlotRegistry` + `CORE_MEMBER_KEYS:22`; every feature and every derive block is a claimant |
| 0008 | Split `api/` into `api/`/`schema/`/`mutations/` | accepted | PASS | top-level folder layout — decides where any new schema or mutation file lands |
| 0009 | Table extracted to a standalone package | accepted | **BORDERLINE** | a completed move (paths now stale) plus a residual `ngp` selector-namespace claim — see below |
| 0010 | No Angular lifecycle names on engine concepts | accepted | PASS | the `with*` (consumer plugin) vs `wire*` (internal step) naming rule and `TableFeatureSpec.setup` (`engine/types.ts:84`, `api/create-table.ts:56`) |
| 0011 | Chained render stages | accepted (stage allocation partially superseded by 0017) | PASS | `RENDER_ORDER` / `RenderStages` (`engine/render-stages.ts:8,23`), claimed from `with-expansion.ts:243` and `with-grouping.ts:153` |
| 0012 | Split expansion into panel + tree | proposed | PASS | claims the `'tree'` stage against every other feature author, and forces the accumulating `expandedRows` slot (`engine/types.ts`, cited from `engine/render-stages.ts` and `api/features/compose-features.ts:106`) |
| 0013 | Optimistic/pessimistic are call-site facts | proposed | PASS (weakest) | verb families across `mutations/row-mutations.ts`, `row-edit-mutations.ts`, `optimistic-mutations.ts`; `RowRestorePoint.op` (`editing-state.ts:30`); the widened `keep` on `pruneByIds`' Set overload (`engine/rows.ts:86-89`), a helper `with-expansion`/`with-selection` also use |
| 0014 | Runtime error policy | proposed | PASS | every consumer callback in every feature — wrap/report sites already in `engine/filters/evaluator.ts:29`, `engine/grouping.ts:99,182,316`, `engine/grouping-rules.ts:45`, `api/features/with-computed.ts:35,70` |
| 0015 | One callable slice per feature, keyed by concern | accepted, unimplemented | PASS | the member shape every feature must expose — `WritableView` already on `value`/`columns` (`engine/core.ts:101,110`), `editing` (`editing-state.ts:194`), `grouping` (`with-grouping.ts:60`); sorting/selection/expansion still flat and owe the migration |
| 0016 | Filtering takes a predicate list | superseded (2026-09-14) | PASS (spent) | it moved the table↔filters import edge; the edge now runs the other way (`with-filtering/feature.ts:1-2` imports `engine/filters/*`) and `predicates` is gone from the config — passes the test historically, but constrains nothing today |
| 0017 | `parentId` + engine-owned `'prune'` | accepted, implemented (#98) | PASS | `RenderRow.parentId` every synthesizing stage must stamp, the unclaimable `'prune'` stage, and the one accumulating slot (`engine/render-stages.ts:8,23,42`, `engine/core.ts:52`) |
| 0018 | `when` vs `enable` predicate naming | accepted | PASS | the default predicate name on any feature rule — already the shape in `with-filtering/types.ts:28` and `schema/column-rules.ts:17`, recorded as an invariant in `libs/table/CLAUDE.md:105` |

Counts: **16 PASS, 1 FAIL, 1 BORDERLINE.** ADR-0016 is counted as a PASS; its constraint is spent
rather than misfiled.

## FAIL — ADR-0001, single-column sort default

- **What it constrains.** `toggleSort()` replaces rather than accumulates unless `{ multi: true }`.
  The whole decision is two branches inside one file: `api/features/with-sorting.ts:144`
  (`const multi = config.multi ?? false`) selecting `replaceSortRule` over `cycleSortRule` at
  `:162-164`.
- **Grep evidence.** No file outside `with-sorting.ts` and its own spec depends on which branch
  runs. `SortRule` (`api/types.ts:17`) is an array-of-rules shape that expresses both defaults
  equally well, so it is not constrained by the choice. `toggleSort`/`setSorting` appear in
  `with-grouping.spec.ts` and `with-selection.spec.ts` only as store members, never asserting
  single-vs-multi. `directives/ngp-table-header-cell.directive.ts:4-5` explicitly defers
  `aria-sort` to the sort feature, so no directive reads it either. The string `ADR-0001` appears
  in no `.ts` file under `libs/table/src`; its only citations are sorting's own docs
  (`docs/0-product/sorting.md`, `docs/1-state/work/sorting/...`).
- **Where it belongs.** `docs/1-state/features/sorting.md` — it is a product default reversal
  (it already reads as one, superseding a PRD line), not a constraint on anyone else's code.
- Re-filing is cheap: status is `accepted`, nothing cites it from code.

## BORDERLINE — ADR-0009, table extracted to a standalone package

- **What it constrains.** Two things at once. (a) The move itself — `src/ui/table/` →
  `libs/shared/table`, alias `@acme/table` — a completed one-time action whose paths are now
  stale: the lib is `libs/table` (`libs/table/project.json:2` still names the Nx project
  `shared-table`) and the alias is `@ngp/table` (`tsconfig.base.json` `paths`). (b) A residual
  namespace claim: the table owns the `ngp` selector prefix and must not share it with
  `ng-primitives`.
- **Grep evidence, both directions.** The namespace claim has live teeth in this repo —
  `ng-primitives@^0.130.1` is a real dependency (`package.json:29`), imported by
  `apps/site/src/app/design-system/{dropdown-menu,dropdown-pill,search,select-trigger,tab-switcher}`,
  and the site's own components use `ngpt` (`apps/site/project.json:5`; e.g.
  `apps/site/src/app/design-system/callout/callout.ts:25` → `aside[ngptCallout]`), never `ngp`.
  A site component declaring `ngp*` would collide with `libs/table/project.json:6` — a different
  file violating. But nothing outside ADR-0009 states that as a rule: none of the five
  `apps/site/docs/adr/*` records a prefix reservation, and `apps/site/docs/adr/0005` discusses
  `ng-primitives` co-hosting (`:79-82`) without mentioning `ngp` vs `ngpt` at all.
- **What would settle it.** Whether `ngp` is intended as a *reserved* prefix other projects must
  avoid. If yes, that rule belongs where it is enforceable (an `apps/site` ADR, the site's
  `CONTEXT.md`, or a lint rule) and ADR-0009 reduces to a historical move record → FAIL, re-file
  as a `work/<slug>/2-decisions.md` entry. If ADR-0009 is deliberately the only statement of that
  rule, it PASSes — but its stale `@acme/table` / `libs/shared/table` paths then need correcting,
  because a rule nobody can find is not a constraint.
- Its only citations are provenance notes in `libs/table/CONTEXT.md:3,12`.

## Unverified

- **ADR-0005's status.** The record says `proposed`, but dual-tag selectors, `aria-rowcount` via
  `totalRowCount` (`ngp-table.directive.ts:33`) and `aria-rowindex` (`ngp-table-row.directive.ts:15`)
  are all shipped. Whether "proposed" is stale or some part is genuinely still open was not
  established; the verdict does not depend on it.
- **ADR-0009's original repo.** The design-system lib it describes is not present here
  (`libs/shared/` is empty), so its claim that ADR-0001–0005 "moved with it" could not be checked
  against the source repo — only against the ADRs' current location.
- **ADR-0013 / ADR-0015 implementation completeness.** The verb families and `unconfirmed` exist
  (`row-edit-mutations.ts:105`, `optimistic-mutations.ts:65`) and 0015 is self-declared
  unimplemented; how much of either remains outstanding was not audited. Neither affects its
  verdict.
- **ADR-0019** (`0019-columns-path-keyed-by-declared-column-ids.md`, untracked) is outside the
  requested 0001–0018 range and was not audited.

## Convention as observed

In practice these 18 record *any* decision that was argued out at length — the trigger is "this
took a design discussion and someone will ask why later," not blast radius. That over-approximates
the test rather than contradicting it: 16 of 18 genuinely constrain artifacts outside their own
feature, and several say so in as many words (ADR-0007: "a change to the **feature contract**, not
to one feature — which is why it is an ADR and not a decision in the editing work folder"). The
drift sits at the two oldest records: ADR-0001 is a single-file product default inherited from a
pre-ADR PRD reversal, and ADR-0009 is a completed move whose only live residue is a namespace rule
stated nowhere it can be enforced. Both predate the contract-vs-feature framing later ADRs reason
from.
