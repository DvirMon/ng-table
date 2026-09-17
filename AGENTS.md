Tech stack, commands, and project map live in `AGENT.md` — not duplicated here.

## Projects

Two Nx projects, each owning its own `AGENTS.md` (maintainer invariants), `CONTEXT.md` (glossary) and `docs/adr/`:

- `libs/table/AGENTS.md` — the library. Read before touching `libs/table/src/**`.
- `apps/site/AGENTS.md` — the docs site. Read `apps/site/docs/CONVENTIONS.md` before adding a component or page block.

`llms.txt` is generated (`npm run llms`); `npm run llms:check` must stay clean.

## File organization

Code under `libs/**` and `apps/**` splits by concern (types, store, mock data, utils, …). See `.Codex/rules/file-organization.md` and `.Codex/rules/extract-encapsulated-logic.md`.

## Typechecking

Acceptance checks on an Angular project cite `nx run <project>:typecheck` (ngc, template-aware), never bare `npx tsc`. See `.Codex/rules/typecheck-angular-templates.md`.
