Tech stack, commands, and project map live in `AGENT.md` — not duplicated here.

## Projects

Two Nx projects, each owning its own `CLAUDE.md` (maintainer invariants), `CONTEXT.md` (glossary) and `docs/adr/`:

- `libs/table/CLAUDE.md` — the library. Read before touching `libs/table/src/**`.
- `apps/site/CLAUDE.md` — the docs site. Read `apps/site/docs/CONVENTIONS.md` before adding a component or page block.

`llms.txt` is generated (`npm run llms`); `npm run llms:check` must stay clean.

## File organization

Code under `libs/**` and `apps/**` splits by concern (types, store, mock data, utils, …). Rules: global `file-organization` and `extract-encapsulated-logic`; this repo's worked example is `.claude/rules/file-organization.md`.

## Typechecking

Acceptance checks on an Angular project cite `nx run <project>:typecheck` (ngc, template-aware), never bare `npx tsc`. See `.claude/rules/typecheck-angular-templates.md`.

## Agent skills

### Issue tracker

Issues live in GitHub Issues. Every change reaches `main` through a PR, one issue = one branch = one PR, rebase-merged — never a direct push, never a merge commit. `/ship` opens the PR with auto-merge on. See `docs/agents/issue-tracker.md#issue-references`.

Commits: emoji conventional header with an optional story tag — `🎸 [#166 s2] feat(table/tree): …` (stage `s<N>`, `plan` or `review`; refactors are `ref`) — plus a `Refs: #N` (or `Refs: none`) trailer; `Closes #N` belongs in the PR body, never a commit. The `.githooks/` hooks and the `pr-conventions` check reject violations.

### Ticket tracker

Intake items are GitHub issues in this repo; epics are `kind:epic`
issues with sub-issues. See `docs/agents/ticket-tracker.md`.

### Domain docs

Multi-context — one `CONTEXT.md` + `docs/adr/` per Nx project. See `docs/agents/domain.md`.

### Workflow config

`.claude/workflow.json` — one entry per Nx project, sub-issue PRs, worktrees.
Personal overrides go in `.claude/workflow.local.json`.
