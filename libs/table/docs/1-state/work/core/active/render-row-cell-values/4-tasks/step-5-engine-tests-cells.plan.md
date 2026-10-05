# Step 5 — Engine tests: cells, the accessor wrap, duplicate ids

**PR scope:** Unit coverage for Steps 2 and 3. No source changes.
**Depends on:** Step 2 (the throw exists), Step 3 (the field and the builder exist).
**Parallel-safe with:** Step 6, Step 7, Step 8.
**Task type:** `test`
**Skills used:** `unit-test`
**Scaffolding agent:** `test-implementer`

## Files

| File                                    | Action                                   |
| --------------------------------------- | ---------------------------------------- |
| `libs/table/src/engine/cells.spec.ts`   | create                                   |
| `libs/table/src/engine/columns.spec.ts` | edit — duplicate-id cases                |
| `libs/table/src/engine/core.spec.ts`    | edit — `cells` stamped on both row kinds |

## Why This Step Exists

Three behaviors here fail silently if they regress, which is exactly the class that needs a test
rather than a review:

- the `reportedColumns` dedup is once-per-column-per-**evaluation**; moving the `Set` one line
  inwards degrades it to once-per-row with no visible symptom;
- a throwing `accessor` degrading the _whole row_ instead of one cell looks identical in a story;
- the duplicate-id throw is `ngDevMode`-guarded, so a wrong guard polarity means it never fires
  and nothing complains.

## What To Do

Follow the `unit-test` skill's selection policy — assert behavior, not shape. Each file is bare
`vitest`; `engine/` is pure, so no `TestBed` anywhere in this step. If a case here needs
`TestBed`, the logic landed in the wrong file.

### `engine/cells.spec.ts` (new)

`readAccessor`:

- returns the accessor's value for a well-behaved column;
- returns `undefined` when the accessor throws, and does not rethrow;
- reports once when the same column throws for many rows sharing one `reportedColumns` set, and
  once _per column_ when two columns throw;
- reports again when given a fresh set — the dedup is scoped to the set, not to the column.

`buildDataCells`:

- keys by `column.id` for every column passed, including `visible: false` ones;
- one throwing column leaves every other column's value intact in the same row.

`buildGroupCells`:

- copies `aggregates`, and returns `{}` for `undefined`;
- returns a new object rather than the `aggregates` reference — `cells` and `aggregates` must not
  alias, so a consumer mutating one cannot reach the other.

Spy on `console.error` with `vi.spyOn`, restored per test.

### `engine/columns.spec.ts` (edit)

- `resolveColumnDefs` throws on two columns sharing an id, with the exact D10 message;
- it does **not** throw for two distinct ids sharing the same `accessor` function reference;
- it does not throw for a list with no duplicates — the existing resolution cases still pass.

The throw is behind `typeof ngDevMode === 'undefined' || ngDevMode`. Under `vitest` the symbol is
absent, so the check runs by default and the specs need no setup. Add one case that sets
`globalThis.ngDevMode = false`, asserts the duplicate resolves last-wins without throwing, and
restores the previous value in a `finally` — that is the production path, and it is the half a
green suite would otherwise never touch.

### `engine/core.spec.ts` (edit)

Against a real `createTableCore`:

- every `kind: 'row'` render row carries a `cells` entry per column in `columns()`, equal to that
  column's `accessor` output, including for a hidden column;
- `cells` recomputes when `data` changes and when `columns` changes — a visibility toggle or a
  `setColumns` must be reflected, since `renderRows` now depends on `columns()`;
- a column whose `accessor` throws yields `undefined` in that one cell while its siblings resolve,
  and logs **once** across a multi-row table.

For the group-row half, drive it through a composed table with `withGrouping()` so real
`kind: 'group'` rows exist:

- a group header's `cells` deep-equals its `aggregates`;
- a column with no `aggregateFn` is absent from a group header's `cells` (reading `undefined`),
  matching what `row.aggregates?.[id]` returned before;
- a group header carries no `cells` entry keyed by `groupKey.columnId` unless a column of that id
  has an `aggregateFn` — the D5 amendment, and the one that would silently regress if someone
  "helpfully" merged the group value back in.

## Implementation Notes

Reuse `table.mock.ts` fixtures rather than inlining row data — `MockRow` and the render-row
factories are already the shared shape, and `mockDataRenderRow`/`mockGroupRenderRow` now default
`cells` to `{}`.

Prefer one assertion per behavior over a single deep-equal on a whole `RenderRow`: a snapshot of
the row object couples every cells test to unrelated fields (`parentId`, `sourceIndex`) and will
fail for the wrong reason when a future feature adds one.

The dedup tests are the point of this step. Assert the **call count** on the `console.error` spy,
not merely that it was called.

## Risks / Watchouts

- **Do not edit an existing passing test to accommodate the change.** Steps 2 and 3 are additive;
  if an existing `columns`/`core`/`render-stages` expectation now fails, that is a regression in
  the source step, not a test to update.
- **No structural or DOM tests.** `CLAUDE.md` puts those in directive specs; nothing here renders.
- **Restore `globalThis.ngDevMode` in a `finally`.** Leaking `false` into later tests in the same
  file silently disables the throw for all of them.
- **`vi.restoreAllMocks()` between tests**, or a leaked `console.error` spy makes a later dedup
  count wrong in a way that looks like a source bug.

## Non-Goals

- No coverage for the D11 grouping report — Step 6.
- No story or template assertions — Step 8 is a migration, and its correctness is carried by the
  engine tests here plus a typecheck.
- No `*.types.spec.ts` compile-time assertions. `cells` being required is enforced by the ordinary
  build: every `RenderRow` literal in `src/` must supply it or `typecheck` fails.

## Acceptance Checks

- [ ] `engine/cells.spec.ts` exists and covers `readAccessor`, `buildDataCells`, `buildGroupCells`.
- [ ] A dedup test asserts an exact `console.error` call count for one throwing column across many
      rows, and for two throwing columns.
- [ ] `buildGroupCells` is asserted not to return the `aggregates` reference itself.
- [ ] `columns.spec.ts` covers: duplicate throws with the exact message; same `accessor` different
      ids does not throw; `ngDevMode = false` resolves last-wins without throwing, restored after.
- [ ] `core.spec.ts` covers: cells on data rows including hidden columns; recompute on a `columns`
      change; per-cell degradation with a single report; group-row cells equal to aggregates; no
      `groupKey.columnId` entry without a matching `aggregateFn`.
- [ ] No `TestBed` in `engine/cells.spec.ts` or `engine/columns.spec.ts`.
- [ ] No previously-passing test was edited to make this step pass.
- [ ] `nx run shared-table:typecheck-spec` clean.

---

← [Step 4: Non-primitive group value reports](step-4-non-primitive-group-value-report.plan.md) | [Step 6: Grouping report test](step-6-grouping-report-test.plan.md) →
