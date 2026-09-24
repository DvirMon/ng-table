# Step 1 — Declaration types and the data-first builder

**PR scope:** standalone. **Depends on:** none.

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/api/types.ts` (edit)
- `libs/table/src/api/create-columns.ts` (edit)
- `libs/table/src/index.ts` (edit)

## Why This Step Exists

#130 mints the declaration surface and wires it to nothing.
`createTable` keeps taking the old array until #131, so this
step must leave every existing call site — including the two
callers of the curried `createColumns<TRow>()` — compiling
untouched.

**Data first is the only call form** (`decisions.md` R9,
2026-09-24). The builder-first form was dropped: at runtime
`(data, build)` and `(build, schemaFn)` are both `(fn, fn)`,
and `data` may never be invoked, so the two could not be told
apart without a heuristic or a runtime brand. This amends
spec D1 and the design brief's P5b–P5d rows.

## What To Do

### 1. Types — `api/types.ts`

Author, per `3-architecture.md` § "New types to author":

```ts
declare const COLUMN_DECL: unique symbol;

export interface ColumnDecl<TRow, K extends string, V> {
  readonly [COLUMN_DECL]: true;          // required — D7
  readonly id: K;
  readonly label?: string;
  readonly visible?: boolean;
  readonly accessor?: (row: TRow) => V;
}

export interface Presentation {
  readonly label?: string;
  readonly visible?: boolean;
}

export interface ColumnBuilder<TRow> {
  <K extends string, V>(
    id: K,
    opts: Presentation & { accessor: (row: TRow) => V },
  ): ColumnDecl<TRow, K, V>;
  <K extends string>(
    id: K,
    opts?: Presentation,
  ): ColumnDecl<TRow, K, K extends keyof TRow ? TRow[K] : unknown>;
  from<K extends string, V>(
    decl: ColumnDecl<TRow, string, unknown>,
    opts: Presentation & { id?: K; accessor?: (row: TRow) => V },
  ): ColumnDecl<TRow, K, V>;
}

export interface ColumnSet<
  TRow,
  TCols extends readonly ColumnDecl<TRow, string, unknown>[],
> {
  readonly columns: TCols;
  readonly rules: readonly ColumnRule<TRow>[];
}
```

- **No row carrier on `ColumnSet`.** `rules` already mentions
  `TRow`; Step 3 proves it is recoverable. Add a phantom only
  if that proof fails — simplest signature first.
- **`ColumnValues` gains a leading `ColumnDecl` arm**, read
  off the declaration's own `V`:
  `C extends ColumnDecl<any, string, infer V> ? V : <existing arms>`.
  Required, not cosmetic: `ColumnDecl.accessor` is
  *optional*, so the existing
  `C extends { accessor: (row: any) => infer V }` arm does
  not match it, and a `col('owner', { accessor })` would fall
  to `TRow['owner']` — the exact lie ADR-0024 closes. The arm
  is additive; `ColumnDefInput` elements keep resolving
  through the old arms, so `createTable` is untouched. Verify
  `ColumnDecl` is assignable to `ColumnValues`'s current
  element constraint; widen the constraint to a union only if
  it is not.
- Align with the shipped vocabulary (`ColumnValues`,
  `ColumnIdIn`). Do not introduce the brief's placeholder
  names `AnyDecl` / `ValuesOf`.
- `ColumnRule` comes from `columns-schema/types.ts` —
  `import type`, respecting the `api/types.ts` ↔
  `engine/types.ts` type-only cycle rule.

### 2. Factory — `api/create-columns.ts`

Two overloads, one implementation:

```ts
// existing — kept until #138 rewrites its two callers
export function createColumns<TRow>(): <const TCols ...>(columns: TCols) => TCols;

export function createColumns<
  TRow,
  TCols extends readonly ColumnDecl<TRow, string, unknown>[],
>(
  data: () => readonly TRow[] | undefined,
  build: (col: ColumnBuilder<TRow>) => TCols,
  schema?:
    | ColumnsSchemaFn<TRow, ColumnIdIn<ColumnValues<TRow, TCols>>>
    | ColumnSchema<TRow>,
): ColumnSet<TRow, TCols>;
```

- **Dispatch:** `build === undefined` → return the curried
  identity; otherwise data first. **`data` is never read** —
  it binds `TRow` only (D2). Do not call it, not even to
  validate.
- **`col(id, opts?)`** returns `{ id, ...opts }`. **Do not
  bake a default accessor** (D6) — `resolveColumnDefs` keeps
  owning `row[id]`.
- **`col.from(decl, opts)`** returns `{ ...decl, ...opts }`
  — a fresh object; the original is not mutated. An omitted
  `opts.id` keeps `decl.id`.
- **The brand is type-only** (D7): the runtime object has no
  `COLUMN_DECL` key. The builder's return therefore needs one
  cast to `ColumnDecl<…>`. Keep it to a single, commented
  site inside the builder — same shape as `buildColumnsPath`'s
  one proxy cast in `columns-schema/schema.ts`.
- **Schema:** a function → `columnSchema(schema).rules`; an
  object → `schema.rules`. A `typeof schema === 'function'`
  test separates them (D10); do not export `isColumnSchema`
  from `resolve.ts`. No schema → `rules: []`.
- **No construction checks.** Unknown rule ids, duplicate
  ids and duplicate metadata keys move in with #132. Until
  then the set is unused and the schema's paths are typed to
  the declared ids.
- Return `{ columns, rules }` — no `data`, no `kind` (D10).
- Rewrite the file's JSDoc for the data-first form; keep a
  short note on the curried overload saying it is retained
  only until its callers migrate. Use `source-docs`'s
  two-channel convention (consumer `/** */`, maintainer `//`).

### 3. Barrel — `index.ts`

Export `ColumnDecl`, `ColumnBuilder`, `ColumnSet` and
`Presentation` as types. A consumer's exported
`const cols = createColumns(...)` needs them nameable for
declaration emit. `createColumns` itself is already
re-exported.

## Implementation Notes

- The `col` object is a function with a `from` property —
  build it with `Object.assign(fn, { from })` so its type is
  inferred against `ColumnBuilder<TRow>` without a second
  cast.
- `const` on `TCols` is **not** needed: the ids are captured
  by `K` inside each `col()` call (D3), and the map resolves
  over an array-of-union.
- Overload order: put the data-first overload so that a
  zero-argument call still resolves to the curried one, and
  confirm `createColumns<Row>()` (one explicit type argument)
  still picks the curried overload — the data-first one has
  two type parameters with no default.

## Risks / Watchouts

- **`ColumnValues`'s new arm is load-bearing.** If a
  declared accessor resolves to the field type, the arm is
  missing or misordered — the old accessor arm cannot see an
  optional member.
- **Don't widen `createTable`'s `TCols` constraint** or touch
  the overload generator. That is #131.
- **R7's `ngDevMode` wrap and E12's message edit are #132's.**
  Do not touch `schema/validate.ts`.

## Non-Goals

- No `createTable` intake change, no `TableConfig` edit, no
  overload regeneration (#131).
- No construction checks (#132).
- No call-site migration; the curried form stays (#137,
  #138).
- No specs — Steps 2 and 3.

## Acceptance Checks

- [ ] `createColumns(data, build, schema?)` exists; the
      curried `createColumns<TRow>()` still compiles for its
      two existing callers, unedited.
- [ ] `data` is not invoked anywhere in the implementation.
- [ ] `col()` sets no default accessor; `col.from` returns a
      new object.
- [ ] `ColumnValues` resolves a `ColumnDecl`'s `V`.
- [ ] `nx run shared-table:typecheck` clean, **run twice**.
- [ ] `nx run shared-table:typecheck-spec` clean (existing
      specs untouched and still green).
- [ ] `npm run table:overloads:check` clean (nothing
      regenerated).

---
[Step 2: Runtime spec](step-2-runtime-spec.plan.md) →
