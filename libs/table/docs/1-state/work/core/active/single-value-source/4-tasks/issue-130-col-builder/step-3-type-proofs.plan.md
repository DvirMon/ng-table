# Step 3 — Type proofs: `create-columns.types.spec.ts`

**PR scope:** standalone. **Depends on:** Step 1.
**Parallel-safe with:** Step 2.

**Task type:** test

**Skills used:** unit-test

**Scaffolding agent:** test-implementer

## Files

- `libs/table/src/api/create-columns.types.spec.ts` (edit —
  add a new `describe` block; leave the existing curried
  cases alone)

## Why This Step Exists

Every promise #130 makes is compile-time: the brand, the
rejected options, the value map, the literal capture. None of
it has a runtime witness, and each can fail **silently** — a
dead capture still compiles and types every id as `string`.

It also settles four open questions by probe
(`3-architecture.md` § Open questions 1, 2, 3, 6). Step 4
records the answers.

**Ownership:** derivation belongs to this file; carriage
through `createTable` belongs to `create-table.types.spec.ts`
and arrives with #131/#138. The existing curried cases stay —
#138 rewrites the file against the new call.

## What To Do

Follow the file's existing conventions: the
`typecheckOnly(assertions)` wrapper that never calls its
argument, a locally-declared row interface with one
object-valued field, `toEqualTypeOf` (never `toMatchTypeOf`
— the failure mode is a type being _wider_), and the doc
comment stating `typecheck-spec` is what enforces the file.

Reuse the file's `DealRow` if it has an object-valued field;
otherwise add one locally. Data witness: a local
`declare const deals: () => readonly DealRow[] | undefined`.

### Cases

1. **Literal ids survive a module-level const.** Hoist
   `const dealColumns = createColumns(deals, (col) => [...])`
   to module scope — deliberately — and assert
   `ColumnIdIn<ColumnValues<DealRow, typeof dealColumns.columns>>`
   is the literal union, **not** `string`. Load-bearing: if
   this fails, every case below is asserting a fallback.
2. **Accessor arm.** `col('owner', { accessor: (r) => r.owner.name })`
   maps to `string`, not the `owner` object. Also: `r` needs
   no annotation.
3. **Field arm.** `col('amount')` maps to `number`.
4. **Unknown arm.** `col('carrier')` (no such field, no
   accessor) maps to `unknown`, not an error.
5. **Whole map.** One `toEqualTypeOf` on the full map, so an
   extra or missing key fails.
6. **Brand rejects a hand-written literal.**
   `(col) => [col('amount'), { id: 'x' }]` —
   `@ts-expect-error`.
7. **Options.** `col('x', { meta: {} })` and
   `col('x', { order: 1 })` — each `@ts-expect-error`.
   `col('x')` with no options is legal.
8. **Schema paths.** Inside the third argument, `path.amount`
   is accepted; `path.amont` is `@ts-expect-error`.
9. **Empty list.** `createColumns(deals, () => [])` — any
   `path.x` in its schema is `@ts-expect-error`.
10. **Witness.** A callable yielding `undefined` before load
    is accepted; a `WritableSignal<DealRow[]>` is accepted.
11. **Row carrier (open Q3).** Recover `TRow` off
    `typeof dealColumns` with an `infer` against
    `ColumnSet<infer R, any>` and assert it is `DealRow`. If
    it comes back `unknown`, Step 1 reopens to add the
    phantom — do not soften.
12. **Brand leak (open Q6).** `keyof` of the value map is the
    id union only — no symbol key.
13. **`col.from` captures the new id (open Q1).**
    `col.from(amountDecl, { id: 'total' })` — assert the
    result's `id` type is `'total'`, and what `from` without
    `id` yields. **Record the result either way**; do not
    change `ColumnBuilder` to force a pass.
14. **Spread widens (open Q2).** `{ ...col('amount'), id: 'total' }`
    placed in the array — assert what its `id` type actually
    is (`string` expected). Pin the observed type with
    `toEqualTypeOf`, whichever it is, and comment that it
    pins behavior rather than endorsing it.

## Implementation Notes

- **Pair every `@ts-expect-error` with a positive
  assertion** on the surrounding expression — the directive
  is satisfied by _any_ error on the next line.
- Cases 13 and 14 are probes: the assertion pins what TS
  does. Report the observed types in the step's hand-off so
  Step 4 can record them.
- Comment on case 1 why it is hoisted: an inline literal
  proves only what was never in doubt.

## Risks / Watchouts

- `*.spec.ts` is excluded from `tsconfig.lib.json`; only
  `typecheck-spec` sees this file. A green `nx test` proves
  nothing about it.
- If case 2 resolves to the `owner` object, Step 1's leading
  `ColumnDecl` arm is missing — reopen Step 1, don't adjust
  the assertion.

## Non-Goals

- No `createTable` call — carriage is #131/#138's, in the
  table's own type spec.
- No rewrite of the existing curried cases (#138).
- No runtime assertions (Step 2).

## Acceptance Checks

- [ ] All fourteen cases present, in a new `describe` block.
- [ ] `nx run shared-table:typecheck-spec` clean.
- [ ] `nx run shared-table:typecheck` clean, **run twice**.
- [ ] Hand-off states the observed types for cases 11–14.

---

← [Step 2: Runtime spec](step-2-runtime-spec.plan.md) | [Step 4: Record the probe answers](step-4-record-probe-answers.plan.md) →
