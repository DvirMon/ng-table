# Implementation Progress — filters-inferred-state (`#109`)

**Epic:** [#109](https://github.com/DvirMon/acme/issues/109) — createFilters: infer `TState` from the schema
**Spec:** [spec.md](../../spec.md) · **Architecture:** [architecture.md](../../architecture.md)

Four issues. `#110` and `#111` share a branch — `#110` changes the declaration shape and breaks
every call site, and the build is green only at the end of `#111`.

External edge: the decoupling ticket (`#101`, steps 1–13) is complete and merged. Nothing blocks
`#110`.

## `#110` — the library mechanism · PR 1 of 2 · ✅ committed (`ffd9649`)

**Status:** 6 / 6 complete

| Step | Title | Type | Status | PR |
|---|---|---|---|---|
| 1 | [Add the rule types and the `StateOf` fold](step-1-rule-types-and-stateof.plan.md) | `code` | ✅ done | `ffd9649` |
| 2 | [Add the row-type token](step-2-row-of-token.plan.md) | `code` | ✅ done | `ffd9649` |
| 3 | [Rules return their records](step-3-rules-return-records.plan.md) | `code` | ✅ done | `ffd9649` |
| 4 | [The row carrier and the array schema](step-4-carrier-and-array-schema.plan.md) | `code` | ✅ done | `ffd9649` |
| 5 | [Delete the ambient recorder](step-5-delete-recorder.plan.md) | `code` | ✅ done | `ffd9649` |
| 6 | [Export the token from the domain barrel](step-6-barrel-export.plan.md) | `code` | ✅ done | `ffd9649` |

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

## `#111` — every call site · PR 2 of 2 · ✅ complete

**Status:** 9 / 9 complete — [`issue-111-call-sites/progress.md`](issue-111-call-sites/progress.md)

Five story/fixture sites and three specs, all parallel-safe, plus a green gate that depends on all
eight. That folder also records four corrections to this issue's own body and to
`architecture.md`'s file-layout table.

## `#112` — the compiled type seam · ✅ complete

**Status:** 1 / 1 complete. Implemented directly from the issue body — `/to-tasks` was never run
for it, and the scope is one new file plus one Nx target, which does not decompose into steps.

| Artifact | Action |
|---|---|
| `src/filters/create-filters.types.spec.ts` | **created** — 13 cases across 7 suites |
| `project.json` | `typecheck-spec` target — `ngc -p tsconfig.spec.json --noEmit`, same `nx:run-commands`/`cache`/`inputs` shape as `typecheck` |
| `src/filters/create-filters.spec.ts` | the `rejects an unrelated row type` case moved out; its block header now points at the new file |
| `src/filters/rules.ts` | `RangeCriterion`/`DateRangeCriterion` exported (internal only — `filters/index.ts` does not list them) so the seam asserts the canonical shape rather than a copy of it; `anyOf`'s homogeneity intersection gains `RowOfRule<C[0]>` |
| `src/filters/types.ts` | `FilterRule` gains a phantom `__row`; new `RowOfRule<R>` reads it; `FlattenItem` discards `any` before the array branch |
| `libs/shared/table/CLAUDE.md` | the Typechecking section names both targets and why there are two |

### Scope taken beyond the issue body, on the user's call

Two library changes in `types.ts`/`rules.ts` that `#112` does not ask for. Both came out of
`/code-review` and both were decided explicitly rather than absorbed quietly. Neither changes a
public export — `filters/index.ts` is untouched.

| Change | Why it is here and not in a follow-up |
|---|---|
| phantom `__row` + `RowOfRule`, used by `anyOf` | The erasure was on `#111`'s list as owed to `#110`/`#112`. Asserting it without fixing it would have meant writing a test for behaviour the library does not have |
| `FlattenItem` discards `any` | Found while investigating why the spread case could not be asserted where a consumer writes it. Without it, the criterion is only satisfiable at a synthetic position |

### Three decisions taken during implementation

**Every body is inert, not just the type-only ones.** A shared `typecheckOnly(assertions)` helper
takes the closure and never calls it. Half the cases declare an empty group, a mismatched row or
an empty carrier — all of which `createFilters` throws on at construction — so running them was
never an option, and one uniform idiom beats a per-case split between "safe to run" and "not".
It also removes the `TestBed` dependency the runtime spec's `build<S>` helper needs.

**Cost, recorded rather than glossed:** `architecture.md`'s prior art
(`create-filters.spec.ts`'s `describe('types')` block) has bodies that *do* execute — only its
`expectTypeOf` calls are inert. Here nothing executes, so 13 `it()`s report green while asserting
nothing at runtime. That satisfies the issue's wording ("runs as a passing suite whose bodies are
inert") but "inert" means something stronger than it did in the doc that word came from.

**The row-type rejection was rewritten, not moved.** The issue says *"moved here rather than
being rewritten"*, and only the `@ts-expect-error` line survived verbatim. Its subject was rebuilt
inline because the original read `buildTypedFilters()`, which routes through the runtime spec's
`TestBed`-based `build<S>` helper — a dependency this file exists to not have. The fact asserted
is unchanged.

**`Flatten` recursed forever on `any`, and it was burying real errors.** Written inline as
`...applyWhen(…)`, the spread reported **`TS2589` (excessively deep)** at the whole
`createFilters(…)` call rather than `TS2488` at the spread. The first read blamed the spread and
moved the assertion to a `const` inside the schema body. That was wrong, and a compiled probe
said so: **`StateOf<[any]>` alone reproduces `TS2589`** with no spread anywhere.

Cause: a failed spread degrades its element type to `any`; `any` satisfies `readonly unknown[]`,
so `FlattenItem<any>` takes the array branch to `Flatten<any>`, which is `FlattenItem<any>` again.
The depth error is the fold eating itself, and it *replaces* the real diagnostic — so any future
mistake that produces an `any` in a schema array would have been reported as an unreadable
instantiation-depth error at the call site instead of at the mistake.

Fixed in `types.ts`: `FlattenItem` discards `any` first (`IsAny<T> = 0 extends 1 & T`), yielding
`never` — no key, which is the right degraded reading for an element that is already an error.
The spread case now sits inline where a consumer would write it, and reports
`TS2488: Type 'ConditionalRule<[FilterRule<"subCategory", string | null, Invoice>]>' must have a
'[Symbol.iterator]()' method` **on the spread expression itself**. The issue's criterion is met as
written, not at a synthetic position.

### `anyOf`'s row-type erasure — closed here, on the user's call

`issue-111-call-sites/progress.md` left this open and assigned it to `#110`/`#112`: the
homogeneity intersection's right half was `FilterRule<string, CriterionOf<C[0]>, unknown>`, so a
child built from an unrelated row's handle passed silently. Fixed rather than recorded as a hole.

The proposed fix — *"`RowOfRule<C[0]>` in the intersection alongside `CriterionOf<C[0]>`"* — did
not exist as written: **`TRow` was unrecoverable from a `FilterRule`.** `FilterRuleRecord<TRow>`
mentions it only in the optional `condition`, whose `valueOf` is generic in its own handle, so
nothing distinguished two rules built from different rows. `CriterionOf` works because
`__criterion` is a phantom member; `RowOfRule` needed the same, so `FilterRule` gained a phantom
`__row`. That is the whole reason the erasure existed.

Second open item from that list — *"blame lands on the innocent siblings"* (`C[0]` is the
reference, so an odd child in first position yields N−1 errors) — is **unchanged and still open**.
It applies to the row check exactly as it did to the criterion check.

### Verified

- `ngc -p libs/shared/table/tsconfig.spec.json --noEmit` — clean, source-clean on the first run,
  so the template phase was reached.
- Both failure modes probed, since the file has two and they fail differently. Breaking an
  `expectTypeOf` (`toEqualTypeOf<string>` → `<number>` on the `anyOf` group criterion) gives
  `TS2344`. Making a `@ts-expect-error` case compile (the `42` carrier → `rowOf<Invoice>()`)
  gives `TS2578: Unused '@ts-expect-error' directive`. Both reverted.
- The `anyOf` row check probed the same way: with the directive removed, the group of an `Invoice`
  child and a `Ticket` child gives `TS2322 … Type 'Ticket' is missing the following properties
  from type 'Invoice'` at the offending child.
- `nx run shared-table:typecheck` (lib) — no errors; the two `NG8107` warnings in
  `grouping-static-story-host.component.html` are pre-existing.
- `npx eslint` on the changed files — clean.

**Method note, worth carrying forward:** `ngc` colorizes its output, so the error line contains
`…[91merror[0m[90m TS2322…` and **`grep "error TS"` never matches it**. Three probe runs here
read as clean when they were not. Filter on `error` alone, or read the output unfiltered.

## Not planned here

| Issue | Scope | Run `/to-tasks` when |
|---|---|---|
| [#113](https://github.com/DvirMon/acme/issues/113) | docs, ADRs, `CLAUDE.md`, the design record | any time — merge after `#111` |

Status values: `⬚ pending`, `▶ in progress`, `✅ done`, `⏭ skipped`.
