# Step 1 test plan — Focus member: read and write

Step: [step-1-focus-member.plan.md](step-1-focus-member.plan.md)
Spec file: `libs/table/src/api/create-table.spec.ts` — new `describe('focus', …)` block. Uses the file's existing `makeStore(columns, data)` helper and local `Row`. Seed two rows, ids `'r1'` and `'r2'`. Column ids `'name'` / `'status'`.

## Stubs (red phase)

- `api/types.ts`: `FocusTarget<TCol>`, `FocusMoveOptions`, `TableFocus<TCol>` exactly as in architecture § Types, plus `readonly focus: TableFocus<ColumnIdIn<TValues>>` on `TableStore`. Types only.
- `engine/slots.ts`: add `'focus'` to `CORE_MEMBER_KEYS`.
- `engine/compose-table.ts` `createBaseStore`: `focus: Object.assign((): FocusTarget | null => { throw new Error('not implemented: focus'); }, { moveTo: (_t: FocusTarget, _o?: FocusMoveOptions): void => { throw new Error('not implemented: focus.moveTo'); } })`. In green it becomes `Object.assign(computed(read), { moveTo })`.

## Seams — in red-green order

### A. Fresh table → `focus()` is `null`

- Test: `it('is null until a target is written')`
- Asserts: `expect(makeStore(makeColumns(), rows).focus()).toBeNull()`
- Why this seam: catches a backing signal seeded with the wrong value (`undefined`, or a K3 first-entry default computed into the store). K3 belongs to the directive layer; recovery treats `null` as "no position".
- Order reason: independent. Base case.

### B. Sequential `moveTo` across all four target shapes → `focus()` returns the last one written

- Test: `it('returns the last target written by moveTo, for header, body row, body cell and panel')`
- Asserts: `moveTo` once per target, in order: `{ area: 'header', columnId: 'name' }`, `{ area: 'body', rowId: 'r1', columnId: null }`, `{ area: 'body', rowId: 'r2', columnId: 'status' }`, `{ area: 'panel', rowId: 'r1' }`. After each, `expect(table.focus()).toEqual(<that target>)`.
- Why this seam: catches `moveTo` not writing, a first-write-wins guard, and an area branch dropping `columnId: null` or the panel shape. Step 1 has no per-area logic, so the four shapes are one seam.
- Order reason: builds on A.

### C. A `computed` over `table.focus()` re-derives after `moveTo`

- Test: `it('is reactive: a computed reading focus() updates after moveTo')`
- Asserts: `const area = computed(() => table.focus()?.area ?? 'none')`; reads `'none'`; after `moveTo({ area: 'header', columnId: 'name' })`, `expect(area()).toBe('header')`.
- Why this seam: B passes against a plain closure variable behind a function, which a computed would cache forever. Recovery, `tabindex` computeds and the directive sync effect all need a tracked signal read.
- Order reason: builds on B.

### D. Two `createTable()` calls → independent focus state

- Test: `it('gives each table its own focus position')`
- Asserts: two `makeStore(...)` instances; `moveTo` on the first only; `expect(second.focus()).toBeNull()`.
- Why this seam: catches a backing signal at module scope or a shared singleton. Matches the existing `'gives each createTable() call independent state'` prior art.
- Order reason: builds on B.

## Types phase (after green)

In `libs/table/src/api/create-table.types.spec.ts`, new `describe('focus — column-id carriage')`, using its unannotated `makeColumns()` and `typecheckOnly`:

- `expectTypeOf(table.focus).toEqualTypeOf<TableFocus<'name' | 'status'>>()` — pins `TCol` narrowing.
- `// @ts-expect-error` on `table.focus.moveTo({ area: 'header', columnId: 'statuss' })`, with the call re-asserted beside it per that file's case-2 convention.
- With `makeWidenedColumns()`: `expectTypeOf(table.focus).toEqualTypeOf<TableFocus<string>>()` — pins the known widening, matching case 3.
  In `libs/table/src/api/types.types.spec.ts`:
- `// @ts-expect-error` on `FocusTarget<'a'>` = `{ area: 'header', columnId: null }` — only the body arm allows `null`.
- `// @ts-expect-error` on `{ area: 'panel', rowId: 'r1', columnId: 'a' }` — the panel arm carries no column.

## Not tested

- Feature declaring `focus` throws (ADR-0007): already covered by `it.each(CORE_MEMBER_KEYS)` in `engine/compose-table.spec.ts` and `engine/slots.spec.ts`; adding the key extends both.
- `focusElement`: step 3 owns it.
- Unknown row/column id: step 2 owns it.
- Recovery after data/filter/sort/column changes: #233.
- `src/index.ts` exports: pure re-exports; typecheck catches a missing one where consumed.
- DOM focus, `tabindex`, roles: seam S2, later slices.

## Resolved during review

- Panel target without `withExpansion()`: B keeps the panel write. Step 2 checks only rendered ids, not whether a panel is open, so B's fixture is unaffected.
