# Implementation Progress — filters-inferred-state (`#109`)

**Epic:** [#109](https://github.com/DvirMon/acme/issues/109) — createFilters: infer `TState` from the schema
**Spec:** [spec.md](../../spec.md) · **Architecture:** [architecture.md](../../architecture.md)

Four issues. `#110` and `#111` share a branch — `#110` changes the declaration shape and breaks
every call site, and the build is green only at the end of `#111`.

External edge: the decoupling ticket (`#101`, steps 1–13) is complete and merged. Nothing blocks
`#110`.

## `#110` — the library mechanism · PR 1 of 2

**Status:** 6 / 6 complete

| Step | Title | Type | Status | PR |
|---|---|---|---|---|
| 1 | [Add the rule types and the `StateOf` fold](step-1-rule-types-and-stateof.plan.md) | `code` | ✅ done | — |
| 2 | [Add the row-type token](step-2-row-of-token.plan.md) | `code` | ✅ done | — |
| 3 | [Rules return their records](step-3-rules-return-records.plan.md) | `code` | ✅ done | — |
| 4 | [The row carrier and the array schema](step-4-carrier-and-array-schema.plan.md) | `code` | ✅ done | — |
| 5 | [Delete the ambient recorder](step-5-delete-recorder.plan.md) | `code` | ✅ done | — |
| 6 | [Export the token from the domain barrel](step-6-barrel-export.plan.md) | `code` | ✅ done | — |

### Execution graph

```
[1 types] ──┬──> [3 rules] ──┐
            │                ├──> [4 create-filters] ──> [5 delete recorder] ──> [6 barrel]
[2 row-of] ─┴────────────────┘                                                      ^
     └──────────────────────────────────────────────────────────────────────────────┘
```

Parallel-safe: `[1, 2]`. Dependency: `1, 3 → 4 → 5 → 6`; `2 → 4`, `2 → 6`.

The library typecheck (`tsconfig.lib.json`) is green after every step except 3, which breaks
`create-filters.ts` until 4 lands. The **spec** typecheck is red from step 3 to the end of the
issue — that is by design, and `#111` restores it.

### Deviations from the plan, decided during `/implement` (2026-09-14)

Two acceptance criteria on `#110` were written against behaviour the architecture's own
signatures did not deliver. Both were caught by compiled probe, not by a self-report.

| Claim as planned | What actually happens | Resolution |
|---|---|---|
| `anyOf` rejects a mixed-criterion group | It did **not** — `CriterionOf<C[number]>` distributes over the children union and silently yields `string \| RangeCriterion` | **Fixed in code.** `children` now takes a homogeneity intersection checked against `CriterionOf<C[0]>`, applied on the parameter, never as `C`'s inference constraint |
| `applyWhen(…)` and `...applyWhen(…)` both work | Spread is a `TS2488` — a node has no `[Symbol.iterator]` | **Fixed in docs**, per the user's call. Place the node directly; the spread is a compile error. Strictly better than the equivalence specified: an omitted spread is correct, a written one is loud |

Amended in place (marked as corrections, not silently rewritten): `architecture.md` (the `anyOf`
and `applyWhen` contract blocks, the type-facts list), `spec.md` (user story 21, the R37 bullet,
the type-spec outline), `step-4`'s acceptance checks, and the `rules.ts` / `types.ts` doc comments.

**Still owed to `#113`:** R44's wording in `design-options-hybrid-api.md`.
**Still owed to `#112`:** its AC *"produces the same top-level keys whether spread or not"* is now
false and would have been written as a failing type assertion.

### Known state at the end of `#110`

`src/filters/` typechecks with **zero** errors. The library as a whole does **not** — five call
sites still declare the previous shape, which is exactly what `#111` exists to fix and why the two
share a branch:

- `src/stories/composition/derived-state/derived-state-story-host.component.ts`
- `src/stories/filtering/client-filtering/client-filtering-story-host.component.ts`
- `src/stories/filtering/selection-filtering/selection-filtering-story-host.component.ts`
- `src/stories/filtering/server-filtering/server-filtering-story-host.component.ts`
- `src/stories/grouping/fixtures/schema.ts`

plus `create-filters.spec.ts`, `state.spec.ts` and `with-filtering.spec.ts`. **The test suite
cannot pass until `#111` lands** — the filters spec does not compile against the new signature.

### `/code-review` outcome (2026-09-14, two axes vs `22b0ae5`)

**Fixed before commit:**

| Finding | Axis | Fix |
|---|---|---|
| `applyWhen` silently lost its construction throw — `HEAD:rules.ts:305` rejected an empty gate, the rewrite checked nothing at any level | Spec (regression) | `S extends readonly [unknown, ...unknown[]]`, matching `anyOf`, plus the runtime throw as backstop for untyped callers |
| All 7 rule literals + `anyOf` dropped `satisfies FilterRuleRecord` for a bare `as`, removing structural checking on the whole literal | Standards (hard) | Restored as `} satisfies FilterRuleRecord<TRow> as FilterRule<…>` — keeps both the structural check and the phantom-carrying return type |
| `isConditionalNode` asserted `children` + `condition` from a `kind` check alone | Standards (hard) | Every destructured member now checked; `'kind' in item` replaces the `as` |

**Left open, deliberately:**

- JSDoc on `applyWhen`/`filter`/`anyOf` narrates decisions and carries a dated probe note — violates
  the terse-JSDoc rule and the no-decision-narration rule. Some of it was added while amending the
  spread claim. Trim, and move the rationale to `docs/`.
- `ConditionalNode` is an inline interface in `create-filters.ts`; its sibling `ConditionalRule`
  lives in `types.ts`. `file-organization.md` says it belongs there too.
- `rules.ts`'s module-level JSDoc block is orphaned — it sits between the imports and `RuleKey`'s
  own comment, attached to nothing.
- Judgement calls not acted on: `FilterRule<RuleKey<K, TAs>, X, TRow>` written twice per rule across
  six near-identical bodies; `create-filters.ts` now holds four concerns (factory, stateful path
  proxy, flattener, guard).

**Known limitation, pre-existing and not a regression:** a nested `applyWhen` loses the inner gate —
`{ ...child, kind: 'conditional', condition }` overwrites the inner `condition` with the outer one.
The deleted recorder did exactly the same, so behaviour is unchanged, which is what the spec required.

## Not planned here

| Issue | Scope | Run `/to-tasks` when |
|---|---|---|
| [#111](https://github.com/DvirMon/acme/issues/111) | every call site — specs, stories, fixtures; the seven criterion-map types delete | `#110` is done |
| [#112](https://github.com/DvirMon/acme/issues/112) | `create-filters.types.spec.ts`, the compiled type seam | `#111` is done |
| [#113](https://github.com/DvirMon/acme/issues/113) | docs, ADRs, `CLAUDE.md`, the design record | any time — merge after `#111` |

Status values: `⬚ pending`, `▶ in progress`, `✅ done`, `⏭ skipped`.
