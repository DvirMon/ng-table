# Implementation Progress — Table: convert withRowEdit, withOptimistic to the Feature<In, Out> contract

**Issue:** #40
**Status:** 6 / 6 complete

| Step | Title                                                                                  | Status  | PR  |
| ---- | -------------------------------------------------------------------------------------- | ------- | --- |
| 1    | editing-state.ts: `createEditingStore(input: EditingStoreInput<TRow>)`, no `TableCore` | ✅ done | —   |
| 2    | with-optimistic.ts: `withOptimistic<In>(derive?)`                                      | ✅ done | —   |
| 3    | with-row-edit.ts: `withRowEdit<In>(config?, derive?)`, `indexById` off the input       | ✅ done | —   |
| 4    | with-optimistic.spec.ts: positional, derive-only block, both-orders throw              | ✅ done | —   |
| 5    | with-row-edit.spec.ts + optimistic-mutations.spec.ts composed cases                    | ✅ done | —   |
| 6    | finding on #40: order the two features vs keep the shared store (comment)              | ✅ done | —   |

Graph: `1 → {2, 3}`; `{2, 3} → 4`; `3 → 5`; `3 → 6`.
Parallel-safe: `[2, 3]` after `1`; `[4, 5, 6]` after `3` (4 also needs 2). Dependency: `1 → 3 → 5`.

```
        ┌── 2 ──┐
  1 ────┤       ├── 4
        └── 3 ──┼── 5
                └── 6
```

Typing mechanism verified by probe: `../../../probe-r5-feature-conversion.ts.txt` (case 6 is
`withOptimistic(withComputed(...))` — needs `NoInfer` on the derive parameter). Docs rationale
rewrite (editing store, ADR-0003, CLAUDE.md) is #44.

## Steps 2 & 3 — the input alias needs `& Shape`

The plan's `type XInput<In> = EditingStoreInput<RowOf<In>>` does not compile in either feature:
`Feature<In, Out>` requires `In extends Shape` (`{ rows: Signal<readonly unknown[]> }`), and the
editing slice is `value`/`trackBy`/`indexById` only — neither feature reads `rows`. Both aliases
are now `EditingStoreInput<RowOf<In>> & Shape`, so the generic bound stays the plan's literal
`In extends XInput<In>` and the alias still names the narrow read set. `withSelection`/
`withExpansion` need no equivalent — their slices Pick `rows` already, since they do read it.

## /code-review outcome (applied)

Standards axis, fixed in place: relative import groups alphabetized in all four feature files;
the `probe case 11` narration replaced with what the annotation actually does (no task-plan
reference in source); overload-implementation params renamed `a`/`b` → `configOrDerive`/
`maybeDerive`; `inContext`'s JSDoc no longer claims to mirror files that don't define it;
`editing-state.ts`'s header no longer implies the two features share one store when composed
(composing both throws).

Standards axis, **not** applied — needs its own issue: the six-line overload-dispatch prologue
(`isDeriveFirst` → `config`/`derive` → ternary → `Object.assign(displayName)`) is verbatim in
`withSelection`, `withExpansion`, `withRowEdit` and near-verbatim in `withOptimistic`. One
`defineFeature(displayName, factory, derive?)` in `create-table-feature.ts` absorbs all four.
Out of scope for #39/#74 — both plans specify the current shape literally.

Spec axis on #40: issue AC reads "Shared editing store still works when both features are
composed, **in either order**". The code asserts the opposite — composing both throws in either
order (ADR-0007), which Step 4's plan reinterprets as the observable contract. The reinterpretation
is right; the AC text is stale. Amend the AC on the issue, do not tick it as written.

Spec axis on #40, closed: Step 3's acceptance check wanted both `withRowEdit({}, withComputed(...))`
and the derive-first `withRowEdit(withComputed(...))`; only the config-first form existed. A
derive-first case was added to `with-row-edit.spec.ts`'s types block.
