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

Parent epic, per `intake.epic` (unset → ask). The epic is an issue labelled `kind:epic`; the
item becomes its **sub-issue**:

- **link** — add the item to the existing epic (below).
- **create** — `gh issue create --label kind:epic ...` for the epic first, then link.
- **none** — no parent.

**Link a sub-issue to an epic:**

    gh api --method POST repos/<owner>/<repo>/issues/<epic>/sub_issues \
      -F sub_issue_id=<item-db-id>

`<item-db-id>` is the item's numeric **database id**
(`gh api repos/<owner>/<repo>/issues/<n> --jq .id`), not its `#number`. The sub-issue must belong
to the same repository owner as the epic. Source:
`https://docs.github.com/en/rest/issues/sub-issues#add-sub-issue`.

Return the issue number and URL.

## Post a comment

`gh issue comment <number> --body "..."`.
