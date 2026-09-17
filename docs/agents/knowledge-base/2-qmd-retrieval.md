---
title: qmd — querying the knowledge base from the CLI and from agents
type: research
date: 2026-09-14
status: research — not installed, not evaluated on this repo
audience: developers
---

# `qmd` — the query layer

## What it is

`qmd` ("query markdown") is a local-first CLI search engine for markdown knowledge bases, with an
MCP server so agents can call it as a tool. Canonical implementation:
[**tobi/qmd**](https://github.com/tobi/qmd) (MIT, by Tobi Lütke) — published as `@tobilu/qmd`.

> Name collision warning: at least four distinct projects ship as "qmd" —
> [tobi/qmd](https://github.com/tobi/qmd) (the one described here),
> [ehc-io/qmd](https://github.com/ehc-io/qmd) (MCP server for hybrid markdown search),
> [idanariav/qmd](https://github.com/idanariav/qmd) (frontmatter + semantic search fork), and
> [hjanuschka/pi-qmd](https://github.com/hjanuschka/pi-qmd) (extension for the `pi` agent).
> `.qmd` is also Quarto's file extension, unrelated. Verify the package before installing.

Everything runs on-device — three local GGUF models, no cloud call, no API key:

| Model | Size | Role |
|---|---|---|
| EmbeddingGemma-300M | ~300 MB | Vector embeddings |
| Qwen3-Reranker-0.6B | ~640 MB | Re-ranking |
| QMD Query Expansion-1.7B | ~1.1 GB | Query expansion |

## Why it matters for us

Gap G1 in [0-current-state.md](0-current-state.md): 310 markdown files with no query interface.
An agent asking "how did we decide grouping cascade ownership?" today runs glob → grep → read →
read → read, burning tokens and missing pages that phrase the same idea differently. `qmd query`
answers it in one call with ranked, scored excerpts.

The pipeline is: query → LLM expansion → parallel BM25 + vector → RRF fusion (k=60, original
query weighted 2×) → LLM re-rank (0–10, position-aware blending) → ranked results.

Two properties matter specifically for a code repo's docs:

- **AST-aware chunking** for `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.go`, `.rs` — the index can
  cover `src/` as well as `docs/`, chunked at semantic boundaries rather than every 900 tokens.
- **Frontmatter metadata filtering** with a recursive JSON AST and `eq`/`ne`/`gt`/`in`/`exists`
  operators. Our 216 frontmatter-bearing files become queryable facets — *if* the vocabulary is
  controlled. This is the concrete payoff for fixing G3.

## Command surface

```bash
npm install -g @tobilu/qmd        # verify the package identity first

qmd collection add libs/table/docs --name table-docs
qmd update                        # (re)index
qmd embed                         # build vectors

qmd search  "row id reconciliation"      # BM25 only, fastest
qmd vsearch "how do features compose"    # vector only
qmd query   "why one callable slice"     # hybrid + rerank — best quality
qmd get     docs/adr/0015-feature-member-namespacing.md --full
```

Useful flags: `-n <num>` (default 5), `-c/--collection`, `--min-score`, `--json`, `--explain`,
`--no-rerank`, `--full`, `--all`.

Metadata filter:

```bash
qmd query "grouping" --filter '{"key":"capability","operator":"eq","value":"grouping"}'
```

Storage: index at `~/.cache/qmd/index.sqlite`, config at `~/.config/qmd/index.yml`.

## Agent integration

MCP server, exposing `query`, `get`, `multi_get`, `status`:

```bash
qmd mcp                      # stdio
qmd mcp --http               # localhost:8181
qmd mcp --http --daemon
```

For Claude Code, that is an `mcpServers` entry with `command: qmd`, `args: ["mcp"]`. There is also
a JS SDK (`createStore({ dbPath, config })` → `search()`, `searchLex()`, `searchVector()`,
`get()`, `multiGet()`, `embed()`) if we ever want to drive it from a repo script rather than a
global install.

## How we would wire it here

One collection per **context**, mirroring `CONTEXT-MAP.md` — this is the LLM Wiki "one topic, one
wiki, isolated index" rule, and it keeps design-system results out of table queries:

```yaml
# ~/.config/qmd/index.yml (sketch)
collections:
  table-docs:   { path: libs/table/docs,  pattern: "**/*.md" }
  table-src:    { path: libs/table/src,   pattern: "**/*.ts" }
  ds-docs:      { path: libs/shared/design-system/docs, pattern: "**/*.md" }
  issa-docs:    { path: apps/issa-landing, pattern: "**/docs/**/*.md" }
  guidelines:   { path: ~/.claude, pattern: "**/*.md" }
```

Then `docs/agents/domain.md` gains a "before you grep, query" instruction pointing agents at the
MCP tool, and re-indexing becomes part of the grooming pass ([3-grooming.md](3-grooming.md)).

## Costs and open questions

- ~2 GB of models on first run, plus index build time over 310 docs + `src/` — unmeasured here.
- Index freshness is manual (`qmd update`); a stale index answers confidently from deleted pages.
  Tie the update to the grooming cadence or a git hook.
- Per-developer global install is state outside the repo. The SDK + a repo-local sqlite path is
  the alternative if we want the index reproducible and gitignored.
- **Not evaluated.** Nothing in this file has been run against our docs. Treat the retrieval
  quality claims as the project's, not ours, until a trial indexes `table-docs` and answers ten
  real questions we know the answers to.
