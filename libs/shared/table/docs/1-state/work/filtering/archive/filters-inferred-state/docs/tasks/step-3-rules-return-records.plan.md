# Step 3 — Rules return their records; `anyOf` and `applyWhen` compose by value

**PR scope:** PR 1 of 2 (`#110`). **Depends on: Step 1.** **Blocks Step 4.**
**Task type:** `code`
**Stack:** angular
**Skills used:** `typescript-conventions`, `declarative-naming`
**Scaffolding agent:** `angular-implementer`

## Files

| File | Action |
|---|---|
| `libs/shared/table/src/filters/rules.ts` | rewrite |

`recorder.ts` still exists at the end of this step — `create-filters.ts` is its last caller until
Step 4, and Step 5 deletes it.

## Why This Step Exists

The side-effect recorder is the reason the criterion map cannot be inferred: a rule that returns
`void` tells the type system nothing about what it declared. Making each rule return its own record
turns the schema body into a value, and a value has a type the fold can read.

Everything downstream of this step consumes those returned values. Nothing downstream can be written
until the rules produce them.

## What To Do

1. **Seven rules return instead of recording.** `equals`, `contains`, `inRange`, `inDateRange`,
   `hasAny`, `hasNone` and `filter` each build the same `FilterRuleRecord` they build today and
   `return` it, typed as `FilterRule<TKey, TCriterion, TRow>`. The record's runtime fields —
   `kind`, `paths`, `key`, `predicate`, `isEmpty`, `emptyValue`, `options` — are unchanged, field
   for field. `resolveEmptiness`, `isEmptyRange`, `isEmptyDateRange` and the shipped matcher
   bindings are unchanged.
2. **Each rule's key type is inferred per call.** `options?.as ?? path.id` is the runtime; the
   static key is the `as` literal where one is given and the path key otherwise. This is what makes
   the literal-key guard finally bite — it already exists in `FilterOptions`, it simply never had a
   real inference site.
3. **`filter()`'s criterion comes from its own predicate annotation.** `TCriterion` is inferred from
   `(cell: TRow[K], criterion: TCriterion) => boolean` and must survive into the returned rule's
   criterion slot.
4. **Delete every recorder touch.** `assertFilterPathIsCurrent`, `currentFilterRecorder`,
   `createFilterRecorderSession`, `withActiveFilterRecorder` and `buildFiltersPath` all leave this
   file's imports. No rule reads `path[FILTER_RECORDER]`.
5. **`anyOf(key, children)`.**

   ```ts
   export function anyOf<TKey extends string, C extends readonly [unknown, ...unknown[]]>(
     key: TKey,
     children: C,
   ): GroupRule<TKey, CriterionOf<C[number]>>;
   ```

   The nested schema callback goes — children arrive already built. The non-empty tuple makes an
   empty group a compile error; one inferred shared criterion makes a mixed-criterion group a
   compile error. The runtime fold is what it is today: `paths` from the children, `children` mapped
   to `{ path, predicate }`, and `isEmpty`/`emptyValue` borrowed from the first child. Keep the
   construction throw for an empty group — it is the backstop for an untyped caller.
6. **`applyWhen(path, condition, children)` returns one node.** A `ConditionalRule` carrying its
   children, never an array. Returning an array would let a forgotten spread leave a nested array
   the fold skips, silently dropping those filters from both the type and the runtime. Gating
   semantics do not change: each child keeps its own top-level key and its own record, re-tagged
   `kind: 'conditional'` with the shared `condition`. Whether the re-tag happens here or in Step 4's
   flattener is an implementation choice — decide it here and say so in the doc comment, because
   Step 4 has to match.
7. **`applyWhen` keeps its `path` parameter.** It is never read. Keep it for signature parity with
   Signal Forms' `applyWhen(path, …)` and say exactly that in a comment — retained for parity, not
   for inference.

## Implementation Notes

- **Never name the key type in the `children` constraint.** `C extends readonly [unknown,
  ...unknown[]]` is deliberate. Constraining to a rule type whose key parameter is `string`
  contextually types the elements and widens every child's key; the tuple survives, so it looks like
  tuple widening and sends you after the wrong cause. This bites `anyOf` and `applyWhen` exactly as
  it bites `createFilters`, and it will bite every future combinator.
- The generic-erasure `as` casts at the record boundary stay. The erased type only ever round-trips
  through the record's own `key`/`paths`, which is why collapsing the matcher generics to `unknown`
  in the runtime shape is sound even though the compiler cannot prove it.
- `equals`' `const TEmpty = null` parameter and the `emptyValue` override behaviour are unchanged.
  **Superseded 2026-09-16 by [#116](https://github.com/DvirMon/acme/issues/116):** `TEmpty` now
  defaults to `never` and the criterion is `TRow[K] | null | TEmpty` — `emptyValue` *extends* the
  rule's empty set rather than displacing it, and `isEmpty` (promoted from `filter()` to every rule
  via `FilterOptions`) is the total override.
- The file header comment describes rules as "bare verbs that *do* something (register a filter)".
  They no longer register anything — they return a declaration. Correct it, and drop the
  decision-number citations rather than updating them.

## Risks / Watchouts

- **`filter()` now has two inference sites for `TCriterion`** — the predicate's second parameter and
  `options.isEmpty: (criterion: TCriterion) => boolean`. Harmless while they agree. Check
  deliberately that a mismatch between them is an **error** and not a silent widening to a union or
  to `unknown`; if it widens, constrain the `isEmpty` site so the predicate wins. This is an open
  question in the architecture doc — resolve it here and record the answer in the step's PR
  description. **Resolved, then moved 2026-09-16 by
  [#116](https://github.com/DvirMon/acme/issues/116):** the mismatch is a hard `TS2322` at the
  `options` argument, and `isEmpty` now lives on `FilterOptions` itself — wrapped in `NoInfer`, so
  it contributes no inference back to the criterion at all.
- **`anyOf` borrows `isEmpty`/`emptyValue` from its first child.** That borrow was conventional and
  is now sound, because the shared criterion type is checked. Do not "improve" it into a merge.
- Every rule's return type is now part of the public contract. An accidental widening to
  `FilterRuleRecord<TRow>` compiles fine and silently destroys the fold — the criterion map comes
  back with no keys rather than with wrong ones. Check one rule's inferred return type by hand
  before writing the other six.
- This step breaks `create-filters.ts`, which still calls the recorder and passes a `void`-returning
  schema. That is expected — Step 4 is the other half.

## Non-Goals

- Changing what any predicate matches, how emptiness is decided, or the null-cell policy.
- Adding a new rule kind. The shipped set is fixed; anything else is a custom `filter()`.
- Deleting `recorder.ts` — Step 5, once `create-filters.ts` has stopped importing it.
- Rewriting any schema at a call site — `#111`.

## Acceptance Checks

- [ ] All seven rules return a typed rule; none returns `void`
- [ ] No symbol from `recorder.ts` is imported by this file
- [ ] `anyOf` takes a non-empty tuple of prebuilt children and returns one group rule
- [ ] `anyOf` needs no explicit type argument at a call site
- [ ] `applyWhen` returns one node carrying its children, and keeps its documented-as-unused `path`
- [ ] No constraint in the file names the key type
- [ ] The `filter()` two-inference-site question is answered, with the answer written down
- [ ] Runtime record fields are byte-for-byte the shape `validate.ts` and `state.ts` already consume
- [ ] `nx run shared-table:typecheck` reports errors **only** in
      `create-filters.ts`

---
← [Step 2: Add the row-type token](step-2-row-of-token.plan.md) | [Step 4: The row carrier and the array schema](step-4-carrier-and-array-schema.plan.md) →
