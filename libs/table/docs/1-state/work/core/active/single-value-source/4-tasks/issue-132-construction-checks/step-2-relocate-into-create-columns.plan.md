# Step 2 — Move the checks into `createColumns`

**PR scope:** standalone. **Depends on:** none (#131 shipped).
**Parallel-safe with:** Step 1

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/api/create-columns.ts` (edit — calls all
  three checks; receives the metadata-key check)
- `libs/table/src/engine/columns-schema/resolve.ts` (edit —
  both asserts leave; `resolveColumnsConfig` gets smaller)
- `libs/table/src/engine/columns.ts` (edit —
  `assertUniqueColumnIds` exported, `label`, gate moves into
  its body; `resolveColumnDefs` takes `label`)
- `libs/table/src/engine/core.ts` (edit — `:41`, passes
  `'createTable'`)
- `libs/table/src/mutations/update-columns.ts` (edit — `:17`,
  passes `'setColumns'`)
- `libs/table/src/columns-schema/schema.ts` (edit — stale doc
  comments at `:29` and `:47` only)

## Why This Step Exists

Decision N2 (architecture decision 8, spec D14/D15). The rule
check and the metadata-key check run at the declaring call,
which is the earliest point where both the rules and the
declared id list exist. The duplicate-id check is **added**
to `createColumns`. It also stays in `resolveColumnDefs`,
because `setColumns` calls that on the runtime write path.

**Gate placement, settled 2026-09-24 (user, applying R7):**
each check gates **inside its own body**. No call site gates.
That is R7's "one place, not per call site" applied to each
check. `schema/validate.ts` is Step 1's.

## What To Do

### 1. Rule-id check → `createColumns`

Move `assertRuleColumnIdsAreKnown` (`resolve.ts:17-26`) into
`create-columns.ts` as a module-private function, with label
`'createColumns'`. It still calls
`assertDeclarationsAreKnown`, and that call is where the gate
is (Step 1). Don't add a second gate around this call.

### 2. Metadata-key check → `createColumns`

Move `assertMetadataKeysAreUnique` (`resolve.ts:28-50`) in
unchanged, including its comment and its `VISIBLE` exemption.
Then make two changes:

- The gate goes **inside its body**. Use the module-scoped
  `declare const ngDevMode` spelling from `columns.ts:14-17`.
- The message prefix `[columnsSchema]` becomes
  `[createColumns]`. The message must name the offending
  column id, which it already does.

### 3. Duplicate-id check — add it, keep the old call

In `engine/columns.ts`:

- Export `assertUniqueColumnIds(defs, label)`. The message
  prefix comes from `label`, replacing the fixed
  `[createTable]`.
- **The gate moves from the call site (`:51`) into the
  body.** `resolveColumnDefs` then calls it without a gate.
- `resolveColumnDefs(defs, label)` passes `label` through.
  `core.ts:41` passes `'createTable'` and
  `update-columns.ts:17` passes `'setColumns'`.
- Update the `@remarks` on `resolveColumnDefs` (`:44-46`).

In `createColumns`, call `assertUniqueColumnIds(columns,
'createColumns')`.

### 4. Order inside `createColumns`

Build the columns, then resolve the rules, then run the three
checks: duplicate ids, rule ids, metadata keys. Put the
checks in a named helper such as
`assertColumnSetIsWellFormed(columns, rules)` so the main
function reads as a list of steps.

The curried overload has no rules and no checks. Leave it
alone.

### 5. `resolve.ts` gets smaller

Once both asserts leave, `resolveColumnsConfig` only
normalizes the schema and passes the result on. How far to
collapse it (inline it into `resolveColumnsIntake`, or keep
it) is the implementer's call (architecture's open question).
The one rule: `createTable` doesn't re-run these two checks.
A set's rules were already checked when it was declared.

Drop the `VISIBLE` import and the `assertDeclarationsAreKnown`
import if nothing uses them anymore.

## Implementation Notes

- `api/` importing `VISIBLE` from `engine/columns` is a value
  import, so check it doesn't create a cycle. `create-table.ts`
  already imports values from `engine/`.
- The set's `columns` is readonly. Accept
  `readonly ColumnDefInput[]` in `assertUniqueColumnIds`
  instead of spreading at the call site.

## Risks / Watchouts

- **`typecheck-spec` is expected to fail after this step.**
  `schema.spec.ts` and `metadata.spec.ts` call
  `resolveColumnsConfig(columns, schema)`, and that signature
  changes. `create-table.spec.ts:269` builds `badSet` outside
  its `expect`, so it now throws at the wrong place. Step 3
  owns all of these. Don't edit specs here.
- `columns.spec.ts:58` asserts the literal `[createTable]`
  message. It still passes as long as `resolveColumnDefs`
  gets `'createTable'` from that spec's call. If the new
  required parameter breaks that call, Step 3 fixes it.

## Non-Goals

- Changes to `schema/validate.ts` (Step 1).
- Making the duplicate-id check run in production on
  `setColumns` (correctness-pass C6). The issue keeps it
  dev-only.
- Deleting the array intake (#139).

## Acceptance Checks

- [ ] `createColumns` (data-first form) throws on an unknown
      rule id, a duplicated metadata key and a duplicated
      column id. Its messages name `createColumns` and the id.
- [ ] `resolveColumnsConfig`/`resolveColumnsIntake` run
      neither the rule-id nor the metadata-key check.
- [ ] No call site checks `ngDevMode`. The two gates this
      step adds are inside `assertUniqueColumnIds` and
      `assertMetadataKeysAreUnique`.
- [ ] `setColumns` still reaches the duplicate-id check,
      labelled `setColumns`.
- [ ] `nx run shared-table:typecheck` clean, **run twice**.

---
← [Step 1: Split the shared body](step-1-split-shared-body.plan.md) | [Step 3: Construction-check specs](step-3-construction-check-specs.plan.md) →
