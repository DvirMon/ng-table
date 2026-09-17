---
title: Knowledge Base Method — research reports
type: index
date: 2026-09-14
status: research — no decision taken
audience: developers
---

# Knowledge base method — research reports

Research pack answering four questions:

1. **[0-current-state.md](0-current-state.md)** — how `libs/table` documents its knowledge
   base today, measured, with the gaps named.
2. **[1-llm-wiki-method.md](1-llm-wiki-method.md)** — what the LLM Wiki method is (Karpathy's
   pattern, the arXiv formalisation, the shipped implementations), and how it maps onto what we
   already have.
3. **[2-qmd-retrieval.md](2-qmd-retrieval.md)** — `qmd`, the local CLI/MCP search engine that lets
   an agent *query* a markdown knowledge base instead of globbing it.
4. **[3-grooming.md](3-grooming.md)** — grooming: the periodic clean-up/refine pass that keeps the
   base from rotting, with a concrete rubric and cadence.
5. **[4-adoption-plan.md](4-adoption-plan.md)** — how to run this across many projects, in three
   increments, with the cost of each.
6. **[5-recommended-actions.md](5-recommended-actions.md)** — **the answer to "what should we
   change".** Eight actions argued from what this repo already does, including a generated
   `llms.txt`.

Nothing here is a decision. Decisions that come out of it belong in an ADR under the owning
context (`libs/table/docs/adr/`, or a repo-level one if the method spans contexts).

## One-paragraph summary

We already run ~80% of the LLM Wiki method by hand: immutable source layer (code + tickets),
compiled layer (`docs/**`), schema layer (`CLAUDE.md` + `.claude/rules/`), and a generated index
(`status.md`). What we do **not** have is (a) retrieval — 310 markdown files with no query
interface, so agents grep; (b) a maintenance loop — nothing detects contradiction, staleness, or
orphan pages; (c) a link graph — cross-references are hand-written and unverified. `qmd` fixes
(a) cheaply. A grooming pass fixes (b) and (c). Neither requires restructuring the docs we have.
