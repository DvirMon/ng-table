---
title: Adoption — running this at scale across projects
type: research
date: 2026-09-14
status: proposal — no decision taken
audience: developers
---

# Adoption plan

Goal as stated: a durable second brain — a large body of documentation recording design and
architectural decisions, queryable by agents, that keeps code quality high as the codebase grows.

The plan is deliberately three increments, each independently useful, each reversible.

## What stays as-is

The four-layer `docs/` split keyed to the implementation stack, the numbered ADR store, the
work-effort pipeline with `state.json`, and the generated `status.md`. These are better than what
a generic wiki layout would give a code repo. Nothing below restructures them.

## Increment 1 — make the base queryable (days)

Closes G1.

- Install `qmd`, one collection per context per `CONTEXT-MAP.md`, plus one for
  `~/.claude` guidelines. See [2-qmd-retrieval.md](2-qmd-retrieval.md).
- Register the MCP server for Claude Code.
- Add to `docs/agents/domain.md`: query before you glob; cite the page you used.
- Trial gate: ten questions we already know the answers to. If `qmd query` doesn't beat grep on
  most of them, stop here and keep grep.

**Cost:** ~2 GB local models, an index build, one config file. **Reversible:** delete the cache.

## Increment 2 — make the base checkable (a week, spread)

Closes G2, G3, G4.

- Controlled `status:` vocabulary. Reuse the pattern that already works: `capability:`/`spec:`/
  `code:` are controlled, which is exactly why `status.md` can be generated. Fold `status:` into
  the same discipline, per the D1–D3 field vocabulary already written down in
  `state-feature-competitive-audit/decisions.md`.
- Add `last-reviewed:` (distinct from `date:`) and an `owner:` to every doc above work-effort
  level.
- Script the four cheap signals: broken link, orphan, age, status-vs-code drift. Output a flagged
  list; wire the link check into CI.
- Adopt `[[wikilink]]` alongside markdown links so backlinks and orphans are a one-pass parse.

**Cost:** one mechanical frontmatter migration + one script. **Payoff:** every later increment
runs on script output instead of LLM sweeps, which is what makes this affordable at repo scale.

## Increment 3 — make the base self-maintaining (ongoing)

Closes the loop.

- A `/groom` skill: consume the flagged list → LLM-check only flagged docs for contradiction,
  silent supersession, and redundancy → **critic pass on each proposed edit** (the DocSync
  finding) → open a PR, atomic commit per concern. Human merges. Never in-place.
- Monthly scheduled sweep; milestone sweep before a release; `/audit-docs` continues to ride
  individual PRs.
- An **Error Book** (arXiv 2605.25480): a single append-only page per context recording
  knowledge-base mistakes found — "the two architecture files wrote docs-root-relative paths",
  "grouping cascade ownership was stated three ways" — read by the next compile. This is the
  mechanism that stops the same class of drift recurring, and it is the one part of the LLM Wiki
  method we have no analogue for.
- Re-index `qmd` at the end of every grooming pass.

## Scaling past one repo

The unit of scale is the **context**, not the repo. Each context owns `CONTEXT.md`, `docs/adr/`,
its own doc tree, its own `qmd` collection, and its own Error Book — isolated index, no
cross-topic noise. `CONTEXT-MAP.md` is the hub. A second repo is a second set of contexts
registered in the same `qmd` config; nothing else changes.

What must be shared across repos, and therefore lives in `~/.claude` (already mirrored by
`/sync-guidelines`): the frontmatter vocabulary, the staleness rubric, the `/groom` skill, and the
instruction to query before globbing. What must not be shared: folder names and layer numbering —
those come from each domain, per the existing file-organization rule.

## What to decide first

Two questions gate everything else, in this order:

1. **Does `qmd` beat grep on our docs?** Answer with the ten-question trial. Cheap, and increment
   1 is worthless if it loses.
2. **Are we willing to pay the frontmatter migration?** Increments 2 and 3 both rest on
   controlled `status:` + `last-reviewed:`. Without it, grooming stays an expensive LLM sweep and
   `qmd --filter` stays unusable.

Neither has been answered. Nothing here has been run.
