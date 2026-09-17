---
title: Decisions — derived state declared on the feature that owns it
type: decisions
status: in progress
date: 2026-09-12
audience: developers
---

# Decisions

Grill log for this work folder. Typing evidence: [`2-research.md`](2-research.md). One line per settled decision, dated. Discussion lives
in the conversation; only outcomes land here.

## Where this landed (read this first)

D1-D18 are a record of the search, not the outcome — most are superseded. The contract is **D19-D22**:

- Features stop carrying `TRow`. A feature is `Feature<In, Out>` and recovers the row type as
  `RowOf<In>`, the way NgRx recovers it from `withState` (**D20**).
- Composition is positional — `createTable(data, cfg, f1, f2, …)` — with per-arity overloads.
  Argument order becomes semantic for member visibility; the arity ceiling (default 15) is the one
  accepted limitation, worked around by nesting a `composeFeatures(...)` composite into one slot
  (**D21**).
- A derive block **is** a feature. `withComputed(fn)` returns `Feature<In, D>`, so it composes
  both inside a feature (`withSelection(cfg, withComputed(fn))`) and as its own slot. No
  `DeriveSpec` type exists (**D22**, retiring D7/D8/D10 and D6's object-literal rule).
- Nothing needs an explicit `<TRow>`. The functional surface was kept only because removing `TRow`
  from the feature type made it typable (**D19**).

Typing evidence, with every route tried and its verdict: [`2-research.md`](2-research.md).
`2-design.md` was deleted — in-line references to it below are historical.

## Question graph (recorded per `decompose-by-dependency-graph`, 2026-09-12)

The design closes with 8 open questions. Mapped as nodes before interviewing, so they are asked in
dependency order rather than document order:

```
        Q1 scope                      Q6 currying (R1)        Q4 core-key pre-claim
   (single-owner vs cross)            [independent]              [independent]
        /        \                                                    |
       v          v                                                   v
   Q2 __requires   Q3 DerivedDict                                Q7 renderRows/totalRowCount
    carrier            |                                          on TableCore
                       v
                   Q5 throw vs degrade
                       |
                       v
                  Q8 spike before spec  <---- (also gated by Q1, Q2)
```

- **Core:** Q1 (does the cross-feature path get built now?) — Q2 and Q3 both change meaning
  depending on it.
- **Independent, grill now, in parallel:** Q4 (pre-existing core-key shadowing hole), Q6 (currying
  churn — forced by TypeScript, affects every call site regardless of Q1).
- **Dependent:** Q2 and Q3 after Q1; Q5 after Q3 (the guard is only total over signals); Q7 pairs
  with Q4 (`totalRowCount` override); Q8 last — it is a judgement over everything above.

Accepted risk per the rule: an edge marked absent may surface later; fix that edge then rather than
re-litigating the graph.

## Decisions

- **D1 (2026-09-12) — the mechanism ships single-owner only.** The `computed` config block lands
  now and covers the four single-owner cases (`hiddenSelected`, `expansionState`, filtered match
  count, O17 validity). §4's `Requires` third type parameter and `MissingKeys<>` gate stay in
  `2-design.md` as designed-and-typing-verified, but **unbuilt** — its only caller (grouping X-G1)
  is blocked on semantics that are not recorded anywhere yet ("is a group header a row or a view",
  `grouping.md` §6). Nothing is foreclosed: the phantom is additive and defaults to
  `Record<never, never>`, so adding it later changes no existing feature's type.
  → Q2 (is `__requires` the right carrier) is **deferred with it**, not answered.

- **D2 (2026-09-12) — `2-design.md` R1 (curry every feature factory) is withdrawn; it was wrong.**
  Verified: with the explicit type argument omitted, the callback parameter resolves to
  `TableStore<NoInfer<Invoice>> & SelectionMembers` — `TRow` flows in through the features-array
  constraint (`TableFeature<NoInfer<TRow>, any>`, the `5a3a09d` mechanism) and `D` infers from the
  callback's return **in the same call**. No currying, no second call shape, and no churn to
  existing call sites. R1's premise — that call sites must pin `<TRow>` — is what `5a3a09d`
  already removed.

- **D3 (2026-09-12) — the explicit-generic trap is closed by overloads, not by documentation.**
  `withSelection<Invoice>({ computed })` would otherwise type-check while dropping every derived
  member from the store type (runtime keeps them; the consumer's *read* takes the blame, in another
  file). Two overloads, with **no default on `D`** in the derive form, move the error to the
  declaration: `TS2353: 'computed' does not exist in type 'WithSelectionConfig<Invoice>'`, pointing
  at the offending key. `withSelection()`, `withSelection({ computed })` and the legacy
  `withSelection<Invoice>()` all keep working.
  → This is `2-design.md` R2, kept but re-justified: the reason is the explicit-generic trap, not
  §4's requirement gate (which D1 defers).

- **D4 (2026-09-12) — core member keys are pre-claimed; `totalRowCount` is the one override slot.**
  `SlotRegistry` claims `rows`, `value`, `columns`, `trackBy`, `renderRows` before the fold, so a
  feature or `computed` block declaring one throws at construction with the key named, like any
  other member collision (ADR-0007). `totalRowCount` stays deliberately unclaimed — `TableStore`'s
  own doc comment promises pagination/virtualization may override it (ADR-0005).
  Verified severity: today the collision is not merely silent, it is a **type lie** — the colliding
  declarations intersect into an overloaded call signature
  (`(() => Invoice[]) & { [SIGNAL] } & (() => string[])`), overload resolution picks the *first*, so
  `table.rows()` types as `Invoice[]` while runtime returns the shadowing feature's `string[]`. No
  error at the declaration or the call.
  Prior art checked and **rejected as a model**: `@ngrx/signals` 22.0.1 warns instead of throwing,
  the warn is dev-only (`if (typeof ngDevMode !== 'undefined' && ngDevMode)` at each caller), its
  message ("SignalStore members cannot be overridden") is false since every merge is
  last-writer-wins, and their final assembly `{...stateSignals, ...props, ...methods}` performs no
  check at all — so a method silently beats a state signal of the same name. Their only truly
  protected member, `STATE_SOURCE`, is protected by being a Symbol (unnameable), which does not
  transfer: our core members are public API by name.

- **D5 (2026-09-12) — the surface is `composeFeatures(...)` only; the per-feature `computed` config
  block is dropped, and D1's deferral of cross-feature derivation is reversed.** Features are passed
  as *arguments* to a helper instead of elements of an array literal, which restores NgRx-style
  accumulation: the derive block sees core plus **every** feature handed to the helper, fully typed
  and inferred, with no explicit type arguments. Verified with four features —
  `TableStore<Invoice> & SelectionMembers & { sort } & { expandedRows } & GroupingMembers<Invoice>`.
  Supersedes: D1 (single-owner only), D2/D3's overload guard (no longer needed — there is no
  per-feature `computed` key to mis-spell), and `2-design.md` §4's `__requires` gate, which existed
  only to compensate for the missing accumulation.

- **D6 (2026-09-12) — no arity ceiling, and the derive is a named object block.** The ceiling in
  `@ngrx/signals` (#4314, 15 features) comes from per-arity overloads, which they need because each
  slot gets a *different* accumulated view. Ours is always last and wants the whole-tuple
  intersection, so one variadic signature covers every length:
  `composeFeatures<const Fs, D>(...args: [...Fs, DeriveBlock<Fs, D>])` with
  `UnionToIntersection<MembersOf<Fs[number]>>`. **Two signatures total** — one with the block, one
  without — not one per arity.
  The block must be an object (`{ computed: (store) => ({...}) }`), never a bare callback: a
  `TableFeature` is itself a function, so a trailing feature is misparsed as the derive callback —
  verified, `grouping` silently degraded to `Signal<unknown>`. An object literal cannot be confused
  with a feature.

- **Tree-shaking is not a constraint here** (checked, 2026-09-12). The belief that the `features`
  array was required for tree-shaking is already recorded as mistaken in
  `work/drop-ngrx-engine/2-decisions.md:39-40` and `architecture.md:201` — both shapes import
  features top-level. What breaks tree-shaking is a registry/namespace object (`f.expansion()`,
  `architecture.md:193`), which this is not. `composeFeatures` also leaves the `composed` seam
  untouched: its arguments are feature *functions*, not specs, so `composeTable` still calls them
  during the fold and the returned tuple is identical to the array literal.

- **D7 (2026-09-12) — the derive block returns signals only.** `DerivedDict =
  Record<string, Signal<unknown>>`. Every returned member is a memoized graph leaf, which keeps the
  ADR-0014 guard total (it can wrap everything the block produces) and keeps the key name `computed`
  honest. Parameterized selectors (`selectionStateOf(ids)`, a future `groupDescendantIds(id)`) stay
  **feature members**, where the one that exists already lives — the block composes them, it does not
  replace them. Mirrors `withComputed`'s constraint rather than `withProps`' arbitrary `object`;
  NgRx needed the second surface because their store also carries services and observables, which
  ours does not.

- **D8 (2026-09-12) — the derive block is applied after the fold, not as a feature.**
  `composeFeatures` marks its last element as a derive spec; `composeTable` runs it once the store
  object exists (`{ ...core, ...composed, renderRows, totalRowCount }`), then claims each returned
  key through `SlotRegistry` and assigns them onto that same object, before `setup` hooks run.
  Rationale: the block's parameter type is `TableStore<TRow> & AllMembers<Fs>`, and `TableStore`
  includes `renderRows` and `totalRowCount` — both built *after* the fold — so a block running
  during the fold could not honour its own type. Running it post-fold makes everything it reads
  concrete, which also **retires `2-design.md` §5's lazy view entirely**: no getters, no
  slot-filled-later, and no "eager read returns `undefined`" hazard. A `setup` hook can read derived
  members, since setups run last.
  Implementation consequence: `composeFeatures` returns `readonly [...Fs, DeriveSpec]`, so
  `composeTable` must recognise that final element rather than calling it as a feature.

- **D9 (2026-09-12) — errors: throw at construction; at evaluation, name the member and rethrow.**
  The block body runs at construction (D8), so a throw there is a wiring error under ADR-0014 —
  it throws, wrapped with context naming the block.
  For a derived signal throwing during evaluation, verified against installed Angular source
  (`@angular/core/fesm2022/_untracked-chunk.mjs`, same pattern at `_effect-chunk.mjs:304-306`):
  Angular **already** wraps every computation in `try/catch`, stores `node.value = ERRORED` plus
  `node.error`, and the getter rethrows that same error on every read. The error is cached like a
  value — the computation is not retried until a dependency changes.
  So the decision is not whether to catch. It is whether to add a wrapper that attaches the member
  name, which Angular's stack cannot supply (it reports an anonymous `computed`). **We wrap:** one
  `try/catch` per returned key, reporting `[createTable] derived member "<key>" threw`, then
  rethrowing. Behavior is otherwise unchanged, and "once per evaluation" falls out of Angular's
  error caching rather than needing dedupe logic of our own.
  Rejected: degrading to a fallback — there is no neutral value for an unknown `T`, `undefined`
  surfaces as `NaN` downstream against a `Signal<number>` type, and a retained last-good value reads
  as correct while being wrong. It would also fight the graph's own design.
  Same file confirms the self-reference hazard: `producerRecomputeValue` throws
  `Detected cycle in computations.` on re-entry — i.e. at first read, not at construction.

- **D10 (2026-09-12) — exactly one derive block per table.** A second derive spec reaching
  `composeTable` throws at construction, in the same class as a slot or member collision
  (ADR-0007). Every derived member is therefore in one place, typed against one explicit feature
  list. Consequence to spec: `composeFeatures` returns a spreadable tuple, so the guard is a runtime
  check in `composeTable` (count the derive specs), not something the type system prevents — and
  the message must say so plainly ("only one derive block per table; found 2").

- **D11 (2026-09-12) — a block returning a non-signal throws at construction.** `DerivedDict` is a
  type-level constraint only, so a JavaScript consumer (or an `as any`) can return a plain value.
  That is a wiring error by ADR-0014's classification — deterministic, fires on first run, no
  correct degraded reading — so `composeTable` validates each returned value with `isSignal()` and
  throws, naming the key. Consistent with D4's posture: the alternative is a member that looks like
  a signal to every consumer and is not one.
  Flagged for review: this is the one guard here that costs a runtime loop over the returned keys.
  It is O(derived members), once, at construction.

- **D12 (2026-09-12) — no spike; go straight to spec.** The typing is verified end to end against
  the real library types, and D8 shrank the runtime to mechanical work: recognise the derive spec,
  run it post-fold, claim each key, wrap it, assign. No novel reactive behavior is left — Angular's
  own error caching (D9) replaced the dedupe logic the earlier design owed, and the lazy view is
  gone. Remaining implementation risk belongs in PR review, not a throwaway branch.

- **Complexity: `isComplex: true`.** This changes the feature contract (`composeFeatures`, a derive
  spec recognised by `composeTable`, core-key pre-claiming) and adds new public types. It needs an
  architecture doc grounded against `engine/compose-table.ts` and `engine/slots.ts` before anyone
  builds it, and it owes ADR-0014 a new row plus, most likely, an ADR of its own (same bar as
  ADR-0007, which this supersedes in part).

- **D13 (2026-09-12) — both surfaces ship; the per-feature block is the default.** This restores the
  original ask, which D5 had dropped.
  - `withSelection({ computed: (t) => ({...}) })` — derivations over **core + that feature's own
    members**. Covers four of the five real cases. No helper, no generics: verified that `TRow`
    infers from `data` and `D` from the block in the same call (`t` resolved to
    `TableStore<NoInfer<Invoice>> & SelectionMembers`, with `row.total` type-checking).
  - `composeFeatures(f1, f2, { computed })` — only when a derivation genuinely **spans features**
    (the group-tick case). Sees core + every feature passed.
  Consequently **D3 is revived** (the two-overload guard against `withSelection<Invoice>({ computed })`
  silently dropping members) and **D2 stays withdrawn** (no currying — the per-feature form needs
  none). D1's deferral remains reversed; D10's one-block rule now applies per `composeFeatures` call.

- **D14 (2026-09-12) — `composeFeatures` requires an explicit `<TRow>` on every feature inside it.**
  Not cosmetic; load-bearing, and two routes to avoid it were tried and failed:
  **five** routes were tried and all fail identically — (1) inferring `TRow` from the contextual
  config position, (2) deriving it via `RowOf<Fs[0]>` with a generic on the first feature only,
  (3) currying it explicitly (`composeFeatures<Invoice>()(...)`), (4) passing it through a
  callback token from `createTable`, (5) fixed-arity parameter slots instead of a variadic rest —
  plus the variants with `NoInfer` on the helper constraint and with the `TRow = unknown` default
  removed.
  Diagnosis: `TRow` *does* reach the helper (the target type is correctly
  `TableFeature<NoInfer<Invoice>, any>` in every case). What fails is the **inner call** — a bare
  `withSelection()` one level down is not contextually typed from it and resolves to
  `TableFeature<unknown, ...>`, which contravariance on `core` then rejects. The array form works
  precisely because the feature call sits *directly* in `features:`, where the element's contextual
  type comes from the same call that infers `TRow` from `data`; one call deeper, that link is gone.
  This is a real ergonomic cost of the cross-feature surface and a reason the per-feature block is
  the default (D13). Anyone revisiting should attack the inner-call inference, not the helper's
  type parameters — that part already works.

- **Correction (2026-09-12) — `2-design.md` §9 wrongly rejected the config-thunk `computed:` key.**
  That rejection came from an unverified prediction (that the thunk turning context-sensitive would
  collapse the callback parameter to `any`). Probed: it **works**, precisely — with no features the
  block types over core alone; reading a composed feature is typed; reading a non-composed one is a
  compile error (`Property 'grouping' does not exist on type 'TableStore<Invoice> & SelectionMembers'`),
  and features need no generics. It was **considered and not chosen** (D13 keeps the per-feature
  block plus `composeFeatures`); recorded here so the rejection is not cited later as a verified
  finding. A future revisit should weigh it on ergonomics, not on the false claim that it cannot type.

- **D15 (2026-09-12, corrected) — a composable `withComputed(...)` IS possible; the earlier
  "contextual types never survive one call deeper" rule was wrong.** A first probe
  (`composeFeatures(f1, f2, withComputed(fn))` over a variadic rest) left the callback parameter
  `unknown`, and that was over-generalised into a rule. The faithful NgRx port works — verified,
  `probe-withcomputed.ts.txt`: `store` types as
  `TableStore<Invoice> & SelectionMembers & GroupingMembers<Invoice>`.
  Three conditions must hold **together**, and they are exactly what `signalStore` does:
  1. **Fixed parameter slots** (one overload per arity), not a variadic rest — earlier slots must
     already have inference candidates when the derive slot is checked.
  2. **Type params in real parameter positions, not constraints.** `f1: TableFeature<TRow, M1>`
     infers; `F1 extends TableFeature<TRow, any>` does not — a constraint never drives inference.
  3. **The accumulated type appears in `withComputed`'s RETURN type**
     (`withComputed<TRow, Acc, D>(fn): DeriveSpec<TRow, Acc, D>`), so TS unifies `Acc` from the
     contextual parameter type and only then types the callback. This mirrors ngrx's `Input`
     appearing in `SignalStoreFeature<Input, Output>`.
  Cost of taking it: the per-arity ceiling returns (D6's variadic form has none).

- **D16 (2026-09-12) — explicit `<TRow>` on features cannot be removed inside any helper, and the
  reason is structural.** Verified in the working NgRx port too: dropping the generic from the
  second feature slides overload resolution to the wrong arity, members vanish from `store`, and the
  derived member degrades to `Signal<any>`.
  **NgRx has no equivalent problem because their features carry no row type at all** — the row type
  lives in state (`withState({ books: [] as Book[] })`), so `withEntities()`/`withComputed()` have
  nothing to pin. Ours must: `withSelection`'s core slice is `Pick<TableCore<TRow>, 'rows' |
  'trackBy'>` and `canMultiSelect(row)` needs the row type. Only a feature sitting **directly** in
  `features:` can infer `TRow`, because that is the same call that infers it from `data`.
  **Consequent trade, to be settled before spec:** composable `withComputed(...)` + explicit
  generics + an arity ceiling, *or* the plain array + inline object literal + no generics. Both are
  verified working; they cannot be combined.

- **D17 (2026-09-12) — `withComputed()` composes *inside a feature*, with no generics. This is the
  best available shape and it supersedes D13's inline literal.** Verified
  (`probe-feature-withcomputed.ts.txt`):

  ```ts
  features: [
    withSelection(withComputed((store) => ({
      hiddenSelected: computed(() => store.selectedRows().size - store.rows().length),
    }))),
    withGrouping(),
  ]
  ```
  `store` resolves to `TableStore<NoInfer<Invoice>> & SelectionMembers` and `hiddenSelected` lands as
  `Signal<number>` — with `withSelection` called **bare**, no `<Invoice>`.
  Why it works where the same wrapper failed inside `composeFeatures` (D15): the nested call's
  contextual type is **fully resolved** at check time — `SelectionMembers` is concrete in
  `withSelection`'s own signature, and `TRow` comes from the direct `features:` position. Nothing is
  still being inferred. The rule is not "one call deeper fails"; it is **"a nested call is typed only
  when its contextual type contains nothing still being inferred."**

- **D18 (2026-09-12) — supplying `TRow` once to a helper does not remove the per-feature generics.**
  Tried `composeFor<Invoice>()(withSelection(), withGrouping(), withComputed(...))` with parameters
  deliberately not `NoInfer`-wrapped. `TRow` does arrive, but the **members** do not: `M1`/`M2` infer
  as `{}` from a bare feature call, so `store` came back as `TableStore<Invoice>` with
  `selectedRows`/`grouping` absent and the derived member degraded to `Signal<any>`. Row type and
  member types need the same inference site, and only the direct `features:` position provides it.
  So for the **cross-feature** helper the explicit `<Invoice>` stands (D14/D16) — it is not avoidable
  by supplying the row type internally.

## Owed to other documents

- `2-design.md` — deleted; its surviving content is folded into `2-research.md` and D4/D9/D11.
- ADR-0014 — a new row for the derived-member evaluation error (D9).
- ADR-0007 — extended, not replaced: member claiming now covers core keys (D4).
- `state-persistence.md` — derived members are excluded from any snapshot slice by construction.
- `CLAUDE.md` — the feature-plugin pattern section describes `features: [...]` only; `composeFeatures`
  and the derive block need to land there once shipped.

- **D19 (2026-09-12) — the functional (argument-passing) surface is abandoned. Generic-free
  composition exists, but only in the `features: [...]` array position.** Nine further routes were
  probed this session on top of D14's five; evidence in `probe-p[u-z]-*.ts.txt` /
  `probe-q[1-8]-*.ts.txt`. Summary:
  - **Works, zero generics, array position only:** a sibling config key
    `computed: (store) => ({...})` typed over `TableStore<TRow> & ComposedFeatureMembers<Fs>`
    (`probe-pu-helper.ts.txt`, case A) — cross-feature derivation with every feature called bare.
  - **Works even better, still array position:** replacing `TableFeature<TRow, Members>` with a
    *row-agnostic* feature value — `FeatureDef<Kind, TRow(phantom), Derived>` whose `create` is
    `<T>(core: TableCore<T>) => spec`, plus a type-level `FeatureMembersMap<TRow>` keyed by kind
    (`probe-q7-final.ts.txt`). Under it, with **no generics anywhere**: row-typed feature config
    (`sel({ canMultiSelect: (row) => row.total > 0 })` gives `row: Invoice`), per-feature
    `sel(withComputed(...))`, per-feature derive on a second feature, the cross-feature `computed:`
    key reading both, third-party features joining by declaration merging, and correct negatives
    (uncomposed member, bad row field, selection-scoped derive cannot see grouping).
  - **Fails, every functional form** (`probe-q8-functional.ts.txt`): features as rest arguments to
    `createTable`; rest arguments with a trailing derive; `composeFeatures(...)` nested in the
    config. All three compose *members* correctly, and all three lose the **row type at the inner
    call** — `row` degrades to `never` (rest args) or silently to `any` (nested helper), and a
    per-feature `withComputed` sees `TableStore<unknown>`.
  - Also failed: `computed: withComputed(fn)` in the config key (`Signal<any>`); curried
    `composeFor<Invoice>()` with constraint-style parameters; a variadic helper taking `TRow` from
    its contextual return type — the last two die on `TableCore` **invariance**
    (`columns: WritableView<ColumnDef<TRow>[]>`), so a bare feature's `TableFeature<unknown, …>` is
    rejected outright.
  **Root cause, now stated once:** only a call sitting *directly* in `features:` shares the
  inference site that fixes `TRow` from `data`. Any wrapper — array-to-arguments or otherwise —
  puts one call between them, and the row type is gone. Members survive that hop; the row type
  never does.
  **Decision (user, 2026-09-12):** the functional surface is dropped rather than bought with
  explicit `<TRow>` per feature. `composeFeatures` is off the table; D5/D6/D13's helper half and
  D15/D16's NgRx port are closed. What remains for the spec is the array plus the two derive
  placements verified above.
  Two secondary findings worth keeping, both from `probe-q6-anyslot.ts.txt`:
  `any` in a constraint's derived slot infers `D = any` and `UnionToIntersection<… | any>` collapses
  the **whole store** to `any` (silent) — guard with `IsAny<D> extends true ? {} : D`; and an
  omitted optional `computed:` infers its type parameter as its *constraint*, leaking
  `& Record<string, Signal<unknown>>` onto the store — guard the same way.

- **D20 (2026-09-12) — a full port of NgRx SignalStore's architecture removes the generics in the
  functional form; the blocker was never arguments-vs-array.** Verified, `probe-q9-ngrxarch.ts.txt`.
  The mechanism NgRx actually relies on is that **features carry no row type at all** — the row
  lives in state (`withState({ books: [] as Book[] })`) and each slot recovers it from the
  accumulated input. Port that and ours behave identically:
  ```ts
  createTable(data, () => ({ trackBy: 'id', columns }),
    withSelection({ canMultiSelect: (row) => row.total > 0 }),  // row: Invoice
    withGrouping(),
    withComputed((store) => ({ tick: computed(() => store.selectedRows().size + store.grouping().length) })),
  ); // TableStore<Invoice> & SelectionMembers & GroupingMembers<Invoice> & { tick: Signal<number> }
  ```
  Feature signature becomes `Feature<In extends Shape, Out>` with the row read back as
  `RowOf<In> = In extends { rows: Signal<readonly (infer R)[]> } ? R : never`; per-arity overloads
  type slot N against `TableStore<TRow> & O1 & … & O(N-1)`. Bare calls throughout, row-typed config
  included. Ordering is enforced correctly as a negative: a `withComputed` in slot 1 cannot see
  slot 3's members. D15/D16's earlier "port" kept `TableFeature<TRow, Members>` in argument
  position — our contract relocated, not their architecture — which is why it needed explicit
  `<TRow>` and why D16's diagnosis (*"NgRx has no equivalent problem because their features carry
  no row type"*) was the answer all along rather than an aside.

- **D21 (2026-09-12, user) — the NgRx-shaped positional surface is chosen.** Three costs were put
  to the user; two accepted, one accepted as the only real limit:
  - **Ordering becomes semantic** (slot N sees only preceding slots), retiring today's order-free
    fold and the reason D37/A2 gave for `createEditingStore()`. Accepted — *"I do not think I need
    ordering in the features."*
  - **Call-site churn** — every `createTable` call and every `with-*()` file changes shape.
    Accepted.
  - **Arity ceiling** — the one limitation acknowledged as real. It is a type-level artifact only
    (runtime already takes `...features`), so it cannot be raised at runtime, by configuration, or
    by DI: an injection token has a single declared type, so `inject(TABLE_FEATURES)` yields
    `TableFeature<any, any>[]` and every derived member degrades to `any`; recovering the types
    means naming them explicitly, which is the cost this whole session removed. DI stays scoped to
    feature *config*, not composition.
  Escape hatch, NgRx's own (`signalStoreFeature`): nest a group of features into one composite that
  accumulates internally and consumes a single slot, so N slots × groups is unbounded and still
  fully typed. To spec: the overload count (default 15 — 14 features plus one `withComputed`), the
  composite helper, and the error a consumer sees past the ceiling
  (`No overload matches this call`).
  Recorded against the goal the user stated for the library — *"composable as fuck"* — so the
  ceiling is the one trade to revisit first if it ever bites.

- **D22 (2026-09-12) — under D21's architecture a derive block *is* a feature; one type serves both
  placements, and the nesting escape hatch type-checks.** Verified, `probe-r2-onetype.ts.txt`:
  - **Feature-scoped derive** (the original ask) — `withSelection(withComputed((store) => …))` with
    `store: TableStore<Invoice> & SelectionMembers`, contributing `hiddenSelected` to the composed
    store. Config and derive together in one call keep `row: Invoice`.
  - **Nested composite** — `composeFeatures(withSelection(), withGrouping())` occupies a single
    slot, and the following `withComputed` slot still sees
    `TableStore<Invoice> & SelectionMembers & GroupingMembers<Invoice>`. This is the ceiling
    workaround from D21, now type-verified rather than assumed.
  The simplification that makes it work: `withComputed` returns `Feature<In, D>` — the same type a
  feature returns — so the in-feature parameter is `Feature<In & SelectionMembers, D>` and no
  separate `DeriveSpec` carrier exists. Retires D7/D8's `DeriveSpec`, D10's "one derive block per
  table" (blocks are features; `SlotRegistry` member claiming already governs duplicates) and D6's
  "must be an object literal, never a bare callback" (the ambiguity was specific to the array).
  Counter-evidence kept: returning `DeriveSpec<In, D> & Feature<In, D>` (an intersection) **breaks**
  slot inference — the composite's output degrades to `Shape` and the derived member to
  `Signal<any>` (`probe-r1-featurederive.ts.txt`). One return type, not an intersection.

## Owed to other documents (updated after D21)

- `ADR-0003` / `docs/1-state/architecture.md` §"Rejected: inferring TRow into with-*() calls" — the
  rejection is overturned; record the mechanism (features carry no row type; `RowOf<In>`).
- `api/types.ts` — `AnyTableFeature`'s doc comment states consumers must repeat `<TRow>` on every
  feature call. False under D20; rewrite with the ADR link.
- `CLAUDE.md` — the feature-plugin pattern section and the `features: [...]` composition example
  both change shape, as does "Array order does NOT set execution order" (D21 makes argument order
  semantic for *member visibility*; pipeline order stays fixed).
- D37/A2's rationale for `createEditingStore()` (order-free sharing) is no longer load-bearing —
  note it, do not rip it out.
- ADR-0014 (derived-member evaluation error, D9), ADR-0007 (core-key claiming, D4),
  `state-persistence.md` (derived state excluded from snapshots — the row is still **owed**, the
  doc says nothing today) — unchanged by D21.
- `CLAUDE.md` §"Feature plugin pattern" states *"No feature uses [`composed`]"* — false, grouping
  reads `expandedRows` through it (D25). Rewrite alongside the composition example.
- `CLAUDE.md` — migration before/after table (spec story 28; review finding 10).
- ADR-0005 — one sentence on how a feature legitimately claims the `totalRowCount` override
  (architecture OQ5).
- Also see [`review-spec-architecture.md`](review-spec-architecture.md) — applied 2026-09-12.

- **D23 (2026-09-12, superseded by D24) — the config thunk can become a slot.** Verified that
  `withRows(data, { trackBy })` as a root slot carries the row type, NgRx's `withState` position.
  Dropped on the user's call: `with*` is reserved for **optional** features, and rows/columns are
  required, so wrapping them in one reads as opt-in when it is not.
  Detail, since it is no longer the shape: `createTable`'s first argument would be a root slot
  `withRows(data, { trackBy })` carrying the row type into the chain — NgRx's `withState` position —
  and `withColumns(columns, schema?)` is an ordinary slot typed by `RowOf<In>`. Confirmed in one
  call: the schema callback receives the real `ColumnsPath<Invoice>` proxy, `canMultiSelect`'s row is
  `Invoice`, `withGrouping({ initial: ['status'] })` and `withSorting({ initial: [{ columnId:
  'total' }] })` autocomplete against `ColumnId<Invoice>`, both derive placements resolve, and
  `trackBy: 'nope'` is rejected (`'"nope"' is not assignable to TrackByConfig<Invoice>`).
  Two notes for the spec: a slot contributing no members should return `Feature<In, {}>` — typing it
  `object` leaves a cosmetic `& object` in the store type; and `composeTable` must recognise the root
  slot *before* the fold, since `trackBy` and the data signal are needed to build core.

- **D24 (2026-09-12) — the final call shape: `createTable(data, config, ...features)`.** Data is
  passed directly, required config stays a plain object, and `with*` names are reserved for optional
  features only — the user's rule: *"I want to make the `with` specific for features that are
  optional. The rows and columns are required for the table."* Verified end to end,
  `probe-r4-directdata.ts.txt`:
  ```ts
  createTable(
    this.data,
    { trackBy: 'id', columns, columnsSchema: (c) => [...] },   // c: ColumnsPath<Invoice>
    withSelection({ canMultiSelect: (row) => row.status === 'open' }, withComputed(...)),
    withGrouping({ initial: ['status'] }),
    withComputed((store) => ({ tick: ... })),
  )
  ```
  Checked in one call: `TRow` infers from `data` alone; the schema callback receives the real
  `ColumnsPath<Invoice>` proxy; row-typed feature config, both derive placements, and the full
  accumulated store type all resolve with no explicit generics; `createTable(data, config)` with no
  features returns plain `TableStore<Invoice>`; `trackBy: 'nope'` is rejected; and a `withComputed`
  in slot 1 cannot see a later slot's members (compile error, not a silent `any`).
  Consequences for the spec: the `optsFn` thunk disappears (arguments already evaluate once, and
  nothing about the config was ever reactive); `injector` moves from a trailing third parameter into
  the config object, since a trailing options argument cannot coexist with variadic slots; and
  `createTableSchema()` — which exists only to build that thunk — is either re-shaped to return the
  config object or dropped. `columnsSchema` keeps accepting both `ColumnsSchemaFn<TRow>` and a
  standalone `ColumnSchema<TRow>` value, and the always-spliced `wireColumnsSchemaAsync` step stays
  internal (ADR-0010 intact, no consumer-facing columns slot).

- **D25 (2026-09-12) — engine-internal reads, `composed` survivor, config builder.** Three gaps
  the review found (`review-spec-architecture.md` 1, 3, OQ1), settled together because each is a
  "what does a feature see" question:
  - `indexById` becomes a **public read-only** `TableStore` member. Both editing features read
    `core.indexById` today; a `Feature<In extends Shape>` reaches only what is on the store. It is
    a consumer-useful derivation (id → position in `data`) with no write path, so exposing it costs
    nothing. `baseColumns` stays engine-only: the column-schema wiring is spliced internally and
    keeps taking the core handle — it is never typed as a consumer `Feature`.
  - The spec's claim that no shipped feature reads `composed` was false: `withGrouping()` reads
    `composed['expandedRows']` lazily inside its group render stage, guarded. That read is kept as a
    lazy guarded read of the store handed in — works in either argument order at runtime; typed only
    when expansion precedes grouping. General rule recorded in the spec: types are stricter than
    runtime. `CLAUDE.md` repeats the false claim and owes a rewrite.
  - `createTableSchema()` is **removed** (spec recommendation, architecture OQ1). Every call site
    states `trackBy` explicitly, consistent with story 3.
- **D26 (2026-09-12) — no spike; the integrate-and-verify issue is the runtime verification.**
  D12 re-taken after D21's architecture change (architecture OQ4, research "still unverified:
  everything runtime"). User's call at `/to-issues`: proceed without a prototype branch. Runtime
  behaviour is first proven green as a whole on the integration branch (#43), with per-issue specs
  written against the positional form before then.
- **D27 (2026-09-12) — arity 15, overloads generated.** Architecture OQ2/OQ3 closed together:
  keep 15 (spec already decided it; nothing measured argues for less), and generate because
  `composeFeatures()` needs the same accumulating set — ~30 near-identical blocks — from a
  repo-side script under `tools/` whose committed output is checked for drift.
- **D28 (2026-09-12) — the read-only derive input is a type-level projection.** Spec story 16
  promised a compile error on write with no type behind it (review finding 4). The block receives
  the input with every write view's `.update` stripped by a mapped type; mutating *methods*
  features contribute stay visible (statically indistinguishable from queries) and not calling them
  is documented convention. The evaluation-error wrapper and the `isSignal()` check live inside
  `withComputed()`, never in the fold — a fold-level check would reject method members (review
  finding 2).
