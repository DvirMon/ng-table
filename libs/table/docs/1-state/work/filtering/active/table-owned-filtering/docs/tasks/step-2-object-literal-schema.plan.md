# Step 2 — Object-literal schema; delete the key-derivation layer

**PR scope:** PR 1 of 1 (`#124`). **Depends on: Step 1.** **Blocks Step 3.**
**Task type:** `code`
**Stack:** angular
**Skills used:** `angular-developer`, `typescript-conventions`
**Scaffolding agent:** `angular-implementer`

## Files

| File | Line | Action |
|---|---|---|
| `libs/table/src/filters/types.ts` | `:5-7` | delete — `EnforceLiteralKey` |
| `libs/table/src/filters/types.ts` | `:12-27` | edit — `FilterOptions` loses `as`/`TAs` |
| `libs/table/src/filters/types.ts` | `:152-165` | edit — `FilterRule` loses `TKey`/`__key` |
| `libs/table/src/filters/types.ts` | `:181-231` | replace — `Flatten`/`FlattenItem`/`IsAny` deleted, `StateOf` rewritten |
| `libs/table/src/filters/rules.ts` | `:38-42` | delete — `RuleKey` |
| `libs/table/src/filters/rules.ts` | `:86-303` | edit — every rule drops `TAs`, `as`, and its own `key` |
| `libs/table/src/filters/rules.ts` | `:283-303` | edit — `anyOf` loses its positional `key` parameter |
| `libs/table/src/filters/create-filters.ts` | `:42-68` | replace — `flattenRules` → `Object.entries` walk |
| `libs/table/src/filters/create-filters.ts` | `:108-118` | edit — the not-an-array throw names the object form |
| `libs/table/src/filters/validate.ts` | `:14-40` | edit — the duplicate-key and empty-key throws are deleted |

## Why This Step Exists

The key-derivation layer (`as`, `RuleKey`, `EnforceLiteralKey`, the `__key` phantom, `Flatten`,
`FlattenItem`, `flattenRules`) exists for exactly one reason: rules were collected in an **array**,
so each rule had to carry its own key statically for `StateOf` to fold them into a criterion map.
An object literal supplies the key at the declaration site. Every one of those constructs then has
nothing left to do.

The duplicate-**key** runtime throw goes with them — an object literal cannot repeat a key, so TS
rejects it before construction (R51). The duplicate-**path** throw is a different fact and **stays**:
two distinct keys may still name the same row path, and that is still a wiring error.

## What To Do

1. `StateOf` becomes a plain mapped type over the schema object:

   ```ts
   export type StateOf<S> = { [K in keyof S]: CriterionOf<S[K]> };
   ```

   Delete `Flatten`, `FlattenItem`, the local `IsAny`, and the comment block above the old
   `StateOf` about why its constraint was `readonly unknown[]`.
2. Delete `EnforceLiteralKey`, and `as`/`TAs` from `FilterOptions`. Its parameters become
   `FilterOptions<TSource = unknown, TRow = unknown>`.
3. `FilterRule` drops its `TKey` parameter and the `__key` phantom:
   `FilterRule<TCriterion, TRow = unknown>`. `GroupRule` follows. `AnyRule` becomes
   `FilterRule<unknown> | GroupRule<unknown>`. `CriterionOf` and `RowOfRule` adjust their `infer`
   positions.
4. Every rule in `rules.ts` drops its `const TAs extends string = never` parameter, its
   `key: options?.as ?? path.id` property, and the `RuleKey<K, TAs>` in its return type. The
   returned record no longer carries `key` at all — the builder assigns it from the object key.
   `paths` stays.
5. `anyOf(key, children)` becomes `anyOf(children)`. Its `TKey` parameter goes. The homogeneity
   check on `children` and the first-child criterion/row borrow are **unchanged** — that check is
   what keeps a mixed-criterion group from silently matching every row, and the comment saying so
   should survive the edit.
6. `create-filters.ts`'s `flattenRules` is replaced by a walk over `Object.entries(declared)` that
   stamps each record's key from its object key. No recursion — an object literal has no nesting
   left to flatten now that `applyWhen` is gone.
7. The guard on the schema's return value changes from `Array.isArray` to an object check, and its
   message names the object form (R40):

   ```
   The schema function must return its rules as an object literal. A body that calls rules as
   statements declares nothing — return an object: (path) => ({ status: equals(path.status) })
   ```
8. In `validate.ts`, delete the `!record.key` throw and the `seenKeys` duplicate-key throw. Keep
   the empty-`anyOf` throw and the duplicate-path throw. Reword the duplicate-path message: it
   currently tells the caller to use `as`, which no longer exists — it should say two keys may not
   target one path and point at `filter()` over a compound criterion.

## Implementation Notes

- `StateOf<S>` no longer needs the `readonly unknown[]` constraint dance. The old comment warned
  that naming a rule type in the constraint would contextually widen every key to `string`; with
  keys coming from the object, that hazard is gone entirely.
- `CriterionOf<R>` is now the only inference channel. It reads `__criterion`, which stays.
- `RowOfRule` and `__row` stay this step. Step 3 decides their fate once `TRow` comes from the
  table rather than from a rule.
- Per `general-mechanism-over-enumerated-cases`: do not add a per-rule key-override option to
  replace `as`. Renaming is what the object key already does.

## Risks / Watchouts

- **`anyOf`'s inference is fragile by design.** `C` is inferred from a bare
  `readonly [unknown, ...unknown[]]` and the homogeneity check is applied as an *intersection*,
  never as the constraint. Removing the key parameter must not tempt a "tidier" constraint — that
  contextually types the children and the criterion borrow collapses to `unknown`.
- **Key stamping order.** `Object.entries` preserves insertion order for string keys, which is what
  `criteria()` and the evaluator iterate. Integer-like keys (`"0"`, `"1"`) sort first and would
  reorder a schema — not a correctness bug (filters AND), but call it out if a spec depends on order.
- The `satisfies FilterRuleRecord<TRow> as FilterRule<...>` erasure boundary at the end of every
  rule stays. It is the documented storage-shape collapse, not an oversight to clean up.

## Non-Goals

- Moving the builder behind `withFiltering` — Step 3.
- Deleting the row carrier — Step 3.
- Touching `state.ts`, `evaluator.ts` or `matchers.ts` beyond what the record's shape change forces.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` reports no error originating in `src/filters/*.ts` or
      `src/api/features/with-filtering.ts`. Run twice.
- [ ] No `as`, `RuleKey`, `EnforceLiteralKey`, `__key`, `Flatten`, `FlattenItem` or `flattenRules`
      under `src/filters/`.
- [ ] A schema returning nothing throws at construction, message naming the object form.
- [ ] Two keys naming the same path still throw; the message does not mention `as`.
- [ ] Repeating a key in the schema object is a compile error, not a runtime throw.

---
← [Step 1: `when` in `FilterOptions`](step-1-when-in-filter-options.plan.md) | [Step 3: `withFiltering` owns the model](step-3-with-filtering-owns-model.plan.md) →
