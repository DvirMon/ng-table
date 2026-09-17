---
title: Current state — how the table project documents its knowledge base
type: audit
date: 2026-09-14
status: measured
audience: developers
---

# Current state — `libs/table` knowledge base

Measured 2026-09-14 against `libs/table/docs/`.

## Shape

| Metric | Value |
|---|---|
| Markdown files under `docs/` | 310 |
| By layer | `0-product` 5 · `1-state` 219 · `2-columns` 8 · `3-ui` 60 · `adr` 14 |
| Work efforts (`*/work/<slug>/`) | 29 |
| Files with YAML frontmatter | 216 / 310 (70%) |
| Generated files | 1 (`status.md`, from `tools/generate-status.ts`) |
| Broken relative `.md` links | 31 real (+3 false positives), fixed 2026-09-14 — see G2 |

## The layering, as it actually exists

Four numbered layers mirroring the implementation stack, plus a decision store:

```
docs/
├── README.md        ← hand-maintained navigation hub
├── overview.md      ← architecture map
├── status.md        ← GENERATED from spec frontmatter (capability/spec/code)
├── 0-product/       ← user-story / PRD level
├── 1-state/         ← store + feature specs, and 29 work efforts under work/
├── 2-columns/       ← column schema, with reference/ deep dives
├── 3-ui/            ← directives + cross-cutting
└── adr/             ← 0001–0015, accepted decisions
```

Each work effort carries a pipeline: `1-ticket → 2-decisions/grill → 3-spec → 4-issues →
5-tasks`, with `state.json` threading machine-readable state (slug, paths, `githubIssues`,
checklist booleans) between skills. Task plans nest one folder per GitHub issue
(`docs/tasks/issue-43-integration-green/step-N-*.plan.md` + `progress.md`).

Frontmatter vocabulary in use, by frequency: `title` (213), `type` (209), `issue` (99), `date`
(95), `status` (74), `audience` (68), `parent` (41), `version` (40), `capability` (29), `spec`
(25), `code` (25), `plan` (23), `node` (21), plus rare `supersedes`, `scope`, `method`, `commit`.

## What is already strong

- **A compiled layer distinct from a raw layer.** Specs and ADRs are synthesised artifacts, not
  transcripts. Work efforts keep the raw grilling separate from the spec it produced.
- **Generation over hand-maintenance where it counts.** `status.md` is derived from the specs'
  own frontmatter and refuses hand edits — the one place drift would be most expensive is the
  one place drift is structurally impossible.
- **Decisions have a home and are numbered.** ADR-0001…0015 with `Status`, `Date`, `Related`,
  and explicit re-litigation notes (ADR-0015 reopens ADR-0007 on different grounds and says so).
- **A schema layer.** `CLAUDE.md` (23 KB), `.claude/rules/*.md`, `docs/agents/*.md` and
  `CONTEXT.md`/`CONTEXT-MAP.md` tell an agent how to read and write this base — this is exactly
  the "schema" third layer of the LLM Wiki pattern, already present.

## The four gaps

**G1 — No retrieval interface.** 310 files, no index an agent can query. Every lookup is a glob
plus a grep plus a read, which costs tokens and silently misses semantically-related pages that
don't share a keyword. This is the single biggest cost and the cheapest to fix — see
[2-qmd-retrieval.md](2-qmd-retrieval.md).

**G2 — No maintenance loop.** Nothing scans for contradiction, staleness, or orphans. Evidence
that this is not hypothetical: an audit found 31 broken relative links (the first count of 34
included 3 external `raw.githubusercontent.com/**.md` URLs the checker misread). 26 of the 31 sat
in `1-state/architecture.md` (15) and `3-ui/architecture.md` (11) — both write paths as if rooted
at `docs/` while sitting one level down. Two of the most-read files in the base had a quarter of
their navigation dead, and nothing reported it.

**Fixed 2026-09-14** — all 31, plus 4 more found by widening the check to non-`.md` targets. The
point stands: they were found by a one-off script written for this audit, not by anything that
runs. Without a checker in CI the count goes back up. `/audit-docs` exists as a skill but is manually invoked, per-file, and
truth-checks against code rather than checking structural health.

**G3 — `status:` is free text, so it can't be queried.** 74 files carry a `status:`, with values
ranging from `complete` and `accepted` to a 180-character sentence describing partial
implementation. A human reads these fine; a filter cannot. `capability:`/`spec:`/`code:` are the
counter-example — controlled vocabulary, which is precisely why `status.md` can be generated from
them.

**G4 — No last-reviewed signal.** `date:` records when a doc was *written*, not when it was last
checked against reality. 22 files date to 2026-07 and have not been touched since; nothing
distinguishes "still true, verified last week" from "written in July, never revisited".

## Interpretation

The base is well-structured for *writing* and under-instrumented for *reading and keeping*. The
LLM Wiki method names the missing pieces as first-class operations (query, lint, librarian);
`qmd` supplies the query one directly. Neither asks for the structure to change.
