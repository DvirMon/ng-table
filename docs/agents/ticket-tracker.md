# Ticket tracker: GitHub

Intake items for this repo live as GitHub issues. `/to-intake` creates items, `/to-ticket`
fetches them, `grill-with-docs` posts comments. Use the `gh` CLI; it infers the repo from
`git remote -v` (pass `--repo <owner>/<repo>` to override).

The issue body's `## Pipeline` block is the one body section stages update — see
`to-issues/references/pipeline-block.md`. Nothing else in the body is edited.

## Fetch

`gh issue view <number> --comments`, also fetching labels.

## Create an intake item

`gh issue create --title "..." --body "..."` (heredoc for multi-line bodies), using the template
`/to-intake` provides.

Labels `kind:epic` + `needs:triage`. No parent: with `prUnit: sub-issue` the item is itself the
epic, and `/to-issues` later attaches its sub-issues to it.

Return the issue number and URL.

## Post a comment

`gh issue comment <number> --body "..."`.
