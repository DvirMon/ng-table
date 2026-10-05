---
title: 'Step 5 — create-table-feature.ts: re-typed to Feature<In, Out>, trailing derive-block plumbing'
type: task-step
issue: 69
---

# Step 5 — `create-table-feature.ts`: re-typed to `Feature<In, Out>`, trailing derive-block plumbing

**PR scope:** The authoring helper only. One file. Its spec coverage lands in Step 6 (a
synthetic feature built with it is what the type tests compose).

**Task type:** code

**Skills used:** typescript-conventions, declarative-naming, extract-encapsulated-logic

**Depends on:** Step 1
**Parallel-safe with:** Step 2, Step 3, Step 4

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/api/create-table-feature.ts` (edit)

## Why This Step Exists

Spec "The feature contract": `createTableFeature()` keeps its purpose (an external author never
names engine types) and gains the **one-time** plumbing that lets any feature — first- or
third-party — accept a trailing derive block: call the block with the input intersected with
the feature's own members, merge its contribution (story 21). #36's `withComputed()` is the
block; #38–#40 convert the seven shipped features to this helper so none of them writes the
plumbing themselves.

## What To Do

1. **Signature** (the verified probe shape, generalized):

   ```ts
   export function createTableFeature<
     In extends Shape,
     Out extends object,
     D extends DerivedDict = {},
   >(
     factory: (input: In) => TableFeatureSpec<RowOf<In>, Out>,
     derive?: Feature<In & Out, D>,
   ): Feature<In, Out & D>;
   ```

   `D` defaults to `{}` — research trap #3: an omitted optional callback infers its type
   parameter as its **constraint** unless guarded. Normalize inside the return type with the
   same guard the research names:

   ```ts
   type NormalizeDerived<D> = IsAny<D> extends true ? {} : D;
   // return: Feature<In, Out & NormalizeDerived<D>>
   ```

   `IsAny<T> = 0 extends 1 & T ? true : false`. Keep `IsAny`/`NormalizeDerived` local to this
   file for now; #36 may lift them to `api/types.ts` if `withComputed` needs the same guard.

2. **Runtime.** Without `derive`: return `factory` unchanged (identity, as today). With
   `derive`, return a new feature that:
   - calls `factory(input)` → `spec`;
   - builds the block's input so its own members are visible **now** and later features stay
     visible **lazily**: `Object.assign(Object.create(input), spec.members ?? {})` — own
     members as own properties, the live shared store as prototype. A plain spread would
     freeze the store at this moment and break the "types are stricter than runtime" rule
     (D25) for reads deferred into a `computed()`;
   - calls `derive(blockInput)` → `derivedSpec`;
   - returns one spec: `members: { ...spec.members, ...derivedSpec.members }`; `setup`,
     `onDestroy`, `onRowsRemoved` chained (feature's first, block's second); `stages`,
     `renderStages`, `columnRules` taken from `spec` only.
   - If `derivedSpec` carries `stages`, `renderStages`, or `columnRules`, **throw at
     construction**: a trailing block contributes members, not pipeline behaviour
     (construction-class error per `classify-errors-construction-vs-runtime`). Message:
     `[createTable] a trailing derive block may only contribute members`.

   Extract the merge into a named `mergeDerivedSpec(spec, derivedSpec)` helper in the same
   file (`extract-encapsulated-logic`: it has its own reasoning and is independently
   testable).

3. **Doc comment** (terse): what it is (authoring identity + derive plumbing), the two call
   forms, and that member-key collisions between `Out` and `D` surface at the fold's registry
   (the helper does not pre-check — the registry is the single collision authority, ADR-0007).

## Implementation Notes

- A member key present in both `spec.members` and `derivedSpec.members` is a spread-overwrite
  here but a **registry collision** at the fold (`claimMember` is called per key of the merged
  object, so the duplicate is invisible to the registry). To keep the registry authoritative,
  do not spread — build the merged members by iterating both and throwing on a duplicate key
  with the same wording `claimMember` uses, naming the feature and its derive block. State
  this in `mergeDerivedSpec`'s doc.
- `Object.create(input)` gives a store view whose `in`/`hasOwnProperty` semantics differ from
  the plain store; nothing in the library uses those on the store. If a reviewer objects,
  the alternative is a `Proxy` with a `get` trap — heavier, same semantics. Prefer
  `Object.create`.
- Return type must be a **single** `Feature<...>`, never an intersection (research trap #4).

## Risks / Watchouts

- `D extends DerivedDict = {}`: `{}` is not assignable to `Record<string, Signal<unknown>>`
  under `exactOptionalPropertyTypes`-style strictness? It is (empty object satisfies an index
  signature). Verify with a scratch `expectTypeOf` before relying on it; if it fails, default
  to `Record<never, never>` and adjust `NormalizeDerived`.
- Do not implement `isSignal()` validation or the evaluation-error wrapper here — both live
  inside `withComputed()` (#36, D28).

## Non-Goals

- No `withComputed()` (#36). No conversion of shipped features (#38–#40).

## Acceptance Checks

- [ ] `createTableFeature((input) => ({ members: {...} }))` returns `Feature<In, Out>` with
      `D` resolved to `{}` — no `& Record<string, Signal<unknown>>` on the composed type.
- [ ] `createTableFeature(factory, block)` returns `Feature<In, Out & D>`; the block's
      parameter type is `In & Out`.
- [ ] At runtime the block sees the feature's own members immediately and a later feature's
      member through a lazy read.
- [ ] A block spec carrying `stages` throws at construction with the documented message.
- [ ] Duplicate member key between feature and block throws naming both.
- [ ] File has no `as` casts except, if unavoidable, one on the `Object.create` view with a
      comment.

---

← [Step 4: create-table.ts — positional signature](step-4-positional-create-table.plan.md) | [Step 6: specs — fold runtime + createTable runtime and type assertions](step-6-specs-fold-and-create-table-types.plan.md) →
