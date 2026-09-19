Tech stack, commands, and project map live in `AGENT.md` — not duplicated here.

## Projects

Two Nx projects, each owning its own `CLAUDE.md` (maintainer invariants), `CONTEXT.md` (glossary) and `docs/adr/`:

- `libs/table/CLAUDE.md` — the library. Read before touching `libs/table/src/**`.
- `apps/site/CLAUDE.md` — the docs site. Read `apps/site/docs/CONVENTIONS.md` before adding a component or page block.

`llms.txt` is generated (`npm run llms`); `npm run llms:check` must stay clean.

## File organization

Code under `libs/**` and `apps/**` splits by concern (types, store, mock data, utils, …). See `.claude/rules/file-organization.md` and `.claude/rules/extract-encapsulated-logic.md`.

## Typechecking

Acceptance checks on an Angular project cite `nx run <project>:typecheck` (ngc, template-aware), never bare `npx tsc`. See `.claude/rules/typecheck-angular-templates.md`.

## Agent skills

### Issue tracker

Issues live in GitHub Issues. `/ship` pushes straight to `main` (no PR) — see `docs/agents/issue-tracker.md`.
