# Implementation Progress — Migrate every filters call site to the row carrier and array schema

**Issue:** [#77](https://github.com/DvirMon/ng-table/issues/77) · **Epic:** [#75](https://github.com/DvirMon/ng-table/issues/75)
**Spec:** [spec.md](../../../spec.md) · **Architecture:** [architecture.md](../../../architecture.md)
**PR 2 of 2.** `#76` (`ffd9649`) changed the declaration shape and broke every call site. **The
build is green only at the end of Step 9.**

**Status:** 9 / 9 complete — typecheck and suite green (634 passed, 1 todo, 33 files), `/code-review` applied

| Step | Title                                                                                       | Type    | Status  | PR  |
| ---- | ------------------------------------------------------------------------------------------- | ------- | ------- | --- |
| 1    | [Composition: the derived-state story host](step-1-composition-derived-state.plan.md)       | `code`  | ✅ done | —   |
| 2    | [The client filtering host](step-2-client-filtering-host.plan.md)                           | `code`  | ✅ done | —   |
| 3    | [The selection filtering host](step-3-selection-filtering-host.plan.md)                     | `code`  | ✅ done | —   |
| 4    | [The server filtering host — the `rowOf()` reference](step-4-server-filtering-host.plan.md) | `code`  | ✅ done | —   |
| 5    | [The grouping fixtures](step-5-grouping-fixtures.plan.md)                                   | `code`  | ✅ done | —   |
| 6    | [`create-filters.spec.ts`](step-6-create-filters-spec.plan.md)                              | `test`  | ✅ done | —   |
| 7    | [`state.spec.ts`](step-7-state-spec.plan.md)                                                | `test`  | ✅ done | —   |
| 8    | [`with-filtering.spec.ts`](step-8-with-filtering-spec.plan.md)                              | `test`  | ✅ done | —   |
| 9    | [Restore green](step-9-green-gate.plan.md)                                                  | `chore` | ✅ done | —   |

Status values: `⬚ pending`, `▶ in progress`, `✅ done`, `⏭ skipped`.

## Execution graph

```
[1 composition] ─┐
[2 client]     ──┤
[3 selection]  ──┤
[4 server]     ──┤
[5 grouping]   ──┼──> [9 restore green]
[6 filters spec] ┤
[7 state spec] ──┤
[8 feature spec] ┘
```

**Parallel-safe: `[1,2,3,4,5,6,7,8]`. Dependency: all → `9`.**

No step depends on another's artifact — each rewrites a disjoint set of call sites against a
signature that already shipped in `#76`. Two soft couplings, neither an edge:

- **Steps 2, 3, 4 each delete a different alias from `filtering/fixtures/types.ts`.** Independent
  edits to one file. Sequence them if they land as separate commits.
- **Steps 4 and 7 share one open question** — whether the installed `@angular/forms/signals`
  accepts a bare callback as `form()`'s second argument. Whichever runs first answers it for both.

## Per-step verification is scoped, deliberately

Steps 1–8 cannot cite a clean `nx run shared-table:typecheck` — the tree carries known errors from
every step that has not run yet. Each cites **no error in the files it touched** instead. Step 9 is
where the exit code means something, and it runs the typecheck twice: `ngc` aborts at the first
`.ts` error and never opens a `.html`, so only a second run from a source-clean tree has checked a
template. See `.claude/rules/typecheck-angular-templates.md`.

## Decisions taken at `/to-tasks` (2026-09-14)

**Four sites name a criterion map where nothing infers it** — `keepValidCriteria()` (client host),
`serverFilterFormSchema` (filtering fixtures), `readRepCriterion`/`repFilterNode` (grouping utils),
and two annotations in `state.spec.ts`. `architecture.md`'s file-layout table lists none of them, so
`#77` did not decide it.

**Resolved: derive locally, export nothing new.** `ReturnType<typeof createDealFilters>` for the
grouping helpers; the debounce schema moves inline into `form(this.filters().value, (path) => …)`
where the model is concrete; `keepValidCriteria` accumulates by spread so its return type infers.
Rejected: exporting a `CriterionMapOf<F>` utility from the filters barrel — smaller diff, but it
widens the public surface the epic exists to narrow.

## Corrections to the issue and the architecture doc

| Source                        | Claim                                                        | Actual                                                                                                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#77` body                    | "Seven exported criterion-map types and two spec-local ones" | **Five** exported (matching the issue's own AC) and **four** spec-local: `InvoiceFilterState` in `create-filters.spec.ts` and again in `state.spec.ts`, plus `BrokenFilterState` and `TypedInvoiceFilterState` |
| `architecture.md` file layout | `state.spec.ts` — "check only"                               | It calls `createFilters<Invoice, InvoiceFilterState>(schema)` and names the alias twice more. Step 7 rewrites it                                                                                               |
| `architecture.md` file layout | omits `filtering/fixtures/schema.ts`                         | `serverFilterFormSchema` is `schema<ServerInvoiceFilterState>`. Step 4                                                                                                                                         |
| `architecture.md` file layout | omits `grouping/fixtures/utils.ts`                           | Two helpers take `Filters<DealRow, DealFilterState>`. Step 5                                                                                                                                                   |

**Also found, not in either document:** the composition and client hosts declare `filters` _above_
`data`, so the carrier reads `undefined` at construction. Harmless today — `createFilters` does
`void rows` — but invisible to a reader. Steps 1 and 2 reorder the fields.

## Deferred, on purpose

`create-filters.spec.ts`'s trailing `describe('types')` block gets its schemas rewritten in Step 6
but **stays in place**. `architecture.md` assigns the move to `create-filters.types.spec.ts`, which
is `#78` — keeping the block here means `#77` lands green and `#78` is a pure move rather than a
move plus a rewrite.

## Three `#76` defects the gate caught, fixed here (2026-09-14)

`#76` shipped with the spec deliberately red, so **no call site ever exercised these three
signatures**. All three surfaced the moment `#77`'s call sites compiled — which is the shared
branch working as designed, and the strongest argument against ever landing a slice that leaves
its own spec uncompilable.

| Defect                                                     | Symptom                                                                                                                                                         | Fix, as chosen                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `hasAny`/`hasNone` discard the cell's element type         | criterion inferred `readonly unknown[]`; `toggleOption(selected: readonly string[], …)` rejected it at the selection and server hosts                           | `TItem = ItemOf<TRow[K]>` type parameter on both rules; new internal `ItemOf` in `types.ts`. Call sites unchanged                                                                                                                                                                                                                                                                          |
| `applyWhen` never infers `TRow`                            | `FiltersPath<TRow>` is a conditional type, which is not an inference site, so `TRow` collapsed to `unknown` and `valueOf` rejected every real handle — 3 errors | `valueOf` made generic in its own handle (`valueOf<R = TRow, K …>`). `rules.ts`'s doc comment claimed the opposite — that `path` "anchors `TRow` for inference" — and is corrected                                                                                                                                                                                                         |
| `equals(path.status, { emptyValue: '' })` admits no `null` | one spec case wrote `null` into a criterion inferred as `string`                                                                                                | Case **kept**, behind `@ts-expect-error`. The old hand-written map said `status: string \| null`, wider than the rule permits — it described `equals`' default empty while the same call overrode that empty away. First deleted, then restored at review: see below. **Superseded by [#82](https://github.com/DvirMon/ng-table/issues/82)** — see the note under the `/code-review` table |

**Cost of the `valueOf` fix, recorded rather than glossed:** it now accepts a handle from _any_
row type. That check never worked in this position — the fixed signature rejected correct handles
too — so this is not a regression against working behaviour, but it is not free either. `TRow` on
`FilterValueOfContext` survives only as a generic default and no longer distinguishes two contexts.

**Implementation note:** the evaluator's `valueOf` is a contextual annotation
(`const context: FilterValueOfContext<TRow> = { valueOf(handle) {…} }`), not a re-declared generic
signature. Two generic signatures whose defaults reference different type parameters do not unify,
so re-declaring produced a `TS2322` between two signatures that print identically.

## `/code-review` outcome (2026-09-14, two axes vs `ffd9649`)

Spec axis: **no acceptance criterion unmet.** Standards axis and spec axis both landed on the same
two places, and both were fixed before commit.

| Finding                                                                                                                                                                                                                                                  | Axis              | Fix                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The deleted `emptyValue`-override case was the **only** test of the second half of `resolveEmptiness`'s contract (`rules.ts:61` — "an overridden value carries its own check … `equals` declaring `v == null` cannot speak for a caller who chose `''`") | Spec (regression) | **Restored** behind `@ts-expect-error`, matching how the same diff already treats the empty-`anyOf` backstop 90 lines earlier. The `/to-tasks` claim that two sibling cases covered it was **wrong** — all three surviving cases assert only that the _declared_ empty is empty |
| `keepValidCriteria` lost its compile-time binding to the criterion map: an inferred return assigned to a variable defeats excess-property checking, so a renamed schema key passed `reset()` silently                                                    | Standards (hard)  | `filters` made public so a module-level `ClientCriteria` can derive from it; the six named `if` guards restored with it, fixing the `declarative-naming.md` breach in the same edit                                                                                             |
| `reset(STALE_SAVED_FILTER as never)` — `never` is assignable to everything, strictly weaker than what it replaced, and it made the JSDoc's "the typed signature is what says so" false                                                                   | Both              | Now `as Partial<ClientCriteria>`, which is the original assertion recovered from the inferred map                                                                                                                                                                               |
| `TItem` inserted as the **third** type parameter, ahead of `TAs`, on exported `hasAny`/`hasNone` — silently breaks positional type arguments                                                                                                             | Standards         | Reordered to last; the default does the work either way                                                                                                                                                                                                                         |
| JSDoc narrating decisions: the same conditional-type essay in `types.ts` and `rules.ts`, plus a decision note in `evaluator.ts`                                                                                                                          | Standards         | All three trimmed to one terse line. Rationale belongs in `#79`'s docs pass                                                                                                                                                                                                     |

> **Superseded 2026-09-16 by [#82](https://github.com/DvirMon/ng-table/issues/82)** — the first
> row of each table above. The restored-behind-`@ts-expect-error` case was the right call for the
> semantics as they stood; #82 changed the semantics. `emptyValue` is now **additive**: it joins
> the rule's own empty set instead of displacing it, so `resolveEmptiness` combines
> (`fallback.isEmpty(v) || equalsCriterion(v, override)`), `equals(path.status, { emptyValue: '' })`
> infers `string | null`, and the suppression is gone. The case survives inverted — it now asserts
> the rule's own empty holds _alongside_ the override, still covering the half of
> `resolveEmptiness` nothing else reaches. A new `isEmpty`, promoted from `filter()` to every rule,
> is the only way to subtract `null` back out.

**Left open, deliberately:** the `build<S>` TestBed helper is now triplicated across the three
specs; `hasAny`/`hasNone` bodies are byte-identical apart from the matcher;
`ReturnType<typeof createDealFilters>` is spelled out twice in `grouping/fixtures/utils.ts` rather
than aliased; `readRepCriterion`/`repFilterNode` remain one-line delegations. All pre-existing
shapes, none introduced here.

**Noted, not acted on:** `with-filtering.spec.ts` passes `rowOf<Row>()` although it holds
`makeRows()`. Defensible — it builds the filter set only to prove composition — but it does dilute
the "server story is the reference `rowOf()` example" reading.

## Open, not addressed here — `anyOf`'s homogeneity check

Raised by a concurrent design review, verified by compiled probe. Neither blocks `#77`; both are
`anyOf` design and belong to `#76`/`#78`.

1. **The check is criterion-only — the row type is erased.** The intersection's right half is
   `FilterRule<string, CriterionOf<C[0]>, unknown>`, so a child built from an unrelated row's
   handle passes silently. Proposed fix, same zero-inference-cost shape:
   `RowOfRule<C[0]>` in the intersection alongside `CriterionOf<C[0]>`.
2. **Blame lands on the innocent siblings.** `C[0]` is the reference, so an odd child in first
   position yields N−1 errors, none of them on the offender. No cheap fix — the reference has to
   be _some_ child, and `C[0]` is already the one the group borrows `isEmpty`/`emptyValue` from.

## Owed to this issue by `#76`

`#78`'s acceptance criterion _"produces the same top-level keys whether spread or not"_ is false as
written — `...applyWhen(…)` is a `TS2488`. Step 6 writes the `applyWhen` cases in the
place-directly form only; `#78` asserts the spread as an error.
