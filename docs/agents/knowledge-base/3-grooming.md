---
title: Grooming — keeping the knowledge base from rotting
type: research
date: 2026-09-14
status: research
audience: developers
---

# Grooming

"Grooming" = the recurring pass that refines and prunes the knowledge base, as distinct from the
per-change writing that grows it. In the LLM Wiki vocabulary it is `lint` / `audit` / `librarian`.
In docs-as-code vocabulary it is "gardening". Same practice.

## Why a cadence alone doesn't work

The industry evidence is consistent and unflattering to calendar reviews:

- 56% of API documentation teams name "keeping documentation up to date" as their single biggest
  challenge — ahead of writing quality, structure, and tooling
  ([State of Documentation 2026](https://www.happysupport.ai/en/blog/state-of-documentation-2026)).
- More than three in four surveyed had watched an AI tool at their company surface an outdated doc
  and confidently produce a wrong answer (ibid.). For an agent-driven repo this is the whole risk:
  a stale spec doesn't just mislead a reader, it gets *implemented*.
- Teams on quarterly reviews still reported that "stuff still slips through" and they "mostly
  catch it when it breaks" ([RampStack](https://rampstack.co/skills/documentation-strategy)).

What held, in the same reporting: **a named owner and a last-reviewed date on every important
doc** — "accuracy fails when keeping a doc current is everyone's job and therefore nobody's"
([Slite](https://slite.com/learn/dangers-of-stale-documentation)).

## The two halves

**Half 1 — truth (does the doc still match the code?).** This is what `/audit-docs` already does
here, and what [DocSync (arXiv 2605.02163)](https://arxiv.org/abs/2605.02163) automates: AST
analysis for structural grounding, RAG for dependency-aware context, and a **critic-guided
reflexion loop** — the model drafts an update, a critic scores it against the source, and it
refines. Reported 3.44/5.0 vs. 1.91 for CodeT5-base on a judge metric; the critic loop is the part
that produced the semantic-correctness gain. The transferable lesson is not the model but the
shape: *never accept a first-draft doc update; score it against code and iterate.*

**Half 2 — structure (is the base internally coherent?).** Contradictions between pages, stale
claims, orphan pages, broken and missing cross-references. Cheaper than half 1 — most of it is a
script, not an LLM. Our 34 broken links are pure half-2 debt and would be caught by a ten-line
checker.

## A staleness rubric

Adapted from the gardener-system pattern
([ADR-0166, JoelClaw](https://joelclaw.com/adrs/adr-0166)) and the LLM Wiki `librarian` command.
Each doc is scored on signals, and only docs that trip a signal get an LLM pass:

| Signal | Detection | Cost |
|---|---|---|
| **Source drift** | Files, paths, exports, or commands named in the doc no longer exist | script |
| **Broken link** | Relative `.md` target missing | script |
| **Orphan** | No inbound link from any other page | script |
| **Age without review** | `last-reviewed:` older than N months | script |
| **Status drift** | `status:` says "spec only" but the code shipped (or vice versa) | script, once `status:` is controlled vocabulary |
| **Contradiction** | Two pages assert incompatible things about one capability | LLM |
| **Superseded silently** | A newer ADR overrides a claim the older page still states flatly | LLM |
| **Redundancy** | Two pages cover the same ground; one should link, not restate | LLM |

Script signals first, LLM only on what they flag — that is what keeps a 310-file pass affordable.

## Cadence that actually catches things

Three loops, not one:

1. **On change (per PR).** The doc pass rides the code change. Constrained deliberately: an agent
   given "does the doc still match reality" needs its own guardrails "so it doesn't turn every
   commit into a documentation essay" ([Augment
   Code](https://www.augmentcode.com/guides/self-updating-documentation-docs-agents-sync)). Our
   `/audit-docs` + `/concise-docs` pair is this loop, invoked manually.
2. **On milestone.** Before a release, or after a refactor that moved a boundary. This is where
   cross-page fan-out gets reconciled — the case our pipeline currently handles worst.
3. **Scheduled sweep (monthly).** Run the script signals over everything, pull the flagged list,
   LLM-check only those, re-index for `qmd`. This is the pass that would have caught the two
   architecture files.

## Human stays in the loop

Consistent across every source: **detection and drafting automate; approval does not**
([Dewstack](https://www.dewstack.com/blog/self-updating-knowledge-base)). A grooming agent opens a
PR; a human merges it. An agent that silently edits the base destroys the property that makes the
base trustworthy.

Corollary for us: grooming output belongs in a branch with an atomic commit per concern (we
already have `/atomic-commit`), not in-place edits during an unrelated task.

## Concrete first moves

Ordered by cost:

1. **Link checker in CI** — catches the 34 existing breaks and prevents the next ones. Half a day.
2. **Controlled `status:` vocabulary** + a `last-reviewed:` key. Mechanical edit across 74 files;
   unlocks three script signals and `qmd --filter`.
3. **Orphan + age report** as a script writing a flagged list to a scratch file.
4. **A `/groom` skill** that consumes the flagged list, runs the LLM signals over only those docs,
   applies a critic pass to each proposed edit, and opens a PR.
