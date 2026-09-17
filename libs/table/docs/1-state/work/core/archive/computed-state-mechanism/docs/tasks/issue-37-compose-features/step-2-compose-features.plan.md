---
title: "Step 2 — api/features/compose-features.ts + index.ts: composeFeatures()"
type: task-step
issue: 71
---

# Step 2 — `api/features/compose-features.ts` + `index.ts`: `composeFeatures()`

**PR scope:** The composite feature and its barrel export. Typed by the already-generated
`ComposeFeaturesOverloads` (#35, `compose-features.overloads.ts` — no generator change).
No spec files — Steps 3 and 4.

**Task type:** code

**Skills used:** angular-developer, typescript-conventions, declarative-naming, extract-encapsulated-logic, classify-errors-construction-vs-runtime

**Depends on:** Step 1
**Parallel-safe with:** —

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/api/features/compose-features.ts` (new)
- `libs/shared/table/src/index.ts` (edit — export `composeFeatures`)

## Why This Step Exists

Architecture settled item 5 / D21: the arity ceiling is type-level only and not raisable, so
the escape hatch is a composite that "accumulates internally and consumes a single slot".
Issue AC 1–3, 6–7 are all properties of this one function: it folds N inner features the
way the engine fold does, then hands the engine a single spec.

## What To Do

1. **Signature.** Mirror `create-table.ts`'s static/dynamic boundary (ADR-0003): a
   runtime-length implementation cast to the generated overload interface.

   ```ts
   import type { ComposeFeaturesOverloads } from './compose-features.overloads';

   export const composeFeatures = ((...features: readonly AnyTableFeature[]): AnyTableFeature => {
     const composite: AnyTableFeature = (input) => foldInnerFeatures(features, input);
     return Object.assign(composite, { displayName: 'composeFeatures' });
   }) as ComposeFeaturesOverloads;
   ```

   `AnyTableFeature` from `../types`. Overload 1 of the interface is one inner feature; there
   is no zero-feature signature (`includeZeroFeature: false`), so `composeFeatures()` is a
   compile error — no runtime guard needed for it.

2. **`foldInnerFeatures(features, input)`** — a named helper in the same file, returning
   `TableFeatureSpec<unknown, Record<string, unknown>>`:

   - **Registry.** `const registry = new SlotRegistry(); registry.claimCoreMembers();`
     (`SlotRegistry`, `describeInnerFeature` from `../../engine/slots`). Per composite call,
     so inner-vs-inner collisions are detected here — otherwise the merge below would
     spread-overwrite silently and reach the outer registry as one already-merged key
     (the same reasoning as `mergeMembers` in `create-table-feature.ts`). Core keys are
     pre-claimed so a core-key collision names the inner position, not just the composite.
   - **Inner store.** `const innerStore = Object.create(input);` once. Own properties = inner
     members folded so far; prototype = the outer store, so a read deferred into a method or
     `computed()` still sees every later outer slot (spec "types are stricter than runtime").
     Same seam as `createTableFeature`'s `blockInput`.
   - **Loop** over `features` with `index`; `label = describeInnerFeature(index + 1,
     feature.displayName)`; `spec = feature(innerStore)`. For each spec:
     - `stages`: for `stage of PIPELINE_ORDER` (from `../../engine/pipeline`) with a
       transform — `registry.claimStage(stage, label)`, then set on the accumulating
       `stages` object.
     - `renderStages`: same with `RENDER_ORDER` (`../../engine/render-stages`) and
       `claimRenderStage`.
     - `members`: `registry.claimMember(key, label)` per key; assign onto both the
       accumulating `members` object and `innerStore`.
     - `columnRules`: push onto an accumulating array (additive — never claimed, ADR-0010).
     - `setup` / `onDestroy` / `onRowsRemoved`: push onto three arrays.
   - **Return** a spec that sets a key **only when it has content**: `members` always;
     `stages` / `renderStages` only if at least one was claimed; `columnRules` only if
     non-empty; each hook only if its array is non-empty, as one function that runs the
     array in order (`runInOrder(callbacks)` helper). Empty keys must be **absent**, not
     `{}`: a composite of `withComputed()` blocks is a valid trailing derive argument, and
     `mergeDerivedSpec`'s "declared pipeline behaviour" guard checks `!== undefined`.

3. **Extract** (`extract-encapsulated-logic` — each owns a loop with its own reasoning):
   `claimInnerStages(spec, label, registry, into)`, `claimInnerRenderStages(...)`,
   `runInOrder(callbacks)`. Keep the member/columnRules/hook collection inline in the loop
   body; it reads top-to-bottom.

4. **Doc comment** (≤50 words): collapses N features into one feature occupying one
   `createTable()` slot; inner features see the slots before the composite plus earlier inner
   features; a following slot sees the whole composite; the arity escape hatch. Point at
   `docs/1-state/architecture.md` (written by #44); no D-numbers in JSDoc.

5. **`index.ts`** — `export { composeFeatures } from './api/features/compose-features';`
   next to `withComputed`.

## Implementation Notes

- **Double claiming is intended.** The outer fold claims the merged members/stages again
  against the outer registry with label `feature N (composeFeatures)`. That is what names a
  cross-boundary collision (inner member vs an earlier outer slot, or vs core). The inner
  registry only exists to catch and name inner-vs-inner clashes.
- **`TableFeatureSpec<unknown, …>`.** The composite never knows `TRow` at runtime; the
  outer `labelFeatures` call already casts each consumer feature's spec to
  `TableFeatureSpec<TRow>` (ADR-0003 seam). Do not add a second cast site beyond the
  overload cast on the export.
- **No try/catch.** Every throw here is construction-class (a collision, an inner feature's
  own construction error) and must propagate as-is; wrapping would hide the registry's
  message.
- **Empty `features` at runtime** (JS consumer): returns a member-less feature. Harmless;
  leave it.
- **Hook order** is inner argument order, matching the engine fold's array order.

## Risks / Watchouts

- **Not composable with shipped features yet** — `with-*` conversion is #38–#40. Steps 3–4
  use synthetic features from `createTableFeature()`; real composition is #43.
- **Standalone composites infer `In` as `Shape`.** `const std = composeFeatures(f1(), f2())`
  outside a `createTable()` call has no contextual `In`, so a row-typed config callback
  inside it sees `RowOf<Shape> = unknown` (the D19 finding). Inline inside a slot, contextual
  return-type inference gives full row and member types. Nothing to do in code; Step 4 pins
  it and #44 documents it.
- Do not read `feature.name`; only `displayName` (minified builds).

## Non-Goals

- No generator change — `ComposeFeaturesOverloads` already covers 15 inner slots.
- No refactor of the engine's `foldFeatures` to share the claim loop; a follow-up if a third
  claim site ever appears.
- No shipped-feature conversion (#38–#40), no docs (#44), no stories (#41).

## Acceptance Checks

- [ ] `composeFeatures` exported from `src/index.ts`; `composeFeatures(f1, f2)` is typed
      `Feature<In, O1 & O2>` (one `Feature`, not an intersection of shapes).
- [ ] `displayName === 'composeFeatures'` on the returned feature.
- [ ] Inner member/stage/render-stage/core-key collisions throw at construction with both
      labels of the form `composeFeatures inner feature N (name)`.
- [ ] Returned spec carries only the keys that have content.
- [ ] `npx tsc -p libs/shared/table/tsconfig.lib.json --noEmit` passes.

---
← [Step 1: engine/slots.ts — describeInnerFeature()](step-1-slots-inner-feature-label.plan.md) | [Step 3: compose-features.spec.ts — runtime](step-3-compose-features-spec-runtime.plan.md) →
