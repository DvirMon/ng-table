# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Layout: multi-context

Each Nx project is one context and owns its own glossary and ADRs. There is no root
`CONTEXT.md`, no root `CONTEXT-MAP.md` and no root `docs/adr/` — this section is the map.

| Context                | Glossary                | ADRs                   | Covers          |
| ---------------------- | ----------------------- | ---------------------- | --------------- |
| `shared-table`         | `libs/table/CONTEXT.md` | `libs/table/docs/adr/` | `libs/table/**` |
| `ng-table` (docs site) | `apps/site/CONTEXT.md`  | `apps/site/docs/adr/`  | `apps/site/**`  |

`llms.txt` (generated) also indexes each `CONTEXT.md`; this table is the one skills read.

## Before exploring, read these

- The **`CONTEXT.md`** of each context the topic touches (table above).
- That context's **`docs/adr/`** — read ADRs that touch the area you're about to work in.

A context with no glossary or ADR yet: **proceed silently**. Don't flag the absence; don't suggest creating it upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved. A new Nx project with its own `CONTEXT.md` gets a row here.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in the owning context's `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_
