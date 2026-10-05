# Step 3 — Construction-check specs

**PR scope:** standalone. **Depends on:** Step 1, Step 2.
**Parallel-safe with:** Step 4

**Task type:** test

**Skills used:** unit-test

**Scaffolding agent:** test-implementer

## Files

- `libs/table/src/api/create-columns.spec.ts` (edit — new
  `describe('construction checks')`)
- `libs/table/src/engine/columns.spec.ts` (edit — label
  parameter, write-path case)
- `libs/table/src/columns-schema/schema.spec.ts` (edit —
  `:132-145`)
- `libs/table/src/columns-schema/metadata.spec.ts` (edit —
  `:91-125`)
- `libs/table/src/api/create-table.spec.ts` (edit —
  `:261-275`)
- `libs/table/src/engine/columns-schema/wire-columns-schema.spec.ts`
  (edit — `:295`, `:407-421`, `:478-492`)
- `libs/table/src/api/features/with-sorting.spec.ts` (edit —
  `:513-525`)

## Why This Step Exists

This is spec seam 1 in Testing Decisions: the three checks,
one case each. It also brings back `typecheck-spec`, which
Step 2 left failing.

What the tests assert is observable behavior: the declaring
call throws, and the message names the offending id and
the declaring surface. They must not assert that a
particular internal function ran.

## What To Do

### 1. `create-columns.spec.ts` — one case per check

In a new `describe('construction checks')` block:

- **Unknown rule id.** A schema whose rule names an
  undeclared id. Use `columnSchema<Row, 'amount' | 'bogus'>`,
  the wider-`TId` trick from `create-table.spec.ts:261-267`.
  Assert the throw matches `[createColumns]` and `"bogus"`.
- **Duplicated metadata key.** `metadata(path.amount, KEY, …)`
  twice. Assert `[createColumns]` and `"amount"`.
- **Duplicated column id.** `[col('name'), col('name')]`.
  Assert `[createColumns]` and `"name"`.
- **`VISIBLE` exemption.** Two `visible()` rules on one column
  do not throw.
- **Stripped in production.** One case with
  `ngDevMode = false`: all three bad declarations return a
  set without throwing. Restore the flag in a `finally`,
  using the helper at `columns.spec.ts:14-23`. If a second
  file needs that helper, move it into a shared test helper
  rather than copying it.

### 2. The write path still throws

In `columns.spec.ts`, update the existing duplicate-id cases
(`:50-90`) for `resolveColumnDefs`' `label` parameter. Add
or adjust one case showing that `setColumns` with two
equal ids throws, labelled `setColumns`. That one case
covers "still throws from the runtime write path". The
existing `ngDevMode = false` last-wins case stays.

### 3. Move or delete the stale cases

For each case, ask which module has to change to break it
(`spec-files-assert-own-domain-only`):

| Case                                                                   | Now owned by                 | Action                                                                                                   |
| ---------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| `schema.spec.ts:132-145` (unknown id via `resolveColumnsConfig`)       | `createColumns`              | Delete. §1 covers it                                                                                     |
| `metadata.spec.ts:91-101` (duplicate key via `resolveColumnsConfig`)   | `createColumns`              | Delete. §1 covers it                                                                                     |
| `metadata.spec.ts:103-125` (non-throwing `resolveColumnsConfig` cases) | whatever `resolve.ts` became | Rewrite against the new signature, or delete if Step 2 made them trivial                                 |
| `schema.spec.ts:104-127` (non-throwing `resolveColumnsConfig` cases)   | same                         | same                                                                                                     |
| `create-table.spec.ts:261-275` (`badSet` built outside `expect`)       | `createColumns`              | Delete. Its comment's premise ("only `resolveColumnsConfig` checks") is now false                        |
| `wire-columns-schema.spec.ts:407-421`, `:478-492`                      | `createColumns`              | Delete. Fix the `:295` comment that names `resolve.ts`                                                   |
| `with-sorting.spec.ts:513-525` (`sortNulls` twice)                     | `createColumns`              | Delete, or keep as a sorting-side smoke test only if it asserts something sorting owns. It doesn't today |

## Implementation Notes

- The spec runner doesn't define `ngDevMode`, so every
  case except the stripped one runs the checks by default.
- `columnSchema()` erases `TId`, which is how an unknown id
  gets past the types. `createColumns`' inline-fn form
  would reject it at compile time.

## Risks / Watchouts

- Deleting a case is correct only if §1 has a case for the
  same behavior. Check each deletion against §1 before
  removing it.

## Non-Goals

- Grouping's G76 cases and `validate.spec.ts` (Step 4).
- Rewriting `create-columns.types.spec.ts`.

## Acceptance Checks

- [ ] Each check has one throw case in
      `create-columns.spec.ts`, asserting the message's
      surface and id.
- [ ] One `ngDevMode = false` case shows all three checks
      skipped, with the flag restored afterwards.
- [ ] A duplicate id passed to `setColumns` still throws.
- [ ] No spec calls `resolveColumnsConfig` expecting a
      rule-id or metadata throw.
- [ ] `nx run shared-table:typecheck-spec` clean.
- [ ] The touched spec files pass (test-implementer runs
      only those).

---

← [Step 2: Move the checks into `createColumns`](step-2-relocate-into-create-columns.plan.md) | [Step 4: G76 split specs](step-4-g76-split-specs.plan.md) →
