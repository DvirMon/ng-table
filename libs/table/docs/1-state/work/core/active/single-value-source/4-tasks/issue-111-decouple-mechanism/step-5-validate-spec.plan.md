# Step 5 — Spec the shared declared-identifier check

**PR scope:** standalone. **Depends on:** Step 4 (the subject under test).
**Parallel-safe with:** Step 2, Step 3.

**Task type:** test

**Skills used:** unit-test

**Scaffolding agent:** test-implementer

## Files

- `libs/table/src/schema/validate.spec.ts` (create)

## Why This Step Exists

The two specs that cover this check today
(`columns-schema/schema.spec.ts:145`,
`engine/columns-schema/wire-columns-schema.spec.ts:414`) reach it through
`createTable()` and assert one regex, with `label` fixed at
`'columnsSchema'`. `label` is new behaviour introduced by Step 4 and is
what #114 / #115 / #100 will each pass a different value for. Nothing
proves it reaches the message.

`assertDeclarationsAreKnown` is a pure function with no signals and no
Angular, so this is plain `vitest` — no `TestBed`, per
`libs/table/CLAUDE.md`'s testing rules.

## What To Do

Create `libs/table/src/schema/validate.spec.ts` covering exactly four
behaviours:

1. **An unknown id throws, and the message names the declaring surface.**
   Call with `declaredIds: ['region']`, `knownIds: ['name', 'status']`,
   `label: 'withGrouping'`. Assert the throw matches
   `/^\[withGrouping\] Unknown column id "region"/`.

2. **The columns caller's message is unchanged.** Same call with
   `label: 'columnsSchema'`, asserting the full string that
   `resolve.ts` produced before Step 4 — this is the regression gate
   protecting the two existing specs' regexes from a future reword.

3. **Every declared id known — no throw.** Declaring a subset, and
   declaring the same id twice, both pass. Duplicate declarations are not
   this function's concern (`assertMetadataKeysAreUnique` owns that).

4. **Empty declarations are a no-op**, including against an empty
   `knownIds`. This is the "no schema supplied" path
   (`resolveColumnsConfig`'s early return never reaches the check, but a
   feature with an empty schema fn will).

Pass plain arrays for `knownIds` in most cases, and a `Set` in one, to
pin the `Iterable<string>` parameter type against a future narrowing to
`string[]`.

## Implementation Notes

- **Why not extend `columns-schema/schema.spec.ts` instead.** That file
  asserts the columns schema's behaviour through `columnSchema()`. A
  `label` other than `'columnsSchema'` has no meaning there, and asserting
  it would make that spec carry another module's contract —
  `.claude/rules/spec-files-assert-own-domain-only.md`.
- **The first-unknown-wins ordering is not asserted.** The function throws
  on the first miss and the order of `declaredIds` is the caller's; pinning
  it would freeze an implementation detail no caller depends on.

## Risks / Watchouts

- Do not import anything from `engine/` or `columns-schema/` into this
  spec. `schema/validate.ts` has no dependencies, and the spec should
  demonstrate that.
- `*.spec.ts` is excluded from `tsconfig.lib.json` — verify with
  `nx run shared-table:typecheck-spec`, not the lib target.

## Non-Goals

- No `*.types.spec.ts`. The signature carries no inference worth a
  compile-time assertion; the literal-union guard the epic needs is
  [#113](https://github.com/DvirMon/ng-table/issues/113)'s.
- No new coverage for `runRecordedSchema`. Its behaviour is already
  asserted nine times through `runGroupingSchemaFn` in
  `with-grouping/schema.spec.ts`, including the closed-session throw.
- No edits to any existing spec.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck-spec` clean.
- [ ] `nx test shared-table` passes, with the four cases above present and
      no existing spec modified (AC #8).

---
← [Step 4: Shared identifier check](step-4-shared-identifier-check.plan.md) | [Step 6: Document the two new files](step-6-doc-new-files.plan.md) →
