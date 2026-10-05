# How do TypeScript libraries make a value nominally theirs — and what do they do about copies?

**Date:** 2026-09-22 · **Depth:** standard

## Answer

The team's belief about Angular is **correct but load-bearing in the wrong place**: `SIGNAL` is a
real `Symbol('SIGNAL')` stamped as an own property on every signal getter [S3], but the thing that
rejects a hand-written object is the _type_ — `Signal<T> = (() => T) & { [SIGNAL]: unknown }`, a
**required** member [S1]. The runtime stamp buys `isSignal` only [S2]. Across 9 libraries the
mechanism splits cleanly: **a required member is universal; whether it is a real symbol depends
entirely on whether the library needs a runtime test.** `ColumnDecl`'s job (P3c — force the literal
`K` through `col()`) is purely compile-time, so the survey's verdict is a **type-only
`declare const … : unique symbol` + required member**, io-ts/valibot/Effect-`Brand` style [S12][S9][S16].
A runtime symbol adds a check this repo has already decided to `ngDevMode`-gate — and **no surveyed
library gates its brand check**; all five that test one test it in production [S2][S8][S14][S18][S6].
**No brand of any kind catches `{ ...decl, id: 'other' }`** — spread preserves a symbol member in
the type, so the id changes while `V` does not. The one library with an answer is Zod, and the
answer is _reconstruct through the factory_, never spread [S7].

## Method

- Pinned from `node_modules` (published, what this repo builds against): `@angular/core@22.1.2`,
  `zod@4.4.3` (ships `zod/v3` in-tree).
- Pinned from `registry.npmjs.org/<pkg>/latest`, read 2026-09-22: `valibot@1.5.0`, `effect@3.22.2`,
  `io-ts@2.2.22`, `drizzle-orm@0.45.3`, `kysely@0.29.6`. `@tanstack/table-core@8.21.3` pinned
  deliberately (v9 ships no `src/`).
- Both `.d.ts` **and** the runtime artifact were read for every library that claims a runtime
  check — the two disagree in three cases (zod `.brand()`, valibot `brand()`, io-ts `_A`).
- Verification changed two findings: zod's `.brand()` reads like a runtime operation and is
  `brand() { return this; }` [S7]; Effect's `[EffectTypeId]` is on the **prototype**, not an own
  property, so it does not survive a spread [S15] — neither fact is in either library's docs.

## Comparison

| Axis                                    | Angular 22.1.2                                        | Zod v4 4.4.3                                                                               | Zod v3 (in 4.4.3)                          | Valibot 1.5.0                                               | Effect 3.22.2                                           | io-ts 2.2.22                                          | Drizzle 0.45.3                                                         | Kysely 0.29.6                          | TanStack 8.21.3 |
| --------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------- | --------------- |
| **(a) Mechanism**                       | real `Symbol` own prop [S3]                           | required string keys `_zod` + `~standard` [S4]; `instanceof` via `Symbol.hasInstance` [S6] | real class + required `_def`/`_type` [S10] | string discriminant `kind`/`type` + required `~run` fn [S9] | real `Symbol.for` on prototype [S15]                    | class + required unassigned `_A`/`_O`/`_I` [S11][S13] | `Symbol.for` as a **static class** prop [S8][S14]                      | required `expressionType` getter [S18] | **none** [S19]  |
| **Brand symbol declared?**              | `declare const SIGNAL: unique symbol` [S1]            | `$brand: unique symbol` (value branding only) [S5]                                         | `BRAND: unique symbol` [S10]               | `BrandSymbol: unique symbol` [S16]                          | `EffectTypeId`/`BrandTypeId: unique symbol` [S15][S17]  | `declare const _brand: unique symbol` [S13]           | `entityKind: unique symbol` [S8]                                       | no                                     | no              |
| **(b) Required in type?**               | **required** [S1]                                     | **required** [S4]                                                                          | **required** [S10]                         | **required**; separate `'~types'?` **optional** [S9]        | **required** via `Effect.Variance` [S15]                | **required**, never assigned [S11]                    | **required** on `DrizzleEntity` [S8]                                   | **required** getter [S18]              | n/a             |
| **(c) Runtime test?**                   | yes — `isSignal` = `value[SIGNAL] !== undefined` [S2] | yes — `inst._zod.traits.has(name)` [S6]                                                    | `instanceof` (real class) [S10]            | **no** — compile-time only [S9][S16]                        | yes — `isEffect` = `hasProperty(u, EffectTypeId)` [S15] | **no** — `_A` never assigned [S12]                    | yes — `is()` walks the prototype chain [S14]                           | yes — `'expressionType' in obj` [S18]  | no              |
| **Dev-gated?**                          | **no** — unconditional [S3]                           | no [S6]                                                                                    | no                                         | n/a                                                         | no [S15]                                                | n/a                                                   | no [S14]                                                               | no [S18]                               | n/a             |
| **Throws or degrades?**                 | returns `false` [S2]                                  | returns `false` [S6]                                                                       | —                                          | —                                                           | returns `false` [S15]                                   | —                                                     | **throws** if the _type_ arg is not an entity; `false` otherwise [S14] | returns `false` [S18]                  | —               |
| **(d) Derive-variant API**              | none                                                  | `clone`/`extend`/`safeExtend`/`merge`/`omit`/`pick`/`partial`/`required` [S7]              | `.merge()`/`.extend()` [S10]               | none (functional — call `object()` again)                   | `pipe`                                                  | none                                                  | none                                                                   | none                                   | none            |
| **Survives `{ ...value }` at runtime?** | **yes** — own enumerable prop [S3]                    | yes (`_zod` is `enumerable: false` → **no**) [S6]                                          | no (prototype methods lost)                | yes (plain object)                                          | **no** — prototype [S15]                                | n/a (never present)                                   | **no** — static class prop [S8]                                        | **no** — prototype getter [S18]        | n/a             |

## Evidence

- Angular: `type Signal<T> = (() => T) & { [SIGNAL]: unknown }` — the brand member is required and
  public, and `WritableSignal` adds a second, `[ɵWRITABLE_SIGNAL]: T`, which is **type-only** with
  no runtime counterpart [S1]. This repo already documents that wall at
  `engine/filters/state.ts:120-122` [R3].
- `SIGNAL` is exported: as `ɵSIGNAL` from `@angular/core` root [S20] and **unprefixed** from the
  `@angular/core/primitives/signals` subpath entry [S21][S22]. A consumer can therefore hand-stamp
  a counterfeit signal — the brand is a guard against accident, not against intent [S1].
- The stamp is `getter[SIGNAL] = node` / `computed[SIGNAL] = node`, run unconditionally; only the
  adjacent `toString` override is `ngDevMode`-gated, which is direct evidence Angular chose _not_
  to gate the brand [S3].
- Zod v4 has no brand symbol on schemas at all — `$ZodType` requires `_zod: Internals` and
  `"~standard"`, both plain string keys [S4]. `$brand` is a real `Symbol("zod_brand")` [S7] used
  only in the **value**-level `$brand<T>` type [S5]; `.brand()` is `brand() { return this; }` — a
  runtime no-op [S7].
- Zod v4 overrides `Symbol.hasInstance` so `instanceof` tests `inst?._zod?.traits?.has(name)` — a
  string-keyed `Set`, which makes `instanceof` work across duplicate copies of the library [S6].
- Valibot is the closest match to this repo's current shape: a required structural surface
  (`kind`, `type`, `reference`, `expects`, `async`, `'~standard'`, `'~run'`) **plus a separate
  optional phantom** `'~types'?: { input; output; issue }` [S9]. That is exactly the
  carrier-vs-brand split this library has today — valibot makes it deliberately, using required
  members for rejection and the optional one for transport only.
- Valibot's `brand()` action is `'~run'(dataset) { return dataset as SuccessDataset<…> }` — the
  `BrandSymbol` is never written [S16].
- io-ts is the cleanest precedent for **required-but-never-assigned**: `readonly _A: A` is required
  on `class Type` [S11] and the constructor assigns only `name`/`is`/`validate`/`encode` [S12].
- Effect's `[EffectTypeId]` is required through `Effect.Variance` and carries a _record_ of
  variance facts (`_V`, `_A`, `_E`, `_R`), not one type [S15] — the same "brand as a record"
  shape Angular Signal Forms uses for `SchemaPath` [S23].
- Effect's own value-branding module says it outright: `Brand.nominal` "does not apply any runtime
  checks, it just returns the provided value"; `Brand.refined` is the variant that validates [S17].
- Drizzle uses `Symbol.for("drizzle:entityKind")` — a **registered** symbol, so the brand is stable
  across two copies of `drizzle-orm` in one tree [S14]. It is a _static_ class property, and `is()`
  walks `Object.getPrototypeOf(cls)` comparing string values rather than reading the instance [S14].
- Kysely brands with a required **getter** that always returns `undefined`
  (`get expressionType(): T | undefined { return undefined }`) [S18b], and `isExpression` tests
  `'expressionType' in obj` [S18]. Required in the type, present at runtime, valueless.
- TanStack brands nothing: `createColumnHelper` is `display: column => column`, `group: column =>
column`, and `accessor` just spreads [S19]. That is the direct cause of the erasure this repo
  already recorded — `columns: ColumnDef<TData, any>[]`, `getAllColumns(): Column<TData,
unknown>[]` [S24].

## Synthesis

**Where the libraries agree.** Every one of the eight that brands at all makes the member
**required**. Not a single surveyed library uses an _optional_ member to establish nominality —
optional members appear only as type transport (valibot `'~types'?`, and this repo's
`__criterion?`/`__row?`/`__columnValues?`/`_type?` [R1][R2][R4]). The repo's own framing is
confirmed: what it has today are carriers, and no surveyed library would call them brands.

**Where they disagree — and why.** The split on _real symbol vs. type-only_ tracks one variable and
one only: **does the library need to answer "is this mine?" about an `unknown` at runtime.**

- Angular (`isSignal` on template-bound values), Effect (`isEffect` on user-supplied unions),
  Drizzle (`is()` across dialects), Kysely (`isExpression` on builder arguments) and Zod v4
  (`instanceof` across library copies) all take arbitrary input and must sort it. All five stamp
  something real and test it in production.
- io-ts, valibot's `brand()`, Effect's `Brand.nominal` and Zod's `.brand()` all exist purely to
  stop a hand-written value from type-checking. All four are **type-only phantoms that no runtime
  code ever writes or reads**. Effect ships both mechanisms in one package for the two jobs, which
  is the sharpest available evidence that the choice is about the job, not about taste [S15][S17].

`ColumnDecl` is unambiguously in the second group. `createColumns` receives its declarations from
its own `col()` builder inside its own call — there is no `unknown` to sort. Nothing in the brief
asks for an `isColumnDecl`.

**The `ngDevMode` constraint decides it independently.** This repo gates construction-time checks
behind `ngDevMode`, so a runtime brand check is stripped from production. Zero of the five
runtime-checking libraries gate theirs. Adopting a runtime symbol here would produce a check that
is _weaker_ than every precedent the preference was drawn from — the preference's own justification
does not survive the gate.

**(d) is the finding the brief does not yet have.** Spread is the hole no mechanism closes:

- **Type level, every library.** `{ ...decl, id: 'other' }` produces a type that still carries the
  brand member — spread preserves it — while `id` is now `'other'` and `V` is still the original's.
  For `ColumnDecl` that is worse than the no-brand case P3c found: instead of widening to `string`,
  the value map gets a _confidently wrong_ `{ other: V_of_original }`. A symbol brand does not see
  this, and neither does a class, an optional carrier, or a `WeakSet` registered by `col()`.
- **Runtime level, it depends on where the stamp lives.** Angular's own-enumerable stamp survives a
  spread, so a spread-and-mutated signal object would still pass `isSignal` [S3]. Effect's,
  Drizzle's and Kysely's live on the prototype or the constructor and are lost [S15][S8][S18b].
  Neither outcome is documented by any of them.
- **One library has an explicit answer, and it is reconstruction.** Zod's entire variant family —
  `extend`, `safeExtend`, `merge`, `omit`, `pick`, `partial`, `required` — ends in
  `clone(schema, def)`, which is `new inst._zod.constr(def ?? inst._zod.def)` [S7]. Every derived
  schema is re-minted by the constructor over a merged _def_; the object is never spread. Two of
  those methods also **throw** rather than silently produce a wrong result (`.omit()` and
  `.merge()` on a schema carrying refinements) [S7] — a construction-time throw, matching this
  repo's ADR-0014 class.

So: **yes, an explicit derive-a-variant API is the shipped answer to the spread problem**, in the
one surveyed library that has the problem. For `ColumnDecl` the equivalent is a one-liner — a
variant is `col(newId, opts)`, since `col()` is the only thing that captures the literal anyway.
The design addition is not a new API so much as a stated rule plus, optionally, a `col.from(decl,
{ id })` that re-enters the builder. Documenting "never spread a `ColumnDecl`" without a sanctioned
path is the shape that historically drifts.

## Against

- **The strongest case for a real symbol is the one the survey did not rule out:** if `ColumnSet`
  ever crosses a boundary where an `unknown` must be sorted — a devtools panel, a `setColumns()`
  write taking consumer-supplied values, persistence rehydration — then a runtime stamp is the only
  mechanism that works, and retrofitting one later is a breaking change to the value's shape.
  Open item 3 in the brief (whether `createTable` still accepts a plain `ColumnDefInput[]`) is
  exactly that boundary. Angular, Effect, Drizzle and Kysely all pay a small permanent cost for
  this optionality.
- **Drizzle's `Symbol.for` is cheap insurance against a real failure** — two copies of a library in
  one dependency tree. A `unique symbol` is per-module-instance; a duplicate `@ngp/table` in a
  monorepo would make brands from the two copies mutually unassignable. This is a type-level
  failure that a type-only brand _does_ have and a `Symbol.for` brand does not.
- **Kysely's shape is a genuine middle option** the verdict above skips: a required member that is
  a real runtime property with no value. It costs one getter, survives nothing exotic, and makes an
  `in` check possible later without changing the type.

## Not researched

- **Prisma.** Not opened at all; Kysely was taken as the ORM-adjacent second data point.
- `@tanstack/table-core@9.2.4` branding. Three unpkg paths for the v9 `columnHelper` returned 404
  and the hunt was stopped. The v8 result (brands nothing) is not assumed to transfer.
- `WeakSet`/`WeakMap` factory registration. It was on the list of candidate mechanisms and **no
  surveyed library uses it** — but the survey set was the one the brief named, so this is absence
  of evidence across nine libraries, not a proven non-pattern.
- Whether any of these libraries _documents_ its brand in prose. All findings here are source
  reads; no docs page was consulted except Effect's in-source `Brand.nominal` doc comment [S17].
- Standard Schema itself (`~standard`) as a cross-library nominal convention — noted in zod and
  valibot, not investigated as a spec.

## Unverified

- **Zod v3's runtime.** Only `zod/v3/types.d.ts` was read [S10]; the `_type`/`_output`/`_input`
  phantoms are assumed unassigned at runtime by analogy with io-ts, not confirmed. Reading
  `node_modules/zod/v3/types.js` would settle it.
- **`hasProperty` in Effect** is assumed to be an `in`-style check (which walks the prototype
  chain). `isEffect = u => hasProperty(u, EffectTypeId)` was read verbatim [S15]; `hasProperty`
  itself was not opened. If it were an own-property check, `isEffect` would not work at all, so the
  inference is safe but it is an inference.
- **The spread claim is reasoned, not probed.** That `{ ...decl, id: 'other' }` keeps the brand
  member and re-keys the value map follows from TS spread semantics on a symbol-keyed member; no
  probe file was written. A three-line `.types.spec.ts` against the existing `ColumnMetaKey` would
  confirm it, and should be written before the design commits to a mitigation.
- Whether a duplicate `@ngp/table` in one tree is a real risk here — the `Symbol.for` argument in
  **Against** rests on it, and the repo's packaging was not examined.

## Sources

|      | Source                                                                                                        | Version                | Verified                                                                                                                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1   | `node_modules/@angular/core/types/_chrome_dev_tools_performance-chunk.d.ts` lines 11-19, 74-84                | 22.1.2                 | yes — read; `Signal<T>` requires `[SIGNAL]`, `WritableSignal` requires `[ɵWRITABLE_SIGNAL]`                                                                                            |
| S2   | `node_modules/@angular/core/fesm2022/primitives-signals.mjs` lines 105-107                                    | 22.1.2                 | yes — read; `isSignal(value) { return value[SIGNAL] !== undefined; }`                                                                                                                  |
| S3   | `node_modules/@angular/core/fesm2022/_effect-chunk.mjs` lines 11, 271-274, 340-343                            | 22.1.2                 | yes — read; `Symbol('SIGNAL')`, `getter[SIGNAL] = node` ungated, `toString` gated                                                                                                      |
| S4   | `node_modules/zod/v4/core/schemas.d.cts` lines 97-100                                                         | 4.4.3                  | yes — read; `_zod` and `"~standard"` both required                                                                                                                                     |
| S5   | `node_modules/zod/v4/core/core.d.cts` lines 19-24                                                             | 4.4.3                  | yes — read; `$brand` is value-level only                                                                                                                                               |
| S6   | `node_modules/zod/v4/core/core.cjs` lines 11-62                                                               | 4.4.3                  | yes — read; `_zod` defined `enumerable: false`; `Symbol.hasInstance` tests `traits.has(name)`                                                                                          |
| S7   | `node_modules/zod/v4/core/util.cjs` lines 320-325, 423-501                                                    | 4.4.3                  | yes — read; corrected the assumption that `.brand()` acts at runtime — it is `return this` in `classic/schemas.cjs:230`; every variant ends in `clone()` = `new inst._zod.constr(def)` |
| S8   | https://unpkg.com/drizzle-orm@0.45.3/entity.d.ts                                                              | 0.45.3                 | yes — fetched; `entityKind: unique symbol`, `DrizzleEntity { [entityKind]: string }` required                                                                                          |
| S9   | https://raw.githubusercontent.com/fabian-hiller/valibot/v1.5.0/library/src/types/schema.ts                    | 1.5.0                  | yes — fetched; required `~run`/`~standard` vs optional `'~types'?`                                                                                                                     |
| S10  | `node_modules/zod/v3/types.d.ts` lines 48-54, 885-891                                                         | 4.4.3 (zod/v3 in-tree) | yes — read; `ZodType` class, required `_type`/`_output`/`_input`/`_def`; `BRAND: unique symbol`                                                                                        |
| S11  | https://unpkg.com/io-ts@2.2.22/lib/index.d.ts                                                                 | 2.2.22                 | yes — fetched; `class Type` declares required `_A`/`_O`/`_I`                                                                                                                           |
| S12  | https://unpkg.com/io-ts@2.2.22/lib/index.js                                                                   | 2.2.22                 | yes — fetched; constructor assigns only `name`/`is`/`validate`/`encode` — the `.d.ts` alone implies the opposite                                                                       |
| S13  | https://unpkg.com/io-ts@2.2.22/lib/index.d.ts                                                                 | 2.2.22                 | yes — fetched; `declare const _brand: unique symbol` preceding `Brand<B>`                                                                                                              |
| S14  | https://unpkg.com/drizzle-orm@0.45.3/entity.cjs                                                               | 0.45.3                 | yes — fetched; `Symbol.for("drizzle:entityKind")`; `is()` throws on a non-entity `type` argument, no dev gate                                                                          |
| S15  | https://unpkg.com/effect@3.22.2/dist/esm/internal/core.js + `internal/effectable.js` + `dist/dts/Effect.d.ts` | 3.22.2                 | yes — three fetches; `isEffect = u => hasProperty(u, EffectTypeId)`; `Symbol.for("effect/Effect")` stamped on `EffectPrototype`, not the instance                                      |
| S16  | https://raw.githubusercontent.com/fabian-hiller/valibot/v1.5.0/library/src/actions/brand/brand.ts             | 1.5.0                  | yes — fetched; `BrandSymbol: unique symbol`, `~run` returns the dataset unchanged                                                                                                      |
| S17  | https://unpkg.com/effect@3.22.2/dist/dts/Brand.d.ts                                                           | 3.22.2                 | yes — fetched; `nominal` "does not apply any runtime checks"                                                                                                                           |
| S18  | https://raw.githubusercontent.com/kysely-org/kysely/v0.29.6/src/expression/expression.ts                      | 0.29.6                 | yes — fetched; required `get expressionType(): T \| undefined`; `isExpression` tests `'expressionType' in obj`                                                                         |
| S18b | https://raw.githubusercontent.com/kysely-org/kysely/v0.29.6/src/expression/expression-wrapper.ts              | 0.29.6                 | yes — fetched; the getter returns `undefined`                                                                                                                                          |
| S19  | https://unpkg.com/@tanstack/table-core@8.21.3/src/columnHelper.ts                                             | 8.21.3                 | yes — fetched; `display: column => column` — no brand of any kind                                                                                                                      |
| S20  | `node_modules/@angular/core/types/core.d.ts` line 9666                                                        | 22.1.2                 | yes — read; `SIGNAL as ɵSIGNAL` in the root export list                                                                                                                                |
| S21  | `node_modules/@angular/core/types/primitives-signals.d.ts` line 123                                           | 22.1.2                 | yes — read; `export { … SIGNAL … }` unprefixed                                                                                                                                         |
| S22  | `node_modules/@angular/core/package.json` lines 32-35                                                         | 22.1.2                 | yes — read; `"./primitives/signals"` is a declared subpath export                                                                                                                      |
| S23  | `~/.claude/discovery-sources.md`, "TypeScript type-level" section                                             | —                      | yes — read; prior verified finding on `SchemaPath`'s `[ɵɵTYPE]` record brand (`@angular/forms@22.1.2`)                                                                                 |
| S24  | `~/.claude/discovery-sources.md`, same section                                                                | —                      | yes — read; prior verified finding that `columns: ColumnDef<TData, any>[]` is TanStack's erasure point                                                                                 |
| R1   | `libs/table/src/engine/filters/types.ts:70-74`                                                                | —                      | yes — read; `__criterion?` / `__row?` both optional                                                                                                                                    |
| R2   | `libs/table/src/columns-schema/types.ts:44-48`                                                                | —                      | yes — read; `ColumnMetaKey._type?` optional                                                                                                                                            |
| R3   | `libs/table/src/engine/filters/state.ts:118-123`                                                              | —                      | yes — read; the repo already documents `ɵWRITABLE_SIGNAL` as unsatisfiable structurally                                                                                                |
| R4   | `libs/table/src/api/types.ts:238` and `libs/table/src/engine/types.ts:57`                                     | —                      | yes — read; `__columnValues?` optional, cited as precedent by its own doc comment                                                                                                      |
