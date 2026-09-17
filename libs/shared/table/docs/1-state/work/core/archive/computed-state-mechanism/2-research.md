---
title: Typing research — derived state and generic-free feature composition
type: research
status: closed, superseded by 3-decisions.md D19-D22
date: 2026-09-12
audience: developers
---

# Typing research

Consolidated record of the TypeScript work behind this design. Replaces the 17 scratch probe files
and the earlier `2-design.md`, both deleted — every verdict they carried is inlined below, with the
signature that produced it. Decisions live in [`3-decisions.md`](3-decisions.md); this file is the
*evidence*, not the contract.

Every verdict below was executed with `tsc --noEmit --strict` against the library's real types
(`TableStore`, `TableCore`, `SelectionMembers`, `GroupingMembers`, `ComposedFeatureMembers`,
`TableFeature`), never against stubs. Resolved types were read off deliberate `const _: never = x`
errors.

## The question

Can a consumer compose features **and** declare derived state without writing `<Invoice>` on every
call? Today `AnyTableFeature`'s doc comment says they must, and ADR-0003 records that as settled.

## The answer, in one line

`TRow` on the feature type is what blocks inference. Remove it — let each feature recover the row
type from the store shape it is handed — and every generic disappears.

```ts
type RowOf<S> = S extends { rows: Signal<readonly (infer R)[]> } ? R : never;
interface Feature<In extends Shape, Out extends object> { (input: In): Out }

declare function withSelection<In extends Shape, D extends DerivedDict = {}>(
  config?: SelCfg<RowOf<In>> | Feature<In & SelectionMembers, D>,
  derive?: Feature<In & SelectionMembers, D>
): Feature<In, SelectionMembers & D>;
```

## Why the row type could not survive a wrapper

Only a call sitting **directly** in the position that fixes `TRow` from `data` shares that inference
site. Put any call between them and the row type is gone — members survive the hop, `TRow` does not.
Concretely, `withSelection()` one level down resolves to `TableFeature<unknown, …>`, and
`TableCore` is **invariant** in `TRow` (`columns: WritableView<ColumnDef<TRow>[], …>`), so
`TableCore<Invoice>` is not assignable to `TableCore<unknown>` and the argument is rejected outright.

That is the whole story behind the fourteen failures below. It is also why D15's rule —
*"a nested call is typed only when its contextual type contains nothing still being inferred"* — is
necessary but not sufficient: the contextual type was resolved in several failing cases, and the row
type still did not arrive.

## Routes tried

Grouped by what they attempted. "Members" = do composed features' members reach the store type;
"Row" = does a row-typed config callback (`canMultiSelect: (row) => row.total`) get `Invoice`.

### Keeping `TableFeature<TRow, Members>` (our contract today)

| Route | Members | Row | Outcome |
|---|---|---|---|
| `features: [withSelection(), …]` — the array as it ships | ✅ | ✅ | works; the baseline |
| `computed:` as a sibling config key, plain arrow | ✅ | ✅ | works — cross-feature derive, no generics |
| `computed: withComputed(fn)` — same slot, wrapped | ❌ | — | `store: TableStore<Invoice>`, member `Signal<any>` |
| `withSelection(withComputed(fn))` — derive inside a feature | ✅ | ✅ | works (D17) |
| `composeFeatures(f1, f2, withComputed(fn))` variadic | ❌ | ❌ | callback parameter `unknown` |
| `composeFor<Invoice>()(…)` — curried row type | ❌ | ❌ | `M1`/`M2` infer `{}`; row type alone is not enough (D18) |
| Curried + constraint-style params (`F1 extends TableFeature<TRow, any>`) | ❌ | ❌ | `TableCore` invariance |
| Variadic taking `TRow` from its contextual return type | ❌ | ❌ | `TableStore<unknown>` |
| NgRx-style per-arity overloads over `TableFeature<TRow, M>` | ✅ | ✅ | works **only** with explicit `<TRow>` per feature (D15/D16) |

Also tried and failed inside the array: `RowOf<Fs[0]>`, a callback token from `createTable`,
fixed-arity parameter slots, `NoInfer` on the helper constraint, and dropping the `TRow = unknown`
default.

### Removing `TRow` from the feature type

Two schemes, both generic-free. This is the discovery that unblocked everything.

| Scheme | Shape | Verdict |
|---|---|---|
| **Kind map** | `FeatureDef<Kind, TRow(phantom), Derived>` + a type-level `FeatureMembersMap<TRow>` keyed by kind; `create` is `<T>(core: TableCore<T>) => spec` | works in the **array** position only — row-typed config, per-feature derive, cross-feature `computed:`, third-party features via declaration merging, all negatives correct |
| **NgRx architecture** (chosen, D21) | `Feature<In, Out>`; the row type is recovered as `RowOf<In>`, exactly as NgRx recovers it from `withState` | works in the **functional** position — same capabilities, plus ordering enforced as a negative (slot 1 cannot see slot 3's members) |

Under the kind map, the functional forms still fail: features as rest arguments to `createTable`
(row degrades to `never`), rest arguments with a trailing derive (derive sees no members), and
`composeFeatures(...)` nested in the config (row degrades **silently** to `any`). That asymmetry is
what forced the architecture question, and D21 answered it.

## Three silent-failure traps, each worth a guard in the shipped types

Neither produces an error at the declaration; both surface as `any` at a call site in another file.

1. **`any` in a constraint's derived slot** (`readonly Def<Kind, TRow, any>[]`) infers `D = any`, and
   `UnionToIntersection<… | any>` collapses the **entire store type** to `any`. Guard:
   `IsAny<D> extends true ? {} : D`.
2. **An omitted optional callback infers its type parameter as its constraint**, not its default —
   leaving `computed?:` out leaked `& Record<string, Signal<unknown>>` onto the store, whose index
   signature then swallows every member lookup. Same guard shape.

A third, from D22: declaring `withComputed`'s return as an **intersection**
(`DeriveSpec<In, D> & Feature<In, D>`) breaks slot inference — the composite's output degrades to
`Shape` and the derived member to `Signal<any>`. One return type, never an intersection.

## Carried forward from the deleted `2-design.md`

Its surface sections are void — they designed a `computed:` config key on `TableFeature`, which D21
replaced wholesale, and its §9 rejected both the config-thunk key (wrong, corrected in
`3-decisions.md`) and NgRx positional overloads (now the chosen shape). What survives lives in the
decisions doc and is **not** re-derived here:

- construction-vs-evaluation error split → **D9** (plus the Angular source read: computations are
  already `try/catch`-wrapped, the error is cached as `ERRORED`, so "report once per evaluation" is
  free);
- core member keys pre-claimed, `totalRowCount` the one override slot → **D4**;
- a block returning a non-signal throws at construction → **D11**;
- derived state excluded from `state-persistence.md`'s snapshot slice by construction → owed-docs
  list at the end of `3-decisions.md`.

## What is still unverified

Everything runtime. `tsc` cannot reach the fold itself: recognising a derive feature, running it
after the store object exists, claiming its keys, the wrapper that names a throwing member, or
ordering against `setup` and the ADR-0006 removal effect. D12 judged this mechanical enough to skip
a spike — that judgement predates D21's architecture change and should be re-taken in the spec.
