# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v` — `gh` does this automatically when run inside a clone.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

## Ship mode

**Direct push to default branch: yes.** This repo pushes straight to `main` instead of going
through a PR; `/ship` reads this flag.

`/ship` pushes the current commit(s) straight to `main` — no branch, no PR. The closing
trailer (below) must already be present in a pushed commit message — `/ship` checks for this
and stops rather than rewriting commit history if it's missing.

## Closing trailer

**Closing trailer: `Ships: #N`.** **Partial trailer: `Refs: #N`.**

Skills that write or check a closing reference (`/implement`, `/ship`, `code-review`) read these
two values; a repo without this section uses `Closes #N`.

- `Ships: #N` — this commit completes issue N. Several issues: `Ships: #1, #2`.
- `Refs: #N` — this commit is part of issue N but does not complete it.
- One trailer per line, the whole line, nothing else on it.

**Never write a GitHub closing keyword** (`close[sd]`, `fix(e[sd])`, `resolve[sd]` before
`#N`) anywhere in a commit message — not in the subject, not in prose. GitHub acts on those at
push time, before CI runs. `Ships:` is not a GitHub keyword, so only
`.github/workflows/close-linked-issue-on-ci-green.yml` closes the issue, once CI passes.

Enforced twice by `tools/commit-trailers.cjs`: the `commit-msg` hook in `.githooks/` (enabled
by `npm install` via the `prepare` script) and a CI step on every push.

**Check command: `node tools/check-commit-trailers.cjs --range <base>..<head>`.** Exits non-zero
and prints one line per problem; `/ship` runs it over the commits it is about to push.

- `feat`, `fix`, `refactor`/`ref`, `perf`, `test`, `docs` commits need a `Ships:` or `Refs:`
  trailer. Other types (`chore`, `ci`, `build`, `style`, `revert`) and merge commits don't.
- A commit that genuinely has no issue: add `Refs: none`.

### Epics

An epic is any issue with native GitHub sub-issues. The same workflow:

- refuses to close an epic named in `Ships:` while it still has open sub-issues, and comments
  which ones;
- closes an epic once its last sub-issue closes, unless the epic's own body still has
  unchecked `- [ ]` boxes — then it comments and adds the `ready-to-close` label instead;
- reopens an epic it closed itself when one of its sub-issues is reopened.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.
