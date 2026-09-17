# Step 4: Update `with-expansion.md`

## PR scope

Bring the spec doc in sync with what actually shipped.

## Task type

docs

## Depends on: Step 1

## Files

- `libs/shared/design-system/src/ui/table/docs/1-state/features/expansion.md` (edit)

## Why This Step Exists

Repo convention: specs stay authoritative after implementation, same as `docs/2-columns/architecture.md`
recorded its decisions inline as they were resolved. Two decisions made during `/to-tasks` (see
`../2-decisions.md`) aren't reflected in the spec yet.

## What To Do

- Frontmatter `status: drafted` → `status: shipped`.
- Add `childrenAccessor` to the Methods/config surface — the doc currently implies bare
  `Row.children` access with no accessor; document the actual config field and its default.
- Remove the `manual` Contract section (or replace with a one-line note: "No `manual` config —
  see `decisions.md`, no computation exists for it to skip").
- Resolve/update the Open Questions list: strike the lazy-load-state item only if it's still
  genuinely unaddressed (it is — leave it); the `rowExpanded` vs `rowExpanded`/`rowCollapsed`
  question is now settled by what shipped (single event) — mark resolved.

## Implementation Notes

Keep this factual and short — record what shipped, don't re-litigate.

## Risks / Watchouts

None.

## Non-Goals

Rewriting the whole doc — targeted edits only.

## Acceptance Checks

- [ ] Doc accurately describes the shipped API (no drift between doc and `with-expansion.ts`)
- [ ] Open Questions reflect current state

---
← [Step 3: with-expansion.spec.ts](step-3-with-expansion-tests.plan.md)
