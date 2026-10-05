---
title: 'Step 7 — selectAllIds() unit tests'
type: task-step
issue: 64
---

# Step 7 — `selectAllIds()` unit tests

**PR scope:** Depends on Step 6 (`selection.utils.ts`).

**Task type:** test

**Skills used:** unit-test

**Scaffolding agent:** test-implementer

## Files

- `libs/shared/table/src/api/features/selection.utils.spec.ts` (new)

## Why This Step Exists

The issue's acceptance criteria names four coverage cases explicitly. This step is that
coverage — no new design decisions, just verifying Step 6's implementation against D59.

## What To Do

Use `createTable()` + `withFiltering()` (pattern in `with-filtering.spec.ts`) so `rows()` and
`value()` genuinely diverge, rather than constructing a fake `Pick<TableStore, ...>` object by
hand — exercises the real pipeline, not a stub. Reuse `mockRows`/`mockTrackBy` from
`../../table.mock` for fixtures, per this library's mock-data convention.

Cases:

1. **Default scope (`opts` omitted)** — with a filter applied so `rows()` is a strict subset of
   `value()`, `selectAllIds(table)` returns exactly `table.rows()`'s ids (order matches
   `rows()`, not `value()`).
2. **`includeHidden: true`** — same filtered table; `selectAllIds(table, { includeHidden: true
})` returns exactly `table.value()`'s ids (every row, filtered or not).
3. **Combines with pre-existing selection** — call `table.select(selectAllIds(table))` twice, or
   once after an existing `table.select([someId])`; assert the result relies on `select()`'s own
   D15 dedup (no duplicate ids in `selectedRows()`) rather than re-implementing dedup in the
   helper itself. Compose `withSelection()` alongside `withFiltering()` for this case only.
4. **Empty row set** — `data` signal seeded with `[]`; both default and `includeHidden: true`
   calls return `[]`, not throw.

## Implementation Notes

- Follow `with-filtering.spec.ts`'s `createTable` harness shape (`TestBed.runInInjectionContext`)
  for building the table under test.
- Case 3 is the only one needing `withSelection()` composed — cases 1/2/4 need only
  `withFiltering()` (or no feature at all, for case 4) since `selectAllIds()` itself never reads
  `SelectionMembers`.

## Risks / Watchouts

- Don't assert against a hand-built fake store object for the divergence cases (1/2) — a real
  `createTable()` + `withFiltering()` composition is what actually proves `rows()` vs `value()`
  diverge; a fake risks encoding the assumption rather than testing it.
- Don't re-test `select()`'s D15 dedup logic itself here — case 3 only asserts that
  `selectAllIds()`'s output composes correctly with it, not that dedup itself works (that's
  `with-selection.spec.ts`'s job).

## Non-Goals

- No structural/DOM tests — this is a pure state-layer helper (`.claude/rules` /
  `libs/shared/table/CLAUDE.md` Testing section: no content/structural tests here).
- Not testing `withFiltering()` or `withSelection()` themselves — only `selectAllIds()`'s
  behavior when composed with them.

## Acceptance Checks

- [ ] Default scope selects exactly `table.rows()`'s ids.
- [ ] `includeHidden: true` selects exactly `table.value()`'s ids.
- [ ] Combines correctly with pre-existing selection (relies on `select()`'s own D15 dedup).
- [ ] Works against an empty row set.
- [ ] All four cases pass under the project's existing test runner config (no new config).

---

← [Step 6: selectAllIds() helper (D59)](step-6-select-all-ids-helper.plan.md) | [Step 8: selection.md — selectAllIds() shipped](step-8-select-all-ids-doc-update.plan.md) →
