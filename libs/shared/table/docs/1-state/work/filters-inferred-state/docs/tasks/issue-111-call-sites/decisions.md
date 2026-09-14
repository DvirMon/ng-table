# Decisions taken during `#111`

Five calls made mid-work, none of them settled by `spec.md`, `architecture.md` or the issue body.
Each records what forced the decision, what was rejected, and **what it costs** — so a later review
can reopen one without reconstructing the reasoning.

`progress.md` in this folder is the execution record; this file is only the decisions.

---

## D1 — Four sites name a criterion map where nothing infers it

**Forced by:** deleting the five `*FilterState` aliases. Four places named them outside a
`createFilters` call, so inference had nothing to work from: `keepValidCriteria()` (client host),
`serverFilterFormSchema` (filtering fixtures), `readRepCriterion`/`repFilterNode` (grouping utils),
and two annotations in `state.spec.ts`. `architecture.md`'s file-layout table lists none of them.

**Chosen:** derive locally, export nothing new. `ReturnType<typeof createDealFilters>` for the
grouping helpers; the debounce schema moved inline to `form(this.filters().value, (path) => …)`
where the model is concrete; `state.spec.ts` dropped one annotation and inlined the other.

**Rejected:** exporting a `CriterionMapOf<F>` utility from the filters barrel — smaller diff, but
it widens the public surface the epic exists to narrow. Also rejected: keeping the four aliases,
which contradicts the issue's own acceptance criteria.

**Cost:** the derivation is spelled out at each site rather than named once —
`ReturnType<typeof createDealFilters>` appears twice in `grouping/fixtures/utils.ts`. And it did
not survive contact with the client host: see **D5**.

**Revisit if:** a fifth site needs it. Two already did, which is most of the argument for the
rejected option.

---

## D2 — `hasAny`/`hasNone` discard their cell's element type

**Forced by:** `TS2345` at the selection and server hosts. Both rules hardcoded criterion
`readonly unknown[]`, so `filters.tags().value` became `WritableSignal<readonly unknown[]>` and
`toggleOption(selected: readonly string[], …)` rejected it. The hand-written maps had been
restoring `readonly string[]` by hand; inference cannot.

**Chosen:** a `TItem = ItemOf<TRow[K]>` type parameter on both rules, with a new internal `ItemOf`
in `types.ts`. Call sites are unchanged. Placed **last** in the parameter list, after `TAs`, so
positional type arguments keep working (that ordering was a `/code-review` correction — it first
went in third).

**Rejected:** swapping both sites to `filter()` + the shipped `hasAnyOf`/`hasNoneOf` matchers,
which would leave two shipped rules with no showcase anywhere; and narrowing at the call site with
`isStringArray`, which puts a guard in a story whose job is to read as clean consumer code.

**Cost:** `#111` was scoped to call sites and this changes the library.

---

## D3 — `applyWhen` never infers `TRow`

**Forced by:** three errors at the gated call sites. `applyWhen`'s only `TRow` inference site is
`path: FiltersPath<TRow>`, and `FiltersPath` is a conditional type — never an inference site. So
`TRow` collapsed to `unknown`, `valueOf` became `(handle: FilterHandle<unknown, never>) => …`, and
every real handle was rejected. `rules.ts` asserted the opposite in a comment directly above the
signature; that comment is now corrected.

**Chosen:** make `valueOf` generic in its own handle. The row type was never load-bearing — the
body looks up `handle.id` and returns `unknown`.

**Rejected:** restructuring `FiltersPath` so the mapped half is an inference site (widest blast
radius — every rule's `path` flows through it, and inference through a non-homomorphic mapped type
is not guaranteed); and dropping the vestigial `path` parameter, which the architecture's own open
question #1 already ruled against on Signal Forms parity.

**Cost — the one to weigh on review:** `valueOf` now accepts a handle from **any** row type.
Verified by probe. The mitigation is that the fixed signature never delivered that safety in this
position either — it rejected correct handles too — so this is not a regression against working
behaviour, but it is not free. `TRow` on `FilterValueOfContext` survives only as a generic default
and no longer distinguishes two contexts.

**Also worth knowing:** the implementation is a contextual annotation
(`const context: FilterValueOfContext<TRow> = { valueOf(handle) {…} }`), not a re-declared
signature. Two generic signatures whose defaults reference different type parameters do not unify,
so re-declaring produced a `TS2322` between two signatures that print identically.

---

## D4 — The `emptyValue`-override test — **decided twice**

**Forced by:** `equals(path.status, { emptyValue: '' })` infers criterion `TRow[K] | TEmpty` =
`string`. One spec case wrote `null` into it. The old hand-written map said `status: string | null`
— wider than the rule permits, describing `equals`' default empty while the same call overrode that
empty away.

**First decided: delete the case.** That decision rested on a claim that turned out to be false —
that two sibling cases already covered the contract.

**Reversed at `/code-review`: restored behind `@ts-expect-error`.** All three surviving cases in
that `describe` assert only that the **declared** empty (`''`) is empty. None covers the other half
of `resolveEmptiness`'s contract at `rules.ts:61` — that the rule's own `null` stops counting as
empty once overridden. The same diff already sets the precedent 90 lines earlier: empty-`anyOf` is
kept with `@ts-expect-error` as an untyped-caller backstop. Same shape, same treatment.

**Cost:** a test that needs a suppression to compile is guarding a path typed consumers cannot
reach. That is exactly what a backstop is, but it is a fair thing to challenge.

---

## D5 — `keepValidCriteria` lost its drift check

**Forced by:** `/code-review`. **D1**'s "derive locally" answer does not work at this one site —
`keepValidCriteria` is module-level, above the class, and `filters` was `protected`, so
`ReturnType<ClientFilteringStoryHostComponent['filters']>` could not be written. The implementing
agent fell back to an inferred return built by spread. That compiles, but an inferred object
assigned to a variable defeats excess-property checking, so a renamed schema key would pass
`reset()` **silently** — the precise protection the function's own JSDoc claims to provide.

**Chosen:** make `filters` public on the story host purely so a module-level `ClientCriteria` can
derive from it. The six named `if` guards came back with it, which also cleared a
`declarative-naming.md` breach (six inline ternaries). `reset(STALE_SAVED_FILTER as never)` — a
strictly weaker escape than what it replaced — became `as Partial<ClientCriteria>`, recovering the
original assertion from the inferred map.

**Rejected:** reversing **D1** and exporting `CriterionMapOf<F>`; and accepting the lost check on
the grounds that this is only a story fixture.

**Cost:** one member is public for a type-level reason, not because anything reads it. The comment
on the field says so.

---

## Not decided here

`anyOf`'s homogeneity intersection checks the criterion but **erases the row type**
(`FilterRule<string, CriterionOf<C[0]>, unknown>`), so a child built from an unrelated row's handle
compiles clean. Proposed fix — add `RowOfRule<C[0]>` to the intersection, same zero-inference-cost
shape — belongs to `#112`, which owns the type seam. A second, cheaper-to-live-with quirk: `C[0]`
is the reference, so an odd child in first position yields N−1 errors on its innocent siblings.
