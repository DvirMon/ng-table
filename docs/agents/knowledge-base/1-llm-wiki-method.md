---
title: The LLM Wiki method
type: research
date: 2026-09-14
status: research
audience: developers
sources: karpathy-gist, arxiv-2605.25480, nvk/llm-wiki, nashsu/llm_wiki, SamurAIGPT/llm-wiki-agent
---

# The LLM Wiki method

## Origin and status

The pattern was published by **Andrej Karpathy** ([X post,
2026](https://x.com/karpathy/status/2039805659525644595); [idea
gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)) and has since produced
both a peer-reviewable formalisation and several open implementations:

| Source                                                                                                                             | Kind                 | What it contributes                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------- |
| [Karpathy gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)                                                 | Origin               | The three-layer model and the three operations                                                                  |
| [arXiv 2605.25480 — _Retrieval as Reasoning: Self-Evolving Agent-Native Retrieval via LLM-Wiki_](https://arxiv.org/abs/2605.25480) | Paper                | Formalisation, benchmarks vs. GraphRAG/LightRAG/HippoRAG 2, the "Error Book" self-correction mechanism          |
| [nvk/llm-wiki](https://github.com/nvk/llm-wiki)                                                                                    | Implementation (MIT) | The most complete command surface: hub-and-topics layout, `/wiki:*` commands incl. `lint`, `audit`, `librarian` |
| [nashsu/llm_wiki](https://github.com/nashsu/llm_wiki)                                                                              | Implementation       | Desktop app; incremental wiki build over RAG                                                                    |
| [SamurAIGPT/llm-wiki-agent](https://github.com/SamurAIGPT/llm-wiki-agent)                                                          | Implementation       | Claude Code / Codex / Gemini CLI harness, no API key                                                            |
| [arXiv 2605.02163 — _DocSync: Agentic Documentation Maintenance via Critic-Guided Reflexion_](https://arxiv.org/abs/2605.02163)    | Paper                | The maintenance half: AST-grounded drift detection + critic loop (see [3-grooming.md](3-grooming.md))           |

## The claim

Conventional RAG re-derives an answer from flat chunks on every query — the knowledge never
accumulates. The LLM Wiki inverts this: the model **compiles** sources into a persistent,
interlinked markdown wiki once, and thereafter queries the wiki. In Karpathy's framing, the wiki
is "a persistent, compounding artifact"; the paper's framing is that retrieval becomes _reasoning_
— the agent searches, reads a page, follows links, and judges whether it has enough evidence,
iteratively, instead of receiving one similarity-ranked blob.

The paper reports 2.0–8.1 F1 over HippoRAG 2 / LightRAG / GraphRAG on HotpotQA, MuSiQue and
2WikiMultiHopQA, and best overall accuracy on AuthTrace, with the largest gains on
multi-document structured queries — i.e. precisely the shape of "why is this API designed this
way, and what else did that decision touch".

## The three layers

| Layer           | Owner                   | Rule                                                                                                         | Our equivalent                                                    |
| --------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| **Raw sources** | Human curates           | Immutable — the LLM reads, never edits                                                                       | Source code, GitHub issues, grill transcripts, competitive audits |
| **The wiki**    | LLM owns entirely       | Compiled pages: concepts, entities, references, cross-links                                                  | `docs/0-product` … `docs/3-ui`, `docs/adr/`                       |
| **The schema**  | Human writes, LLM obeys | Structure, conventions, workflows — "transforms an LLM from a generic chatbot into a disciplined maintainer" | `CLAUDE.md`, `.claude/rules/`, `docs/agents/`, `CONTEXT.md`       |

The schema layer is the part most teams miss and the part we already have. Karpathy names
`CLAUDE.md` as the canonical instance of it.

## The three operations

1. **Ingest** — a source is dropped in; the agent reads it, extracts, updates _the 10–15 pages it
   touches_, and appends to a log. Note the fan-out: one source edits many pages. Our pipeline
   does the opposite today — one work effort writes one folder, and cross-page propagation is
   manual (this is why the two architecture files drifted).
2. **Query** — ask the wiki, not the sources. Answers cite pages. A query worth keeping becomes a
   new page.
3. **Lint** — periodic health check for contradictions, stale claims, orphan pages, missing
   cross-references. `nvk/llm-wiki` splits this into `lint --fix` (structural), `audit`
   (provenance/trust), and `librarian` (staleness/quality).

Karpathy's justification is a cost argument, not a quality one: _"The tedious part of maintaining
a knowledge base is not the reading or the thinking — it's the bookkeeping."_ Bookkeeping at near-
zero marginal cost makes maintainable the knowledge bases humans abandon.

## Structural conventions worth stealing

From `nvk/llm-wiki`, the ones that transfer to a code repo:

- **One topic, one wiki, isolated index** — no cross-topic noise. Maps onto our
  `CONTEXT-MAP.md` multi-context split; each context is a topic wiki.
- **Raw is immutable.** Retraction is explicit and user-directed, never a side effect of a
  compile.
- **Dual-linking** — both `[[wikilinks]]` and standard markdown links resolve. We use markdown
  links only; `[[…]]` is what makes backlink/orphan detection cheap.
- **Confidence scoring per article** (high/medium/low, by source quality and corroboration). Our
  nearest equivalent is `status:` — which is free text and therefore not machine-usable (G3).
- **An append-only `log.md`** per topic. We have git, which is strictly better provenance but far
  worse as a _readable_ record of what the base learned and when.
- **Archive-aware** — archived topics stay on disk but drop out of default queries. We have 29
  work efforts, many landed; nothing marks them as out of the default read path.

## Honest assessment of fit

This is not a proposal to restructure `docs/`. Our compiled layer is _better organised_ than a
generic topic wiki — it is keyed to the implementation stack, which is the right axis for a code
repo. What the method supplies that we lack is the **operation set**: ingest-with-fan-out, query,
and lint. Of those, query is a tool problem ([2-qmd-retrieval.md](2-qmd-retrieval.md)) and lint is
a process problem ([3-grooming.md](3-grooming.md)).

Two mechanisms are worth adopting more or less as-is:

- **The Error Book** (arXiv 2605.25480) — a persistent record of the base's own structural and
  semantic mistakes, fed back into future compiles. Our closest analogue is
  `~/.claude/rules/` + memory, which capture _process_ corrections but not _knowledge-base_
  corrections.
- **Wikilinks for the graph.** Adding `[[slug]]` alongside markdown links costs nothing and makes
  orphan/backlink detection a one-pass script instead of an LLM job.
