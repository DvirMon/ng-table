# Column-value capture: proposals from the engine outward

**Date:** 2026-09-22 · **Status:** proposal — nothing chosen, nothing committed ·
**Evidence:** compiled. Every mechanical claim below was observed under `typescript@6.0.3` with the
library's own `tsconfig` (strict, `noPropertyAccessFromIndexSignature`), not traced through the
checker. One proposal was additionally applied to a worktree of the real library and typechecked
end to end. The probe inventory is in Appendix B.

Companion to [`discovery-column-value-capture.md`](discovery-column-value-capture.md) (the nine
ruled-out options and why each died) and
[`discovery-column-value-typing.md`](discovery-column-value-typing.md) (prior art). This file holds
only what survived compilation. Premises held fixed: ADR-0019 (key by declared column id) and
ADR-0024 (the accessor is the single value source).

**Tree state correction.** The handoff in `handoffs/` says the #125 work is uncommitted. It is not:
`c3359c0` landed all six steps, including the curried `createColumns<TRow>()([...])`. The tree is
clean.

## Answer

**One trade governs everything here.** A hoisted array of plain object literals keeps a literal
`id` in exactly three ways: a contextual type (`satisfies`), a const assertion, or a wrapper call.
There is no fourth. Every array design pays one of them, so constraint 8 (no consumer incantation)
cannot be met in full for a hoisted array. The only zero-spelling capture is a record, because a
property name never widens — and a record gives up constraint 10 (array order). For a hoisted
declaration, constraints 8 and 10 are exclusive. The proposals below take constraint 10 as fixed
and reduce constraint 8 to its achievable form: nothing inline, one already-written spelling when
hoisted, and a compile error when that spelling is forgotten.

Two designs are proposed. Two more compiled and are not proposed; see "Compiled, not proposed".

|        | Proposal                                                                                                                                                                            | Breaking | What the consumer writes                                                                                                            | Missed capture                                            |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **B1** | **Literal-preserving `id` type** — `ColumnDefInput`'s `TId` defaults to `(keyof TRow & string) \| (string & {})` instead of `string`                                                | no       | inline arrays: nothing. A hoisted array: `satisfies ColumnDefInput<Row>[]`, which the fixture already writes; its six `as const` go | loud at the first `path.<id>` read, message names the fix |
| **A1** | **Builder-function columns** — `createColumns(data, (col) => [col('region'), col('owner', { accessor: (r) => r.owner.name })], schema?)`; the column schema fn moves into this call | yes      | one call per column; nothing annotated when `data` is passed, one `ColumnBuilder<Row>` annotation otherwise                         | impossible once the result is branded                     |

**Direction (2026-09-22).** A1 in its full form — `createColumns()` taking the data signal, the
builder and the column schema fn, with the accessor staying on the column — is the design being
carried forward. B1 remains the non-breaking fallback. A second breaking design, row-agnostic
columns with a `values` field on `createTable`, is recorded below as a possible alternative and is
not being pursued now.

**B1 is the recommendation.** The whole problem is one checker rule: a string literal keeps its
type only when its contextual type is a "literal context". `string` is not one; a union carrying
`keyof TRow` is. Changing the default of one type parameter makes the inline form capture with no
spelling and the hoisted form capture with the `satisfies` it already carries. Applied to the real
library: the lib typecheck (16 overloads, every story host, the grouping fixture with its
`as const` removed) is clean; the spec typecheck fails on exactly the three lines that deliberately
probe the widened case. `createColumns()` is deleted, not replaced.

A1 is the shape to take only if the array-of-plain-objects declaration is itself judged wrong. It
compiles, is catalogued in full below, and inherits the same TypeScript limits B1 has; what it adds
is a structural "nothing to forget".

**Compiled, not proposed.**

- The previous doc's Option B (one-call `createColumns` with an intersection parameter) compiles —
  probe P2 settles its "highest-risk claim" — but B1 makes it redundant: same guard, one more
  public function, and every accessor needs a `(row: DealRow)` annotation because nothing binds
  `TRow`. B1 binds `TRow` through the contextual type the consumer already supplies.
- Record columns (`columns: { region: { label }, owner: { accessor: (r) => r.owner.name } }`)
  compile (P4a–P4d), with the accessor kept on the column entry and a sibling schema fn resolving —
  the previous doc's Option A, re-scoped. It is the only zero-spelling capture and has the strongest
  precedent (Drizzle, Zod, tRPC, Pothos), and it fails constraint 10: key insertion order replaces
  array order, and integer-like ids (`'1'`, `'2024'`) are hoisted to the front by ECMAScript own-key
  ordering. Not proposed for that reason. P4 stays in the inventory as the evidence.

## The mechanism, once

`checkExpressionForMutableLocation` (typescript.js:85359) widens a property's literal unless
`isLiteralOfContextualType(candidate, contextualType)` (:85341) returns true. That function returns
true for a union or intersection if **any** member does, and a member qualifies when its flags
include `StringLiteral`, `Index` (that is, `keyof T`), `TemplateLiteral` or `StringMapping`. The
test is on the _candidate's kind_, never on membership: `id: 'selected'` is preserved against
`keyof DealRow | (string & {})` exactly as `id: 'amount'` is, though `selected` is no row key.

Two consequences shape everything below:

- `(string & {})` contributes nothing to preservation. Its only job is to keep the union from
  collapsing to `string` (`removeRedundantLiteralTypes`, :66057, drops literals only when a bare
  `string` is present). Preservation comes from the `keyof TRow` member.
- `satisfies X` supplies `X` as the contextual type and returns the expression's own type
  (`getContextualType` case `SatisfiesExpression`, :78175; `checkSatisfiesExpressionWorker`,
  :82686). So `[...] satisfies ColumnDefInput<DealRow>[]` is a literal context _if_
  `ColumnDefInput<DealRow>['id']` is one. Today it is `string`, which is the entire reason the
  fixture carries six `as const` (probe P0c: widened to `string`).

## Proposal B1 — literal-preserving `id` type (keeps the current case)

### Consumer spelling

```ts
// Hoisted: what stories/grouping/fixtures/schema.ts writes today, minus the `as const`s.
// The accessor parameter needs no annotation — `satisfies` is a contextual type.
const dealColumns = [
  { id: 'region', label: 'Region' },
  { id: 'amount', label: 'Amount' },
  { id: 'owner', label: 'Owner', accessor: (row) => row.owner.name },
  { id: 'selected', visible: false },
] satisfies ColumnDefInput<DealRow>[];

// Hoisted config: the shape the nine grouping story hosts share.
export const groupingConfig = {
  trackBy: 'id',
  columns: dealColumns,
} satisfies TableConfig<DealRow>;

// Inline: nothing at all. Sibling schema fn and feature slots see the literal ids.
createTable(
  data,
  {
    trackBy: 'id',
    columns: [{ id: 'region' }, { id: 'owner', accessor: (row) => row.owner.name }],
    columnsSchema: (path) => applyVisible(path.region, () => true),
  },
  withGrouping({ schema: (path) => applyAggregate(path.owner, countBy) }),
);
```

### Library change

The complete diff, as applied to the worktree, is Appendix A. Six files, 46 insertions, 33
deletions, no runtime change.

- `api/types.ts` — `ColumnIdInput<TRow> = (keyof TRow & string) | (string & {})`;
  `ColumnDefInput<TRow, TId = ColumnIdInput<TRow>>`; `TableConfig`'s `TCols` constraint and default
  drop the explicit `string`; `WidenedColumnIds`, the guard type.
- `tools/generate-overloads.ts` — `baseGenerics` drops the explicit `string`; regenerate.
- `columns-schema/types.ts`, `with-grouping/types.ts` — `ColumnsPath` and `GroupingPath` become
  `string extends TId ? WidenedColumnIds : { readonly [K in TId]: Handle<K> }`.
- `stories/grouping/fixtures/schema.ts` — six `as const` removed; `satisfies` stays.

Not applied in the worktree, part of the same change:

- Delete `api/create-columns.ts` and `api/create-columns.types.spec.ts`. Its only other caller is
  the `capturedValueColumns` fixture in `api/create-table.types.spec.ts`, which becomes a
  `satisfies` declaration.
- Flip the three widened-case probes to `@ts-expect-error` (or a cast): `api/create-table.types.spec.ts:142`,
  `api/features/with-grouping/feature.spec.ts:630` and `:645`. These are the spec typecheck's only
  failures with the guard on.
- Optional cleanup: 29 `id: '…' as const` across 10 spec/fixture files are now redundant wherever a
  contextual type exists. Leaving them is harmless.
- `FiltersPath` takes the same guard when #115 re-keys it by column id; `SortingPath` likewise under
  #100.
- Docs: ADR-0019 consequence 1 ("literal inference is required, and its absence is silent") becomes
  "…and its absence is a compile error at the first path read"; the two K0 rows in
  [`decisions.md`](decisions.md) that record the curried `createColumns` are superseded; the ruled-out
  table in the capture doc gains B1's row above its Option B.

Naming note: ADR-0019 records a retired `ColumnId<TRow>` with a similar shape and a different role
(a grouping level naming a declared column _or_ a row field). The new type is declaration-time only;
a name that says so (`ColumnIdInput`, as in the diff) avoids reviving the old meaning.

### Where a capture is lost, and what happens

| Form                                                                    | Outcome                                                                                                                          |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Inline `columns: [...]` in `createTable`                                | captured (P1b)                                                                                                                   |
| Hoisted `[...] satisfies ColumnDefInput<Row>[]`                         | captured (P1a); `row` typed, no `as const`                                                                                       |
| Hoisted `{ … } satisfies TableConfig<Row>`                              | captured (P1c)                                                                                                                   |
| Carrier id not in `keyof Row`                                           | captured, `unknown` value (P1h)                                                                                                  |
| Hoisted with **no** `satisfies` and no annotation                       | widened. First `path.<id>` read errors with the guard key as the message; a table that never names a column still compiles (P1e) |
| Annotated `: ColumnDefInput<Row>[]` or a factory `(): ColumnDef<Row>[]` | widened. Same guard (P1e). The annotation erased the literal before TypeScript could see it; no design recovers that             |
| `withGrouping({ initial: ['x'] })` on a widened table                   | `string[]`, not compile-checked; `assertDeclarationsAreKnown` throws at construction, as today                                   |

**Guard placement.** Two variants compiled. The path-level guard (recommended) fires only where a
widened id space would have misled someone; its fallout on the real spec suite is the three lines
above. The `createTable`-level guard from the previous doc (`RequireDeclaredColumnIds` intersected
into `config` under `NoInfer`, P1f) fires on every table with widened columns whether or not it
names one: 21 annotated `(): ColumnDef<Row>[]` factories across 15 spec files, plus any consumer
grid that only renders. The previous doc's claim that those factories are "unaffected" under Option
B was wrong — that guard fires on `string` ids regardless of how they were produced.

### Constraints, checked

1. Keyed by declared id — unchanged.
2. Accessor is the value source — unchanged; `ColumnValues` untouched.
3. Filtering regains `TRow[K]` through the map — unchanged mechanism, now reachable from every form.
4. No partial inference — no type argument anywhere.
5. `id`'s contextual type is `string` — this is the one fact the proposal changes.
6. Carrier ids — kind check, not membership (P1h).
7. One declaration, many tables — `satisfies` on the hoisted const, already written (P1a, P1c).
8. No incantation — met inline. Not met in full for a hoisted array, where
   `satisfies ColumnDefInput<Row>[]` is required (the fixture already writes it). Forgetting it is
   a compile error at the first `path.<id>` read, never a silent widening. No array design does
   better; see the trade at the top of the Answer.
9. A missed capture is loud — at the first `path.<id>` read, with the fix in the message.
10. Array index carries order — untouched.
11. No bare `as` — `satisfies` is not an assertion.

## Proposal A1 — builder-function columns (breaking)

### Consumer spelling

```ts
// Hoisted: one annotation binds TRow for every accessor in the list.
const dealColumns = (col: ColumnBuilder<DealRow>) => [
  col('region', { label: 'Region' }),
  col('amount'),
  col('owner', { label: 'Owner', accessor: (row) => row.owner.name }),
  col('selected', { visible: false }),
];

// Inline: `col` and `row` are both typed from `data`.
createTable(data, {
  trackBy: 'id',
  columns: (col) => [col('region'), col('owner', { accessor: (row) => row.owner.name })],
  columnsSchema: (path) => applyVisible(path.region, () => true),
});
```

### Types

```ts
declare const DECL: unique symbol;
interface ColumnDecl<TRow, K extends string, V> {
  readonly [DECL]: true;               // the brand — see P3c
  readonly id: K;
  readonly accessor: (row: TRow) => V; // always present: the builder fills the default
  readonly label?: string; readonly visible?: boolean; readonly order?: number;
}
interface ColumnBuilder<TRow> {
  <K extends string, V>(id: K, opts: Presentation & { accessor: (row: TRow) => V }): ColumnDecl<TRow, K, V>;
  <K extends string>(id: K, opts?: Presentation): ColumnDecl<TRow, K, K extends keyof TRow ? TRow[K] : unknown>;
}
interface TableConfig<TRow, TCols extends readonly ColumnDecl<TRow, string, unknown>[]> {
  columns: (col: ColumnBuilder<TRow>) => TCols; …
}
```

`TCols` is inferred from the callback's return; `col('region')` is a call, so `K` is a primitive-
constrained type parameter and the literal survives hoisting with no `const` modifier (P3a). The
value map is `{ [C in TCols[number] as C['id']]: … }` over an array-of-union — no tuple needed.

### Verified

- P3a hoisted function, P3b inline with everything unannotated, feature slot and sibling schema fn
  typed, typos rejected: pass.
- P3c: **without the brand, a plain object literal in the array is accepted** — `{ id, accessor }`
  is structurally a `ColumnDecl`, its `id` widens, and the map degrades silently. With the brand it
  is rejected at that element. The brand is not optional.
- P3d: `columnsSchema` written _before_ `columns` in the same literal fails. A `columns` callback is
  context-sensitive, so it is checked in the second pass in source order (see "Limits shared").

### Costs

- Every `columns:` site migrates: 5 inline arrays, ~20 spec factories, 5 story fixtures, and every
  story host that spreads a fixture. `resolveColumnDefs` accepts the branded declaration (a runtime
  `Symbol` on each entry, or a `WeakSet` the builder registers into).
- What it buys that B1 does not: the accessor's return type is visible to the _same column's_ other
  options (a future `format: (v: number) => string`, a per-column `sortFn` typed by `V`) — MUI X's
  in-literal `V`, TanStack's `createColumnHelper`, without the curry.
- Precedent: no surveyed library ships the array form. Drizzle's `pgTable(name, (t) => ({…}))`
  callback overload and Pothos's `fields: (t) => ({…})` return object maps; Kysely's
  `addColumn<CN extends string>` captures ordered literal keys but its builder callback is
  non-generic and drops the value type. Ordering and value typing were not solved together by anyone
  surveyed.

### Full form: `createColumns()` carries the schema (verified, P5)

The builder is wrapped in one call that returns a value, and the column schema fn moves from
`createTable`'s config into that call. `columns` becomes the single entry point for a column's
presentation, its accessor and its rules; `TableConfig.columnsSchema` goes.

```ts
// Data first: `col`, `row` and `path` are all typed with nothing written. The signal is read
// for its type only — the builder runs synchronously, so headers exist before any row arrives.
const dealColumns = createColumns(
  this.deals,
  (col) => [
    col('region', { label: 'Region' }),
    col('amount'),
    col('owner', { label: 'Owner', accessor: (row) => row.owner.name }),
    col('selected', { visible: false }),
  ],
  (path) => {
    applyVisible(path.region, () => true);
    metadata(path.owner, WIDTH_KEY, 120);
  }
);

// Builder first, for a declaration shared across data sources: one annotation on `col`.
const dealColumns = createColumns((col: ColumnBuilder<DealRow>) => [...], hideRegion);

// Inline inside createTable: the row type flows back from `data`, nothing annotated.
createTable(this.deals, { trackBy: 'id', columns: createColumns((col) => [...]) });
```

```ts
declare function createColumns<TRow, TCols extends readonly AnyDecl<TRow>[]>(
  data: TableDataInput<TRow>,
  build: (col: ColumnBuilder<TRow>) => TCols,
  schema?: ColumnsSchemaFn<TRow, ColumnIdIn<ValuesOf<TCols>>> | ColumnSchema<TRow>,
): ColumnSet<TRow, TCols>;
declare function createColumns<TRow, TCols extends readonly AnyDecl<TRow>[]>(
  build: (col: ColumnBuilder<TRow>) => TCols,
  schema?: ColumnsSchemaFn<TRow, ColumnIdIn<ValuesOf<TCols>>> | ColumnSchema<TRow>,
): ColumnSet<TRow, TCols>;
// TableConfig: { trackBy; columns: ColumnSet<TRow, TCols> } — no columnsSchema.
```

What the wrapper settles beyond the bare builder:

- **The sibling-order limit disappears by construction.** The schema fn is the second positional
  argument, so it is always checked after the columns (P5a).
- **Rule ids are validated at declaration**, not at `createTable`: `assertRuleColumnIdsAreKnown`
  moves into `createColumns`, the earliest point both sides exist.
- **A column set is bound to its row type.** Passing one built for `DealRow` to a table over
  another row is a type error (P5e). The builder-first overload with `col` unannotated is loud, not
  silent: `row` is `unknown` and the accessor fails to compile (P5c).
- **The standalone `columnSchema()` value keeps working** as the second argument (P5b), so the
  reuse form survives the move.
- **Runtime:** `createColumns` runs the builder once, runs the schema fn through the existing
  recorder session, validates, and returns `{ columns, rules }`. `createTable` consumes that value
  where `resolveColumnsConfig` consumed `columns` + `columnsSchema` today. The engine, the store
  shape and every feature are untouched.

The `data` argument exists for type inference only. It is never read at runtime, and a skeleton
that renders headers while `data()` is still `[]` works exactly as it does now.

## Recorded alternative: row-agnostic columns with a `values` field (verified, P6; not pursued)

The row type is needed at declaration only because the accessor lives there. This design moves the
accessor to `createTable`, where `data` already fixes the row type, so the declaration carries no
row type at all and one column set can serve tables over different rows.

```ts
const dealColumns = createColumns((col) => [
  col('region', { label: 'Region' }),
  col('owner', { label: 'Owner' }),
  col('selected', { visible: false }),
]);

createTable(this.deals, {
  trackBy: 'id',
  columns: dealColumns,
  values: { owner: (row) => row.owner.name }, // keys autocomplete from dealColumns
});
```

The value map is derived from both: an entry in `values` wins, otherwise `TRow[id]`, otherwise
`unknown`. Runtime stays ADR-0024 as written — one accessor per column, resolved at `createTable`.

Verified: `row` typed from `data` and the map exact (P6a); a `values` key that is not a declared
column rejected, once with `row` annotated so no other error could hide it (P6b, P6b2); no
`values` at all gives `TRow[id]` (P6c); the same declaration over a different row type (P6d).

One signature detail that decided P6d: the accessor constraint must sit in the parameter type
itself, `values?: V & Accessors<TRow, TCols> & NoInfer<…>`, not only on `V`'s constraint. With a
`= {}` default on `V`, TypeScript takes the default as the contextual type and `row` loses it.

Why it is not pursued: a column's value and its presentation are declared in two places, which is
the split the full form of A1 exists to close. It stays recorded as the answer if a row-agnostic
declaration ever becomes a requirement.

## Limits shared by both (TypeScript, not design)

1. **Sibling order when `columns` is context-sensitive.** An unannotated accessor makes the whole
   `config` literal context-sensitive, so its members are checked in the second inference pass in
   source order. A `columnsSchema` written _above_ such a `columns` sees the widened fallback
   (P1i, P3d, P4d). Written below it, or with the accessor annotated, or with no accessor, order is
   free (P1b, P1k). Feature slots are separate arguments and are never affected (P1b, P3b, P4b).
   Document "columns first" and move on; the fixture form (`satisfies` on a hoisted const) never hits
   it.
2. **Feature slots see `TCols` only because `Feature<In, Out>` is callable.** A generic argument
   whose result has a call signature is deferred until the context-sensitive arguments are inferred;
   a generic feature returning a plain object is resolved first and sees the fallback (P1j). This is
   already true of the architecture; it should be recorded as an invariant in `libs/table/CLAUDE.md`
   so a future refactor of `Feature` does not remove it by accident.
3. **An annotation erases before any of this runs.** `: ColumnDefInput<Row>[]`, `(): ColumnDef<Row>[]`,
   `: Record<string, …>` — every design degrades identically; the guard is what makes it loud.
4. **Standalone `columnSchema()` needs its id union.** `columnSchema<Row, 'a' | 'b'>(…)` is already
   how every call in the repo is written, because `TId = string` was an index signature and dot
   access was already rejected. With the guard the message improves; nothing else changes.

## Constraint matrix

| #   | Constraint                                   | B1                                                       | A1                                                           |
| --- | -------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | Declared-id keying (ADR-0019)                | ✓                                                        | ✓                                                            |
| 2   | Accessor is the value source (ADR-0024)      | ✓                                                        | ✓                                                            |
| 3   | Filtering regains typed criteria via the map | ✓                                                        | ✓                                                            |
| 4   | No partial type-argument inference           | ✓ no type args                                           | ✓                                                            |
| 5   | `id` contextual type widens                  | fixed: literal context                                   | n/a: call argument                                           |
| 6   | Carrier ids outside `keyof TRow`             | ✓ kind check                                             | ✓ `K extends string`                                         |
| 7   | One declaration, many tables                 | ✓ `satisfies` on the const                               | ✓ a value; row type from `data` or one annotation            |
| 8   | No consumer incantation                      | inline: nothing. Hoisted: `satisfies`, loud if forgotten | one call per column; nothing annotated when `data` is passed |
| 9   | Missed capture is loud                       | at first `path.<id>`                                     | impossible (brand)                                           |
| 10  | Array index carries order                    | ✓                                                        | ✓                                                            |
| 11  | No bare `as` in consumer code                | ✓                                                        | ✓                                                            |
| —   | Breaking                                     | no (3 spec lines)                                        | yes                                                          |
| —   | Verified on the real library                 | lib + spec typecheck                                     | model probe                                                  |

Constraint 8 is the one neither column meets in full, for the reason stated at the top of the
Answer: a hoisted array of plain objects has no zero-spelling capture in TypeScript.

## Recommendation

Two answers, one per question asked.

**Without a breaking change:** B1. It removes an API (`createColumns`) instead of adding one,
removes every `as const`, asks nothing of an inline declaration and only the already-written
`satisfies` of a hoisted one, and its worst case is a compile error whose message is the fix.

**With one:** A1 in its full form, the direction recorded in the Answer. It is the only design
where a missed capture is structurally impossible, it makes `columns` the single entry point for a
column's presentation, accessor and rules, and with `data` passed nothing is annotated anywhere.
Its price is the migration of every `columns:` site. It was typechecked against the real library, story hosts included, with three spec lines of
fallout.

What would change this: a decision that per-column options should be typed by that column's own
value (a `format`, a typed `sortFn` on the declaration). That is a per-column _call_ by nature, and
A1 is the shape for it. Even then, B1 is not wasted — A1's `ColumnDecl` still resolves through the
same `ColumnValues` map, and the guard stays.

## Appendix A — the B1 diff, as typechecked

Applied to a detached worktree at `c3359c0`. `ngc -p libs/table/tsconfig.lib.json --noEmit`: exit
0, no errors. `ngc -p libs/table/tsconfig.spec.json --noEmit`: exit 1, three errors, all TS7053 on
`path['…']` reads inside the deliberate widened-case probes named above. The generated
`create-table.overloads.ts` differs only by the 16 constraint replacements the generator change
produces.

```diff
--- a/libs/table/src/api/types.ts
+++ b/libs/table/src/api/types.ts
@@ -103,7 +103,14 @@
-export type ColumnDefInput<TRow = unknown, TId extends string = string> = Pick<
+/**
+ * The author-facing column-id type: the row's own keys for autocomplete, any other string for a
+ * derived or carrier column. Because the union carries `keyof TRow`, an `id` written against it
+ * keeps its literal type under contextual typing (no `as const`, no capture helper).
+ */
+export type ColumnIdInput<TRow> = (keyof TRow & string) | (string & {});
+
+export type ColumnDefInput<TRow = unknown, TId extends string = ColumnIdInput<TRow>> = Pick<
   ColumnDef<TRow, TId>,
   'id'
 > &
@@ -116,6 +123,12 @@
 export type ColumnIdIn<TValues extends ColumnValueMap> = keyof TValues & string;

+/** What a schema fn's `path` resolves to when the declared column ids widened to `string`: one
+ * impossible key whose name is the fix. */
+export interface WidenedColumnIds {
+  readonly 'ng-table: column ids widened to string. Hoist columns with `satisfies ColumnDefInput<Row>[]` or declare them inline': never;
+}
+
@@ -172,7 +185,7 @@
 export interface TableConfig<
   TRow,
-  TCols extends readonly ColumnDefInput<TRow, string>[] = readonly ColumnDefInput<TRow, string>[],
+  TCols extends readonly ColumnDefInput<TRow>[] = readonly ColumnDefInput<TRow>[],
 > {
--- a/libs/table/src/columns-schema/types.ts
+++ b/libs/table/src/columns-schema/types.ts
-import type { ColumnDef } from '../api/types';
+import type { ColumnDef, WidenedColumnIds } from '../api/types';
@@ -16,9 +16,9 @@
-export type ColumnsPath<TRow, TId extends string, TRule = ColumnRule<TRow>> = {
-  readonly [K in TId]: ColumnHandle<TRow, K, TRule>;
-};
+export type ColumnsPath<TRow, TId extends string, TRule = ColumnRule<TRow>> = string extends TId
+  ? WidenedColumnIds
+  : { readonly [K in TId]: ColumnHandle<TRow, K, TRule> };
--- a/libs/table/src/api/features/with-grouping/types.ts
+++ b/libs/table/src/api/features/with-grouping/types.ts
-import type { GroupOrder, GroupWhen } from '../../types';
+import type { GroupOrder, GroupWhen, WidenedColumnIds } from '../../types';
@@ -94,9 +94,9 @@
-export type GroupingPath<TRow, TId extends string = string> = {
-  readonly [K in TId]: GroupingHandle<TRow, K>;
-};
+export type GroupingPath<TRow, TId extends string = string> = string extends TId
+  ? WidenedColumnIds
+  : { readonly [K in TId]: GroupingHandle<TRow, K> };
--- a/libs/table/tools/generate-overloads.ts
+++ b/libs/table/tools/generate-overloads.ts
@@ -58,7 +58,7 @@
-  baseGenerics: ['TRow', 'TCols extends readonly ColumnDefInput<TRow, string>[]'],
+  baseGenerics: ['TRow', 'TCols extends readonly ColumnDefInput<TRow>[]'],
--- a/libs/table/src/stories/grouping/fixtures/schema.ts
+++ b/libs/table/src/stories/grouping/fixtures/schema.ts
@@ -36,12 +36,12 @@
 const dealColumns = [
-  { id: 'region' as const, label: 'Region' },
-  { id: 'category' as const, label: 'Category' },
-  { id: 'rep' as const, label: 'Rep' },
-  { id: 'amount' as const, label: 'Amount' },
-  { id: 'closedAt' as const, label: 'Closed' },
-  { id: 'owner' as const, label: 'Owner', accessor: (row: DealRow) => row.owner.name },
+  { id: 'region', label: 'Region' },
+  { id: 'category', label: 'Category' },
+  { id: 'rep', label: 'Rep' },
+  { id: 'amount', label: 'Amount' },
+  { id: 'closedAt', label: 'Closed' },
+  { id: 'owner', label: 'Owner', accessor: (row: DealRow) => row.owner.name },
 ] satisfies ColumnDefInput<DealRow>[];
```

## Appendix B — probe inventory

Compiled with `tsc -p <probe>/tsconfig.json --noEmit`, the probe `tsconfig` extending
`libs/table/tsconfig.json` (strict, `noPropertyAccessFromIndexSignature`, `isolatedModules`). P0
imports the real library through the `@ngp/table` path alias; P1–P4 are self-contained mirrors of
`api/types.ts`, one generated overload, `ColumnsPath` and a `withProbe` feature built the way
`api/create-table.types.spec.ts` builds its own. Assertions use an `Equal<A, B>` type and
`@ts-expect-error`. Files live in this session's scratchpad (`…/scratchpad/probe/`); the snippets
above are lifted from them verbatim.

| Probe     | Asserts                                                                                                                           | Result                                           |
| --------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| P0a       | current lib, inline `columns`, no accessor → `ColumnIdOf`                                                                         | `string`                                         |
| P0b       | current lib, inline + unannotated accessor + feature slot                                                                         | map keyed by `string`; `path.region` is TS4111   |
| P0c       | current lib, hoisted `satisfies ColumnDefInput<DealRow>[]`, no `as const`                                                         | `string`                                         |
| P0d       | current lib, hoisted `satisfies TableConfig<DealRow>`                                                                             | `string`                                         |
| P0e       | current lib, inline sibling `columnsSchema`                                                                                       | TS4111                                           |
| P1a       | B1 hoisted `satisfies`: id union literal; map `{ region: string; amount: number; owner: string; selected: unknown }`; `row` typed | pass                                             |
| P1b       | B1 inline + unannotated accessor + sibling `columnsSchema` + slot; typos rejected in both                                         | pass                                             |
| P1c       | B1 hoisted config `satisfies TableConfig<DealRow>` + slot                                                                         | pass                                             |
| P1d       | B1 hoisted array through a config literal                                                                                         | pass                                             |
| P1e       | B1 bare hoist and annotated array: guard at `path.region`; widened table with no schema compiles                                  | pass                                             |
| P1f       | B1 `createTable`-level guard variant: bare/annotated rejected at the call, literal and empty pass                                 | pass                                             |
| P1g       | B1 `(): ColumnDef<Row>[]` factory still assignable to `columns`                                                                   | pass                                             |
| P1h       | B1 carrier id `'not-a-row-key'` kept literal                                                                                      | pass                                             |
| P1i       | B1 `columnsSchema` above a context-sensitive `columns`                                                                            | **fails** (shared limit 1)                       |
| P1j       | B1 non-callable generic feature after a context-sensitive `columns`                                                               | **fails** (shared limit 2)                       |
| P1k       | B1 `columnsSchema` above an annotated or accessor-less `columns`                                                                  | pass                                             |
| P2a–c     | previous doc's Option B: intersection-parameter inference; unannotated accessor loud                                              | pass                                             |
| P3a       | A1 hoisted function                                                                                                               | pass                                             |
| P3b       | A1 inline, `col` and `row` unannotated, sibling + slot                                                                            | pass                                             |
| P3c       | A1 plain object literal in the array                                                                                              | accepted without brand; rejected with brand      |
| P3d       | A1 `columnsSchema` above `columns`                                                                                                | **fails** (shared limit 1)                       |
| P4a       | record (not proposed): hoisted, no `satisfies`, accessor annotated                                                                | pass                                             |
| P4b       | record: inline, unannotated accessor, sibling + slot                                                                              | pass                                             |
| P4c       | record: explicit `Record<string, …>` annotation                                                                                   | degrades to `string` silently                    |
| P4d       | record: `columnsSchema` above a record with an unannotated accessor                                                               | **fails** (shared limit 1)                       |
| P5a       | A1 full form, data first: `col`, `row`, `path` typed; typos rejected in schema and slot; map exact                                | pass                                             |
| P5b       | A1 full form, builder first with `col` annotated; standalone `columnSchema()` value as 2nd arg                                    | pass                                             |
| P5c       | A1 full form, builder first, `col` unannotated: accessor over `unknown` row                                                       | loud (compile error)                             |
| P5d       | A1 full form inline inside `createTable`, nothing annotated: row type flows back from `data`                                      | pass                                             |
| P5e       | A1 full form: a `DealRow` column set on a table over another row type                                                             | rejected                                         |
| P6a       | values field: `row` typed from `data`, map exact, slot path typed                                                                 | pass                                             |
| P6b, P6b2 | values field: undeclared key rejected, with and without `row` annotated                                                           | pass                                             |
| P6c       | values field absent: every value is `TRow[id]`                                                                                    | pass                                             |
| P6d       | values field: same declaration over a different row type                                                                          | pass                                             |
| WT        | real library at `c3359c0` + Appendix A diff: `ngc` lib and spec                                                                   | lib clean; spec: 3 deliberate widened-case lines |

## Sources

Checker line numbers are for the installed `typescript@6.0.3` and do not transfer to 5.x (TS 6.0
renumbered `TypeFlags`). Library reads are pinned.

|     | Source                                                                                                                                                                   | Verified                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | `node_modules/typescript/lib/typescript.js:85341` `isLiteralOfContextualType`                                                                                            | read 2026-09-22; union/intersection → `some`; leaf flags `StringLiteral \| Index \| TemplateLiteral \| StringMapping`                                                     |
| T2  | `typescript.js:85359` `checkExpressionForMutableLocation`, `:72406` `getWidenedLiteralLikeTypeForContextualType`                                                         | read; the widen-unless gate                                                                                                                                               |
| T3  | `typescript.js:66057` `removeRedundantLiteralTypes`                                                                                                                      | read; literals dropped only when a bare `string` is present                                                                                                               |
| T4  | `typescript.js:78175` `getContextualType` (`SatisfiesExpression`), `:82686` `checkSatisfiesExpressionWorker`                                                             | read; `satisfies` supplies the contextual type and returns the expression's type                                                                                          |
| T5  | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html                                                                                           | `satisfies` "without changing the resulting type of that expression"                                                                                                      |
| T6  | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html                                                                                           | `const` type parameters affect only expressions "written within the call"; mutable constraint defeats it                                                                  |
| T7  | https://github.com/microsoft/TypeScript/wiki/Reference-Checker-Inference                                                                                                 | two-pass argument inference: context-sensitive arguments are skipped in the first pass, checked in source order in the second                                             |
| T8  | https://github.com/microsoft/TypeScript/pull/30215                                                                                                                       | generic-function-returning arguments are deferred; the propagation rule's third condition excludes cases where the outer parameters already have inferences               |
| T9  | https://github.com/microsoft/TypeScript/issues/29729                                                                                                                     | origin of `T \| (string & {})`; open, 244 👍; the "do not inherit `string & {}`" explanation at `#issuecomment-567871939`                                                 |
| L1  | https://unpkg.com/@tanstack/table-core@8.21.3/src/types.ts, `src/core/column.ts`                                                                                         | `accessorKey: (string & {}) \| keyof TData` shipped; `ColumnDefResolved.accessorKey?: string` and `CoreColumn.id: string` re-widen it — autocomplete only, never consumed |
| L2  | https://unpkg.com/type-fest@5.10.0/source/literal-union.d.ts                                                                                                             | `LiteralUnion` documents itself as a workaround for #29729                                                                                                                |
| L3  | `node_modules/vite@8.2.1/types/customEvent.d.ts:75-81`, `types/hot.d.ts:27-38`                                                                                           | the one installed consumer of `keyof T \| (string & {})` on a key slot; `any` on the escape branch                                                                        |
| L4  | https://unpkg.com/ag-grid-community@36.2.0/dist/types/src/entities/colDef.d.ts; https://unpkg.com/@mui/x-data-grid@9.14.0/models/colDef/gridColDef.d.ts                  | `colId?: string`, `field: string` — neither vendor types its id field as a literal context                                                                                |
| L5  | https://unpkg.com/drizzle-orm@0.45.3/pg-core/table.d.ts, `relations.d.ts`                                                                                                | callback overload `columns: (columnTypes: PgColumnsBuilders) => TColumnsMap`; returns an object map                                                                       |
| L6  | https://unpkg.com/@pothos/core@4.15.1/dts/types/builder-options.d.ts                                                                                                     | `fields: (t) => FieldMap` with `FieldMap = Record<string, GenericFieldRef<unknown>>` — the map is deliberately erased                                                     |
| L7  | https://unpkg.com/kysely@0.29.6/dist/schema/create-table-builder.d.ts                                                                                                    | `addColumn<CN extends string>(…): CreateTableBuilder<TB, C \| CN>` keeps ordered literal keys; `ColumnBuilderCallback` is non-generic, value type lost                    |
| L8  | `node_modules/@angular/forms@22.1.2/types/_structure-chunk.d.ts:1524,1644`                                                                                               | `SchemaFn<TModel> = (p: SchemaPathTree<TModel>) => void`; `schema()` exists to hoist a module-level callback                                                              |
| L9  | `node_modules/zod@4.4.3/v4/classic/schemas.d.cts:490,514`                                                                                                                | `object<T>(shape: T)` object map; `discriminatedUnion` tuple-shaped constraint                                                                                            |
| R1  | `libs/table/src/api/types.ts`, `engine/types.ts`, `columns-schema/types.ts`, `api/features/with-grouping/{types,feature}.ts`, `tools/generate-overloads.ts` at `c3359c0` | read; the shapes the probes mirror                                                                                                                                        |
| R2  | `libs/table/src/api/create-table.types.spec.ts`, `create-columns.types.spec.ts`, `with-grouping/feature.spec.ts`                                                         | read; the three widened-case lines and the `withProbe` pattern                                                                                                            |
