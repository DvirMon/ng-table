---
title: "createFilters inferred TState — architecture"
type: architecture
status: ready-for-issues
date: 2026-09-14
audience: developers
---

# Architecture — `createFilters` infers `TState`

Consumed by `/to-issues` and `/to-tasks`. Spec: [spec.md](spec.md). Decisions:
[design-options-hybrid-api.md](../with-filtering/design-options-hybrid-api.md) R34–R48.
Compiled evidence: [research-typescript-inference-probes.md](research-typescript-inference-probes.md).

## Ground truth as of 2026-09-14

Verified against `libs/shared/table/src/`, not assumed.

| Fact | Where |
|---|---|
| The filters domain is already a top-level sibling of `api/`/`engine/`/`directives/` | `src/filters/` (12 files) |
| It already owns its barrel; `src/index.ts:88` is `export * from './filters'` | `src/filters/index.ts` — 19 symbols, listed explicitly |
| The table already takes a predicate list and nothing else — R48 shipped | `src/api/features/with-filtering.ts:5-9` (`WithFilteringConfig<TRow>`, `predicates` required) |
| `matcher()` already puts `TRow` in the type body — R43 must not be built | `src/filters/types.ts` (`FiltersRoot.matcher`) |
| The ambient recorder is referenced by nothing outside the domain | `src/filters/{recorder,rules,create-filters,types}.ts` only. `src/schema/*`'s recorder is a separate, unrelated one |
| Duplicate key and duplicate path already throw at construction | `src/filters/validate.ts` |
| The literal-key guard exists but does not bite yet | `src/filters/types.ts` (`EnforceLiteralKey`) |
| Type assertions are `expectTypeOf` from `vitest`, enforced by `tsc`, not the runner | `src/filters/create-filters.spec.ts:683-743`, `src/api/features/with-filtering.spec.ts:268-300` |
| `tsconfig.spec.json` includes only `src/**/*.test.ts`, `src/**/*.spec.ts`, `src/**/*.d.ts` | `libs/shared/table/tsconfig.spec.json` |

**Uncommitted in the working tree:** the decoupling ticket's PR 2 (`#106`) — `src/filters/index.ts`
and the `src/index.ts:88` delegation. Its steps 11–13 (spec rewrites, doc pointers) are still open.
Sequence this work behind that PR landing; the two touch `src/filters/index.ts` and the filters
specs.

## Settled — not open for relitigation

R34, R35, R36, R37, R38, R39, R40, R41, R42, R44, R45, R47. Plus:

- **R43 is obsolete. Build no phantom brand.** `matcher()` consumes `TRow` for real.
- **R48 has shipped.** Do not touch `WithFilteringConfig`.
- **`Filters`' runtime semantics do not change.** `value`/`active`/`reset`/`dirty`/`matcher`,
  source defaults, empty criteria, null-cell policy, ADR-0014 degradation — all unchanged. The
  mechanism moved; the behaviour did not.
- **`src/filters/{state,evaluator,validate,matchers}.ts` keep their current contracts.** They
  consume `FilterRuleRecord`, which survives — what changes is how a record reaches them.

## Contracts

### Rule records — the inference channel (R34, R36)

Rules stop calling `recorder.record(...)` and return the record instead. The runtime shape stays
`FilterRuleRecord`; what is added is the type-level key/criterion pair that `StateOf` reads.

```ts
// src/filters/types.ts
export interface FilterRule<TKey extends string, TCriterion, TRow = unknown>
  extends FilterRuleRecord<TRow> {
  readonly __key?: TKey;            // phantom — carries the literal key
  readonly __criterion?: TCriterion; // phantom — carries the criterion shape
}
```

The phantom pair is the mechanism by which `equals(path.status)` reports `key: 'status'` and
`criterion: TRow['status'] | null` without the runtime record growing a field. Exact member names
are an implementation choice; what is fixed is that a rule's static type names both.

```ts
export type CriterionOf<R> = R extends FilterRule<string, infer C> ? C : never;

export type StateOf<T extends readonly unknown[]> =
  { [R in Extract<Flatten<T>, AnyRule> as NonNullable<R['__key']>]: CriterionOf<R> };
```

`Flatten` is the recursion R37 requires — it must see through both a nested array and a
`ConditionalRule`'s children.

> **Implementation constraint, non-negotiable.** Never name the key type in the schema's
> constraint. `S extends readonly FilterRule<string, unknown>[]` contextually types the array
> elements and pushes `string` down onto every rule's key parameter, widening all of them; the
> tuple survives, so it reads like tuple widening and sends you after the wrong cause. Use
> `S extends readonly unknown[]` and `Extract` inside `StateOf`. `as const`, the `const` type
> parameter modifier, and a variadic `[...T[]]` constraint all fail to fix it — none addresses
> contextual typing. This bites `createFilters` and `applyWhen` identically; every future rule
> combinator takes the same constraint.

### `createFilters` (R35, R39, R40)

```ts
// src/filters/create-filters.ts
export function createFilters<TRow, S extends readonly unknown[]>(
  rows: readonly TRow[] | (() => readonly TRow[] | undefined) | RowToken<TRow>,
  schema: (path: FiltersPath<TRow>) => S,
  opts?: { injector?: Injector },
): Filters<TRow, StateOf<S>>;
```

The middle union member — any callable returning rows — covers `Signal`, `WritableSignal`, a
signal of `TRow[] | undefined`, and a bare store accessor on its own. All seven carriers infer
`TRow` exactly; non-row values (`42`, `{ foo: 1 }`) are rejected. Do not reintroduce a recursive
`RowOf<E>` conditional or a named `RowEvidence` constraint — same coverage, more machinery.

**`rows` is an inference anchor and is never read.** This must be the first line of the function's
doc comment, not a footnote.

Body changes:

1. Call `schema(buildFiltersPath())` and take its return. No session, no ambient stack.
2. Guard the return (R40) before anything else:
   ```
   [createFilters] The schema function must return its rules. A body that calls rules as
   statements declares nothing — return an array: (path) => [equals(path.status)]
   ```
3. Flatten the returned collection into `FilterRuleRecord[]` (mirroring `StateOf`'s recursion at
   runtime), then continue into the existing `validateRecords` → `buildFilterState` →
   `buildFiltersObject` flow unchanged.

`opts` stays the third parameter (R24 — `{ injector }` for a call outside an injection context).
R35's published signature omitted it; that was elision, not removal.

### `FiltersPath<never>` (R39)

```ts
export type FiltersPath<TRow> = [TRow] extends [never]
  ? { readonly __rowTypeCouldNotBeInferred_useRowOf:
        'createFilters: the first argument is empty, so the row type is unknown. Pass rowOf<Row>() instead.' }
  : { readonly [K in Extract<keyof TRow, string>]: FilterHandle<TRow, K> };
```

Guard the path, not the schema parameter: guarding the parameter fires earlier but blames the
schema rather than the empty carrier that caused it.

### `rowOf` (R42)

```ts
// src/filters/row-of.ts
declare const ROW_TOKEN: unique symbol;
export interface RowToken<TRow> { readonly [ROW_TOKEN]: TRow }
export function rowOf<TRow>(): RowToken<TRow>;
```

Exported from `src/filters/index.ts` (the domain barrel), which `src/index.ts:88` already
re-exports wholesale. The near-collision with `RowOf<S>` in `engine/types.ts` — which runs the
opposite direction — is accepted; casing separates them.

### `anyOf` (R44)

```ts
export function anyOf<TKey extends string, C extends readonly [unknown, ...unknown[]]>(
  key: TKey,
  children: C & { readonly [I in keyof C]: FilterRule<string, CriterionOf<C[0]>> },
): GroupRule<TKey, CriterionOf<C[0]>>;
```

> **Corrected 2026-09-14 during `/implement` of `#110`.** The signature first published here —
> `children: C` returning `GroupRule<TKey, CriterionOf<C[number]>>` — does **not** reject a
> mixed-criterion group, contrary to the claim below it. `CriterionOf` distributes over the
> `C[number]` union and silently yields `string | RangeCriterion`. Verified by compiled probe. The
> homogeneity check is applied as an **intersection on the parameter**, never as `C`'s inference
> constraint: constraining `C` to a rule type would contextually type the elements and widen every
> child's key. Each later child is checked against the first child's criterion, `CriterionOf<C[0]>`,
> which is the same child the group already borrows `isEmpty`/`emptyValue` from.

The non-empty tuple makes an empty group a compile error; the homogeneity intersection makes a
mixed-criterion group a compile error. Keep the runtime throw in `validate.ts` as a backstop for
untyped callers, and keep borrowing `isEmpty`/`emptyValue` from the first child — that borrow is
sound once the group's criterion type is one thing.

The nested schema callback goes. `anyOf<Invoice>('search', …)` no longer needs its explicit type
argument.

### `applyWhen` (R37)

```ts
export function applyWhen<TRow, S extends readonly unknown[]>(
  path: FiltersPath<TRow>,
  condition: (ctx: FilterValueOfContext<TRow>) => boolean,
  children: S,
): ConditionalRule<S>;
```

Returns **one nestable node**, not an array. `StateOf` and the runtime flattener both recurse into
it, so the node folds to its children's top-level keys when placed directly in a schema array.

> **Corrected 2026-09-14 during `/implement` of `#110`.** This section previously claimed
> `applyWhen(…)` and `...applyWhen(…)` are equivalent. They are not: a plain object has no
> `[Symbol.iterator]`, so the spread form is a `TS2488` compile error. Verified by compiled probe.
> **Place the node directly, without a spread — that is the only supported form.** The design goal
> is still met, and more strictly than promised: the failure the node shape exists to prevent is a
> *forgotten* spread on an array-returning `applyWhen`, which left a nested array the fold skipped
> and dropped the gated filters from both the type and the runtime silently. Under the node shape a
> written spread fails loudly at compile time and an omitted one is simply correct.

Gating semantics are unchanged: each child keeps its own top-level key and its own
record, re-tagged `kind: 'conditional'` with the shared `condition` — exactly what `rules.ts` does
today, moved from a recorder loop to the returned node.

### `Filters` (R41)

Drop the `= Record<string, unknown>` default from `Filters<TRow, TState>` and `FiltersRoot<TRow,
TState>`. `WithFilteringConfig` has no `TState` left to change.

## File layout

| File | Action |
|---|---|
| `src/filters/types.ts` | edit — add `FilterRule`/`GroupRule`/`ConditionalRule`/`AnyRule`, `CriterionOf`, `Flatten`, `StateOf`; brand `FiltersPath<never>`; drop both `TState` defaults; delete `FILTER_RECORDER`, `FilterSchemaRecorder`, and `FilterHandle`'s recorder field |
| `src/filters/row-of.ts` | **create** — `RowToken<TRow>`, `rowOf<TRow>()` |
| `src/filters/rules.ts` | rewrite — all seven rules return their record; `anyOf` takes a non-empty tuple; `applyWhen` takes an array and returns one node; every `assertFilterPathIsCurrent`/`currentFilterRecorder` call goes |
| `src/filters/create-filters.ts` | rewrite signature + body per above; drop the recorder re-export block |
| `src/filters/recorder.ts` | **delete** |
| `src/filters/index.ts` | edit — add `rowOf` and `type RowToken`; the header's symbol count and its "recorder internals" clause both change |
| `src/filters/validate.ts` | unchanged — still the key/path construction throws |
| `src/filters/state.ts`, `evaluator.ts`, `matchers.ts` | unchanged |
| `src/filters/create-filters.spec.ts` | edit — every schema to the array form; move the trailing `describe('types')` block out |
| `src/filters/create-filters.types.spec.ts` | **create** — the type seam (see below) |
| `src/filters/state.spec.ts`, `matchers.spec.ts` | check only — neither imports the recorder today |
| `src/api/features/with-filtering.spec.ts` | edit — its `createFilters<Row>(schema)` helper and the schemas it builds |
| `src/stories/composition/derived-state/derived-state-story-host.component.ts` | edit — array schema, drop annotation |
| `src/stories/composition/fixtures/types.ts` | edit — delete `CompositionFilterState` |
| `src/stories/filtering/client-filtering/client-filtering-story-host.component.ts` | edit — array schema, drop annotation; its prose about the previous signature |
| `src/stories/filtering/selection-filtering/selection-filtering-story-host.component.ts` | edit — same |
| `src/stories/filtering/server-filtering/server-filtering-story-host.component.ts` | edit — same; this is the `rowOf()` showcase |
| `src/stories/filtering/fixtures/types.ts` | edit — delete `ClientInvoiceFilterState`, `ServerInvoiceFilterState`, `SelectionInvoiceFilterState` |
| `src/stories/filtering/fixtures/mock.ts` | edit — its "takes no data argument" note is now false |
| `src/stories/grouping/fixtures/schema.ts` | edit — `createDealFilters()` drops its return annotation |
| `src/stories/grouping/fixtures/types.ts` | edit — delete `DealFilterState` |
| `docs/1-state/filters.md` | rewrite — signature, array schema, carrier, `rowOf`, the three guards; delete the Signature section's R32 rationale |
| `docs/1-state/features/filtering.md` | check — it should already describe only the predicate list |
| `libs/shared/table/CLAUDE.md` | edit — the `filters/index.ts` row (symbol count, "recorder internals") and the `recorder.ts`-as-internal claim |
| `docs/1-state/work/with-filtering/design-options-hybrid-api.md` | edit — mark R10/R11/R31/R32/R33 superseded where they stand; correct R11's row-type-recovery claim |

**Nothing in `src/api/features/with-filtering.ts` changes.** If a step proposes editing it, the
step is wrong.

## Testing seams

Two, both anchored at the public `createFilters()` call.

| Seam | File | Enforced by |
|---|---|---|
| Runtime | `src/filters/create-filters.spec.ts` | `nx test shared-table` |
| Types | `src/filters/create-filters.types.spec.ts` | `npx tsc -p libs/shared/table/tsconfig.spec.json --noEmit` |

**The type file must be named `*.types.spec.ts`, not `*.type-spec.ts`.** `tsconfig.spec.json`
includes only `src/**/*.test.ts` and `src/**/*.spec.ts`, so a `.type-spec.ts` file would be
invisible to the very typecheck that is supposed to enforce it — the failure mode being that the
file compiles nowhere and silently proves nothing. Matching the existing glob is preferred to
widening the config.

Consequence: `vitest` will also execute the file. Wrap each group of assertions in `describe`/`it`
the way `create-filters.spec.ts:683-743` already does, so it runs as a passing suite whose bodies
are inert. Carry the same header comment stating which tool actually enforces it.

Type facts to assert (spec's list, restated as the file's outline):

- `StateOf` folds keys and criterion shapes from the returned array, including `as` renames and an
  `anyOf` group's positional key.
- A custom `filter()`'s criterion type survives, taken from the predicate's annotation.
- Each of the seven carriers yields the right `TRow`; `42` and `{ foo: 1 }` are rejected.
- `rowOf<Row>()` yields `Row`.
- `createFilters([], …)` makes the first `path.x` an error naming `rowOf()`.
- `{ as: someStringVar }` is rejected; `{ as: 'client' }` is not.
- `anyOf('k', [])` is rejected; a group mixing `string` and `{ min: number }` children is rejected.
- `applyWhen(…)` placed directly in the schema array produces its children's top-level keys;
  `...applyWhen(…)` is a compile error (a node is not iterable) — assert the error, not equivalence.
- `Filters<Row>` with no criterion map no longer compiles.
- `matcher()` rejects an unrelated row type (already asserted at `create-filters.spec.ts:715` —
  move it, don't rewrite it).

**Do not add filters cases to cross-feature specs.** `selection.utils.spec.ts` and
`with-grouping.spec.ts` stopped building filter schemas when the decoupling landed; a filters type
fact asserted there is coupling, not coverage.

## Dependency graph

```
[R34 rules return records] ──┬─> [R36 array schema + StateOf] ─┬─> [R44 anyOf tuple]
                             │                                 ├─> [R37 applyWhen nestable]
                             │                                 ├─> [R45 `as` literal]
                             │                                 └─> [R41 TState default]
                             └─> [R40 schema-return guard]
[R35 carrier arg] ───────────┴─> [R39 TRow=never guard]
                             └─> [R42 rowOf() + barrel export]
                                          all ─> [call sites: specs + stories, one pass]
                                                             └─> [types spec]
[docs] — parallel-safe once the signature is settled
```

Core: R34, R35. Parallel-safe: docs. Chain: `R34,R35 → … → call sites → types spec`.

Three reviewable units, per R46 as re-ranked by R47:

1. **Library** — everything under `src/filters/`. Breaks every call site.
2. **Call sites** — specs and stories, one pass. `Depends on: 1`. Not independently shippable; the
   build is green only at the end of this unit, so 1 and 2 share a branch or a stack.
3. **Docs** — `Parallel-safe with: 1, 2` once the signature is fixed.

External edge: the decoupling ticket's PR 2 (`#106`, in the working tree) and its steps 11–13.
Land those first — they touch `src/filters/index.ts` and the same spec files.

## Open questions

1. ~~**Does `applyWhen` keep its unused `path` parameter?**~~ — **resolved 2026-09-14 at
   `/to-issues`: keep it.** It is never read (`rules.ts` opens with `void path`) and the carrier
   now anchors `TRow`, so it is dead weight — but dropping it is a second shape change at every
   gated call site on top of the array rewrite, and R37 did not decide it. The signature also
   matches Signal Forms' `applyWhen(path, …)`, which is where R15 took the rule from. Keep the
   parameter and keep a comment saying it is retained for signature parity, not inference.
2. ~~**Does `filter()`'s `options.isEmpty` need to participate in `StateOf`?**~~ — **resolved
   2026-09-16 by [#116](https://github.com/DvirMon/acme/issues/116): no.** A mismatch between the
   two sites was verified to be a hard `TS2322` at the `options` argument, not a silent widening.
   `isEmpty` then moved from `filter()`'s own options onto `FilterOptions` itself — available to
   every rule — and its parameter is wrapped in `NoInfer`, so it is contextually typed from the
   criterion and contributes nothing back to it. There is no second inference site any more.
3. **How much of `create-filters.spec.ts`'s 743 lines survives the schema rewrite mechanically?**
   Every schema changes shape, so the diff is large and the review is by inspection. If a case
   needs its *assertion* changed rather than its schema, that is a semantic regression — stop and
   check it against the decisions doc rather than accommodating it.
4. ~~**Which issue closes `#90`?**~~ — **resolved 2026-09-14 at `/to-issues`: the docs issue.**
   It tracks the two `TState` landmines, which delete with the parameter. It closes as
   fixed-by-design, not as work, alongside the doc reconciliation that removes the landmine text.
