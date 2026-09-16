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
