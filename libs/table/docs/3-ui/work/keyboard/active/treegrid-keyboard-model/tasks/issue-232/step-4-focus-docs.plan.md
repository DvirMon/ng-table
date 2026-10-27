---
step: 4
type: docs
commit: docs
depends_on: [1]
files:
  - libs/table/CONTEXT.md
  - libs/table/docs/adr/0007-feature-member-claims.md
  - libs/table/docs/3-ui/work/keyboard/active/treegrid-keyboard-model/3-architecture.md
  - libs/table/docs/3-ui/work/keyboard/active/treegrid-keyboard-model/2-spec.md
---

# Step 4 — Focus glossary, ADR and workspace docs

Brings the glossary, ADR-0007 and the workspace docs in line with the `focus` member and its request counter.
Directive docs are left to later slices.

Decisions: K15, K16

## Do

`CONTEXT.md`: in the "Focused position" entry, name `FocusTarget` as the type that holds it (header, body or panel).

`ADR-0007`: add `focus` to the list of engine-claimed core members (around line 95).

`3-architecture.md`:

- Replace the "one-shot flag … open question 1" paragraph after § Types with the counter. `focusRequests` goes up by 1 per accepted `focusElement: true` write, and `ngpTable`'s sync effect reads it.
- Add `focusRequests` to the `TableFocus` snippet.
- Mark open question 1 resolved, with a link to K15.

`2-spec.md` § Store contract: add a `table.focus.focusRequests()` line with one sentence.

## Watch out

None.

## Out of scope

- Directive docs (`core.md`, `tree.md`, …). Later slices own them.

## Done when

- The four files are updated.
- `npm run llms:check` is clean (the user runs it).
