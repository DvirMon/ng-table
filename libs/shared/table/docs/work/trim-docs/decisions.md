# trim-docs — decisions

Source: [#80](https://github.com/DvirMon/acme/issues/80). Workspace is domain-wide
(`docs/work/`), not tier-scoped — the ticket spans `0-product` through `adr` plus `src/**`.

## Measurements (2026-09-16)

Issue #80 measured 267 docs files / 42,865 lines on 2026-09-13. Three days later:

| Surface | Files | Lines |
|---|---|---|
| `docs/**/*.md` | 373 | 58,022 |
| `src/**/*.ts` (non-spec) | 146 | 13,701 |

Docs grew **+106 files / +15,157 lines in 3 days**. Trimming is a one-time win against a
surface that is actively growing.

By tier:

| Tier | Scope | Files | Lines |
|---|---|---|---|
| 1 | `0-product` | 5 | 4,230 |
| 1 | `1-state/*.md` | 6 | 1,768 |
| 1 | `2-columns` | 8 | 1,117 |
| 1 | `3-ui/*.md` | 2 | 563 |
| 3 | `adr` | 15 | 2,133 |
| 4 | `1-state/work/**` | 261 | 39,175 |
| 4 | `3-ui/work/**` | 47 | 4,841 |

**Tier 4 is 308 files / 44,016 lines — 76% of all docs.** Tiers 1–3 together are 36 files /
9,811 lines.

Tier 4 split by artifact kind:

| Kind | Files | Lines |
|---|---|---|
| `step-*.plan.md` | 183 | 18,659 |
| `progress.md` | 33 | 1,360 |
| `research*.md` | 21 | 6,120 |
| `*decisions.md` | 16 | 4,886 |
| `*spec.md` | 8 | 2,637 |
| remainder (design-*, intake, issue-graph, gap analyses) | 47 | ~10,354 |

`step-*.plan.md` + `progress.md` = 216 files / 20,019 lines — **45% of tier 4, 34% of all
docs.** These are `/to-tasks` output consumed by `/implement`; they are not the rationale
record the issue's open question worries about losing.

## Decomposition (per `decompose-by-dependency-graph`)

| Node | Rank | Edge |
|---|---|---|
| N1 Tier-4 disposition | core | depends on N2 |
| N2 Retention policy for spent pipeline artifacts | core | none — settle first |
| N3 Trim bar (budget vs. "cut what carries nothing") | core | none |
| N4 Verification method (preserved-content check) | core | none |
| N5 Tier-2 source comments | independent | bar already set by two global rules |
| N6 Tier-1 reference trim | dependent | needs N3, N4 |
| N7 Tier-3 ADR trim | dependent | needs N3, N4 |

## Decisions

- **2026-09-16 — Tier 4 is out of scope.** All 308 `**/work/**` files (44,016 lines) stay
  untouched, including the 216 spent `step-*.plan.md` / `progress.md` files. #80's two tier-4
  open questions (compress vs. collapse) are answered by exclusion, not by a disposition.
  N1 and N2 are closed; no retention policy is set by this ticket.
- **2026-09-16 — Scope is tiers 1–3 plus source comments:** 36 docs files / 9,811 lines
  (`0-product`, `1-state/*.md`, `2-columns`, `3-ui/*.md`, `adr`) and comments in 146 non-spec
  `src/**/*.ts` files.
- **2026-09-16 — `0-product/**` stays in scope.** Proposing to exclude it was unfounded — it
  rested on a single 38-line sample read as "already dense". The four product docs are the
  largest in the domain and grew between #80's measurement (2026-09-13) and today
  (grouping 1,117→1,392, selection 744→938, filtering 768→876), which argues for trimming them,
  not skipping them.
- **2026-09-16 — `0-product/**` has a machine consumer, so its structure is frozen.** The
  `story-plan` skill re-derives coverage marks against `*-story-host` code. Trimming must leave
  every heading, every ✅/🟡/❌ coverage mark, every acceptance-criterion bullet and every
  **Covered by:** link untouched. This constrains *how* to cut, not *whether*.
- **2026-09-16 — Bar is "cut what carries nothing", no budget.** No per-file or per-kind line
  ceiling. A line goes only if removing it loses no information; whatever survives is the right
  length. #80's second open question is answered: line delta is a reported outcome, never a
  target to hit.
- **2026-09-16 — The work is conceptual trimming, not word-level trimming.** Reason about what
  content belongs at all, then remove what does not. Simplifying the wording *and the concept*
  is the main lever; shortening sentences while keeping every item is not the ask.
- **2026-09-16 — Mechanical "counts unchanged" verification is rejected.** It enforces the wrong
  invariant: keeping every bullet/heading guarantees word-level trimming only. #80's acceptance
  criterion "step/criteria counts unchanged" is therefore wrong as written and must be replaced.
- **2026-09-16 — Removal is governed by a per-kind documentation contract.** Each artifact kind
  owes a specific, structured minimum; content outside that contract is misplaced, not
  information to preserve. Sketch from the interview:
  - **Story host comments** — what the story demonstrates, in user-facing terms ("the lesson of
    the story"). Not decision documentation, not why/how it is implemented, no competitive
    research, no ADR rationale.
  - **Function / service / method JSDoc** — the essence: what it does, plus edge cases. Per
    `terse-jsdoc-for-ai-and-humans`.
  - Balance the contract against output size; the contract sets the floor, not a quota.
- **2026-09-16 — Worked example of the defect.** `client-filtering-story-host.component.ts`
  (99 comment lines / 348) carries a class JSDoc containing peer-library comparison, an ADR-0014
  reference, and a `filter()`-vs-`equals()` rationale. None of it says what the story shows.

## Decisions (grill, 2026-09-16)

| # | Decision |
|---|---|
| D1 | Tier 4 out of scope entirely. No retention policy set by this ticket. |
| D2 | `0-product/**` stays in scope. Excluding it was unfounded — those four docs are the largest in the domain and grew between #80's measurement and today. |
| D3 | `0-product/**` structure is frozen: the `story-plan` skill re-derives its coverage marks against story code. Every heading, ✅/🟡/❌ mark, acceptance-criterion bullet and `**Covered by:**` link survives verbatim. Trim around them. |
| D4 | Bar is "cut what carries nothing" — no per-file or per-kind line budget. Line delta is a reported outcome, never a target. |
| D5 | Mechanical "counts unchanged" verification is **rejected**. It enforces the wrong invariant — keeping every bullet guarantees word-level trimming only. #80's acceptance criterion is wrong as written and gets replaced. |
| D6 | Removal is governed by a per-kind documentation contract (below). Content outside its kind's contract is misplaced, not information to preserve. |
| D7 | Before deleting out-of-contract reasoning: check whether it already lives in `docs/`. If yes, delete. If it exists nowhere else, relocate it to the owning doc first. Nothing is dropped without a home. |
| D8 | `capability:` / `spec:` / `code:` frontmatter is **frozen** — it is generator input for `docs/status.md`. Conversely, status narrated inline in body prose ("Shipped —", "built, uncommitted", "decided in #96") is duplicated state and is removable, because `status.md` already derives it. |
| D9 | The target format for story documentation is derived from what TanStack Table, Angular Material, AG Grid and MUI X converged on — measured, not assumed. AG Grid was one example, not the specification. |
| D10 | The per-kind contracts are an **upstream deliverable**, not a side product of trimming. "What does this kind owe" has no answer without them, and verification checks a trimmed file against its contract — which is why bullet counts (D5) were the wrong instrument: there was nothing to check against. |
| D11 | The contracts are the only part of this work that survives the trim. Docs grew +15,157 lines in three days; a trim with no contract decays back. #78 already presumes a bar exists ("write those at the new terse bar"). |
| D12 | **No agent per kind.** That is the enumerated-surface-per-case shape `general-mechanism-over-enumerated-cases` warns against — four agents differing only in which paragraph they load is four maintenance points for one mechanism. Split on the real seam instead: **source comments vs. markdown**. Different tools, different risk, different verification (a source pass ends in `nx run shared-table:typecheck`; a markdown pass does not). Two dispatch targets, each loading the contract for the class of file it is handed. |
| D13 | **A contract over ~40 lines has stopped being a contract.** Writing five of them is itself a docs-writing job inside a docs-*reduction* ticket; they must not become the next thing needing a trim. |
| D14 | ~~Contracts written inside #80 as step 1.~~ **Superseded by D21** — decided before the `~/.claude/` seam surfaced. The contracts cannot be repo work; they file in work item A, which precedes #80. |
| D15 | Duplications resolve to **one owner, others link** — no summary retained in the linking file. Each of D1-D22 ends with exactly one file stating the claim. Drift is the reason: D11 already has four files disagreeing about whether reducer-combine shipped. |
| D16 | **The contracts are defined in this plan, not in step 1.** A contract is a decision; deferring it into execution is the readiness-gate mistake again. Step 1 files already-decided text. |
| D17 | **An ADR contract already exists** — `~/.claude/skills/domain-modeling/ADR-FORMAT.md`: title + 1-3 sentences, optional sections "most ADRs won't need." The repo ignores it: 14 of 15 table ADRs carry Context/Decision/Consequences, 9 carry Alternatives, several carry discussion sections (`## The D37 objection`, `## Options, weighed`, `## Research`). ADR-0001 is 8 lines and conforms; ADR-0015 is 270. The ADR problem is enforcement, not absence. |
| D18 | **One `adr-writer` agent.** The mechanism, not "it's standalone work": ADRs are written mid-grill by the party holding the whole discussion, and that party writes the discussion. An agent handed only *decision / why / consequences / alternatives* cannot reproduce 270 lines it never saw. Context isolation is the fix. `domain-modeling` dispatches it instead of writing inline. |
| D19 | **Contracts live in `~/.claude/conventions/doc-contracts/`, never in `.claude/rules/`.** Rules inject into every matching context; a format should load only when its consumer asks for it. Agents *reference* the contract by path. `conventions/` already exists for exactly this — "opt-in, not always-on." |
| D20 | **Source-comment contracts are framework-agnostic.** They sit above `angular-developer` / `react-developer`. `story-implementer`, `angular-implementer` and `react-implementer` each get a one-line pointer to the contract for the file class they produce. No new agent for source comments — the writers already exist. |
| D21 | **The global tooling is its own work item, outside #80.** Agent, contracts, skill rewiring and agent pointers all live under `~/.claude/` and cannot ship in a repo commit. It is a prerequisite of #80, sequenced first, small: 4 contract files, 1 agent, 3 pointer edits, 1 skill edit. |
| D22 | **Each contract is grilled and accepted individually before it files.** Writing four into the plan as settled was the readiness-gate mistake in reverse. **`story-doc.md` accepted 2026-09-16** (38 lines; survey-grounded). **`adr.md` accepted 2026-09-16** (36 lines; validated by rewriting ADR-0016, 130→21). **`product-doc.md` accepted 2026-09-16** (37 lines; skeleton derived from the four existing docs). **`jsdoc.md` accepted 2026-09-16** (40 lines; source-surveyed, then reconciled against written conventions — 4 adopted, 3 overruled with reasons). **All four contracts accepted; work item A1 files them verbatim.** |
| D23 | **The `ai-docs` skill is retired, split on the same seam as D12.** It predates the contracts and carries a competing format inline: "JSDoc under 50 words, one channel, `@example` only when props are ambiguous" against `jsdoc.md`'s two channels, 25-60 words, `@example` on entry points. Whichever an agent loads first wins. One format per kind (D15) governs tooling too, not only docs. |
| D24 | **Two skills, split by file class — markdown vs. TypeScript source.** `kipi` keeps the markdown side unchanged: colocated `docs/` folders, config-driven file set, dispatching `domain-docs-writer`. A new `source-docs` skill owns the TypeScript side — rewrites `/** */` and `//` in place against `doc-contracts/jsdoc.md`, never writes a `.md` file. This is D12's seam one level up: not two agents differing by which paragraph they load, but two skills differing by what they open and how they are verified. A `source-docs` run ends in `nx run <project>:typecheck`; a `kipi` run has no equivalent. |
| D25 | **`source-docs` takes a path at any granularity** — one file, a feature folder, or a whole lib — and walks the `.ts` files under it. That is how #80 step 3 actually runs (`api/`, `engine/`, `filters/`, `schema/`, `mutations/`, `directives/`); a strictly per-file contract would need a caller to loop over ~100 files. |
| D26 | **`source-docs` excludes story hosts and `.stories.ts`.** Those stay owned by `story-implementer` through its A4 pointer to `story-doc.md` — a story doc block is written by the party that built the story, at the moment it is built, the same isolation argument as D18. **Consequence:** #80 step 2 is not a `source-docs` run. It stays a dispatch to the source target loading `story-doc.md`. The skill is a going-forward authoring tool for non-story source, not the trim's instrument. |
| D27 | **`ai-docs`'s `spec.md` / `narrative.md` templates become kipi config, not contracts.** They are a design-system doc shape, present in this repo only under `apps/issa-landing/src/design-system/components/**` and nowhere in `libs/shared/table`. `kipi` already refuses to own a file set — it reads `docs/agents/domain-docs.md`. So the templates file there, scoped to the issa-landing context, and `doc-contracts/` gains nothing. One rule travels with them: `narrative.md` rationale **links** the ADR and never restates it, or it reintroduces the duplication D15 exists to kill. |
| D28 | **The step-1 "relocate the 17 orphan claims" pre-pass is dropped.** The "17" was never enumerated in the issue, this file, or the plan — and re-asked, the user had no recollection of it either. It was carried forward as a bare count from an earlier discovery pass that never persisted the list. D7's check is not abandoned — it now runs inline, per file, inside steps 1-4: before deleting out-of-contract reasoning, confirm it already lives elsewhere in `docs/`; if not, relocate first. No separate counted pre-pass. |
| D29 | **Same fix applies to "22 cross-file duplications (D1-D22)."** The plan names only 5 by example (Competitive position block, coverage-mark legend, pipeline order, RenderRow+ADR-0011, selectAllIds()/D59); the other 17 were never individually catalogued either. Step 3 (reference docs) finds duplicated blocks by reading, not by checking off a missing list — same discover-as-you-go mechanism as D28, applied to duplication resolution instead of orphan relocation. |

## The per-kind documentation contracts

Partial coverage already exists — the gap is narrower than "define everything":

| Kind | Contract today | Gap |
|---|---|---|
| Method / service JSDoc | `terse-jsdoc-for-ai-and-humans` + `no-decision-narration-in-code-comments` — rules, not a format; no `//` channel, no external grounding | write `jsdoc.md`; the two rules stay as injected guards |
| Markdown prose generally | `concise-docs` skill | covered |
| **Story host comments** | **none** | **write it** |
| ADR | `domain-modeling/ADR-FORMAT.md` — exists, ignored (D17) | move + enforce via `adr-writer` |
| Product user-stories doc | implicit in `story-discovery` / `story-plan` | write it down |

The missing one is exactly the worst class: `client-filtering-story-host.component.ts`, 99
comment lines of 348, carrying ADR-0014 rationale, peer-library comparison and a
`filter()`-vs-`equals()` argument. The lesson of the story is a different document from the ADR
that currently bleeds into it.

Each kind owes a specific minimum. Content outside it is removed (subject to D7). All four are
**defined here** (D16); the prerequisite work item only files them. Each stays under 40 lines
on disk (D13).

### `doc-contracts/story-doc.md` — **accepted 2026-09-16**, files verbatim (38 lines)

```markdown
# Story doc comment

The JSDoc block above a story host class or a `.stories.ts` export. Storybook renders it as
the story's description. Written for a consumer learning how to use the feature — not for
the person who built it.

## Shape

    /**
     * <Title>
     *
     * <Demonstrates>
     *
     * <Caveat — optional, at most one>
     */

- **Title** — 3-8 words, noun phrase. `Table with client-side filtering`. Never "This story shows…".
- **Demonstrates** — 1-2 sentences, 20-45 words. Name the API that turns the behavior on.
  If interactive, give one concrete action: "Type in the customer box and watch the row count follow."
- **Caveat** — 1-2 sentences, only when it changes what a consumer must do in production.
  If it applies to one line of the body, put it on that line instead.

Budget: 3-8 lines, 25-60 words. Hard ceiling 10 lines. Kitchen-sink stories get *less*, not more.

## Never in this block

Design rationale. Why this API over another. Peer-library comparison. ADR references.
D-numbers or decision history. Internal mechanics. Restating what the code below already says.

Commented-out API alternatives (`// enableGrouping: false, // default true`) belong at the
call site inside the body, not here.

## Example

    /**
     * Table with client-side filtering
     *
     * Per-column inputs and a quick filter, all driven by `createFilters()`
     * feeding `withFiltering()`. Type in the customer box and watch the row
     * count follow.
     *
     * Reset restores the declared defaults; Clear all empties every criterion.
     */
```

### `doc-contracts/jsdoc.md` — **accepted 2026-09-16**, files verbatim (40 lines)

Grounded twice: 24 source files across TanStack Table/Query, Angular core, CDK, Signal Forms,
NgRx, Zod (type mechanics in public JSDoc: 0/24; decision history: 0/24), then reconciled
against TSDoc, Google TS style guide, API Extractor, Angular contributing docs, Fluid TSDoc
guidelines. Adopted: third-person summary, `@remarks` for detail, exported helpers get one
line, `//` may say *why this line*. Overruled with reason: `@privateRemarks` (no stripping
tooling here; hover shows it), `@param` always (no API reference generated), `@defaultValue`
(prose matches observed practice). **Consequence for step 3:** the `TS2589`-class notes in
`filters/types.ts` and `schema/` are *moved* into `//` blocks, not deleted — that slice's
delta shrinks.

```markdown
# JSDoc on source

Two channels, by reader. `/** */` is read by consumers — API reference, IDE hover. `//` is
read by the next maintainer, in the file. Content goes to the channel whose reader needs it.
Budgets below are house policy; no published convention quantifies length.

## `/** */` — exported functions, factories, feature plugins

    /**
     * <Verb phrase, third person, one sentence: "Creates…", "Returns…". ≤25 words.>
     *
     * @remarks
     * <Only for semantics the signature cannot state: what counts as empty, mutate vs
     *  copy, ordering, when it re-runs. A consumer gotcha starts "Note: ".>
     *
     * @example <3-8 runnable lines, real identifiers — on entry points and composition
     *           functions; omit on accessors>
     */

4-10 lines, 25-60 words excluding the example. `@param` / `@returns` only when the name or
type does not already say it. `@see` at most twice. Defaults in prose: "Defaults to `X`."
No `@remarks` without a summary above it. No emoji.

## `/** */` — options properties, class fields, exported type aliases

One sentence, 12-30 words: what it controls or models, in domain terms, plus its default.
3-6 lines only for an interaction effect ("overrides any `initialState`"). Non-exported
helper types: no JSDoc.

## `//` — maintainer notes

Inside the body, directly above the clause. May explain *why this code is shaped this way*:
a TS constraint, a browser quirk, a performance choice. `Note: <constraint>. <why>.
<symptom if violated — e.g. "TS2589 infinite recursion">.` 2-8 lines. A bare issue or ADR
URL may follow. This is where "`any` must stay first because `Flatten<any>` recurses"
lives — kept, moved, never in `/** */`.

## Never in either channel

Decision history, D-numbers, rejected product alternatives, peer-library precedent,
restating the signature or the type. A `//` line may cite an ADR by URL; nothing restates it.
```

### `doc-contracts/adr.md` — **accepted 2026-09-16**, files verbatim (36 lines)

Validated by rewriting ADR-0016: 130 → 21 lines, two sentences, both optional sections earning
their place. Cut material relocates: status header → frontmatter; migration narrative →
`work/decouple-filters/`; `matcher()` isolation semantics and the "if you hit this error"
recipe → `1-state/filters.md`; bullets describing deleted internals → nowhere.

```markdown
# ADR

`docs/adr/NNNN-slug.md`, numbered sequentially — scan for the highest and add one. Create
`docs/adr/` lazily, on the first ADR.

## Shape

    # <Short title of the decision>

    <1-3 sentences: the context, what was decided, and why.>

That is a complete ADR. Its value is recording *that* a decision was made and *why* — not
filling sections.

## Optional sections — each earns its place or is absent

- **Status** frontmatter (`proposed | accepted | deprecated | superseded by ADR-NNNN`) —
  only once a decision has been revisited.
- **Alternatives considered** — only when a rejected option is likely to be proposed again.
  One line per alternative: what it was, why not.
- **Consequences** — only for downstream effects a reader would not infer from the decision.

Budget: under 40 lines including every optional section. Most ADRs are under 10.

## Never in an ADR

Research, option-weighing narrative, objections and rebuttals, open questions, type-probe
transcripts, pasted source, corrections to an earlier draft of the same ADR. Research belongs
in `work/`; open questions in `decisions.md`; a changed decision is a *new* ADR that
supersedes this one.

## When to write one

All three, or skip it: hard to reverse; surprising without context; the result of a real
trade-off. Deliberate deviations from the obvious path qualify. "We did the obvious thing"
does not.
```

### `doc-contracts/product-doc.md` — **accepted 2026-09-16**, files verbatim (37 lines)

Skeleton derived from the four existing docs, which agree on it exactly. Validated on
`grouping.md §1.2`: frozen rows untouched; a 6-line Design-status paragraph citing four
peer libraries becomes one line plus a link to the research doc that owns the citation.

```markdown
# Product user-stories doc

`docs/0-product/<capability>.md`. Written by `story-discovery`; read by `story-plan`, which
re-derives every coverage mark against real story code. The frozen rows below are its
interface — a trim that touches them breaks the tool.

## Shape

    # <Capability>
    <Scope: 2-4 sentences. Link the coverage-mark legend; do not restate it.>

    # 1..k  <One heading per thing a person is trying to do>
    ## n.m — <Story title> — <✅|🟡|❌> <one-clause state>        FROZEN
    > As someone <situation>, I want <action>, so that <outcome>.  FROZEN
    **Acceptance criteria**  <bullets>                              FROZEN
    **Failure behavior**     <bullets>                              FROZEN
    **Covered by:** <story links, one clause each>                  FROZEN
    **Design status:** <one line, or a link to the research that owns the citation>

    # Cross-feature interactions   <one ## per owning feature, each linking not restating>
    # Open questions               <one bullet each: question, recommendation, what settles it>
    # Gap analysis, by owning layer
    # Capabilities with no owner
    # Not user-facing

## Rules

- **Covered by** names the story and what to do in it. It does not explain the mechanism.
- **Design status** is one line. Competitor-issue citations, peer comparisons and
  "no decision covers this" arguments live in `work/**/research-*.md` and are linked.
- The coverage-mark legend, ownership note and layer-free disclaimer exist once, in
  `README.md` or one owning doc. The others link.
- A resolved item is deleted, not struck through. History is in git and `work/`.
- No re-verification narration ("re-verified 2026-09-05, was wrongly marked ❌"). The mark
  is the current state; the delta is a commit message.
- No process sections (`# Report the deltas`). Those are the run's output, not the doc.
```

### Reference docs (`1-state`, `2-columns`, `3-ui`) — no new contract

`concise-docs` already owns markdown prose. The trim adds only D8: status narration in the
body is duplicated state and goes; `capability:`/`spec:`/`code:` frontmatter stays.

