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

## Issue references

Every change reaches `main` through a PR, rebase-merged — no direct pushes, no merge
commits. Issues close when that PR merges.

- **Commits** carry a `Refs: #N` trailer (`Refs: none` when there is no issue; an
  optional `Epic: #M`). Never a closing keyword (`close[sd]`, `fix(e[sd])`,
  `resolve[sd]`) and never the retired `Ships:` trailer.
- **Headers** are emoji conventional: `<emoji> [#<issue> <stage>] <type>(<scope>): <subject>`
  — types and emoji in the `atomic-commit` skill. Refactors use `ref` (`refactor` is still
  accepted while the skills catch up).
- **Story tag** `[#<issue> <stage>]` says where the commit sits in its issue's story, so one
  PR's commits read as a sequence in `git log --oneline` even when interleaved with other
  work. Stage: `s<N>` for step N of the plan (`4-tasks/issue-<N>/step-<N>-*.plan.md`),
  `plan` for the task and test plans, `review` for changes answering review. The tag's issue
  must also be in `Refs:`. Optional — omit it for `Refs: none` work and for commits that fit
  no stage.

  ```
  📚 [#166 plan] docs(table/tree): plan the stage context and parent-link slot
  ✨ [#166 s1] ref(table/tree): stage context through both runners
  🎸 [#166 s2] feat(table/tree): add a parentLink slot, claimed once
  ✨ [#166 review] ref(table/tree): name ParentLink, simplify its slot claim
  ```

- **Scope** is `<project>[/<domain>]` — project e.g. `table`, `root`, `deps`. The domain is the
  one the work **belongs to**, not every folder the diff touches: the folder under
  `libs/table/docs/1-state/work/<domain>/` holding the issue's workspace (e.g.
  `📚 docs(table/tree): record tree-flat-data decisions`, even when that commit also
  edits `filtering.md`). No single owning domain → project only (`table`). Never a list.
- **PR body** carries the closing reference: `Closes #N` for an issue the PR completes,
  `Refs #N` for one it only partly delivers. Planning PRs (`docs/<slug>`) use
  `Refs #<epic>` and close nothing.
- **Branches**: `<type>/<issue#>-<slug>`, or `docs/<slug>` / `chore/<slug>` —
  `tools/validate-branch-name.mjs`.

Enforced by `tools/commit-trailers.cjs` in three places: the `.githooks/` hooks (enabled by
`npm install` via the `prepare` script — `commit-msg`, plus `pre-commit`/`pre-push`
rejecting `main`), and `.github/workflows/pr-conventions.yml` on every PR, which cannot be
skipped with `--no-verify`.

**Check command: `node tools/check-commit-trailers.cjs --range <base>..<head>`**
(`--title "<PR title>"` for a title). Exits non-zero with one line per problem.

### Epics

An epic is any issue with native GitHub sub-issues. When its last sub-issue closes,
`.github/workflows/issue-flow.yml` opens an auto-merge PR that archives the epic's workspace
and carries `Closes #<epic>`. The same workflow comments `Unblocked → /to-tasks #M` on
issues whose last blocker closed.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.
