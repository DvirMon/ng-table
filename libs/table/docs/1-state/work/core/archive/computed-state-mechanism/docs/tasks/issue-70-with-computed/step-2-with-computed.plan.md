---
title: "Step 2 — api/features/with-computed.ts + index.ts: withComputed()"
type: task-step
issue: 70
---

# Step 2 — `api/features/with-computed.ts` + `index.ts`: `withComputed()`

**PR scope:** The feature and its barrel export. Runtime validation and the evaluation-error
wrapper live here and nowhere else (D28). No spec files — Steps 3 and 4.

**Task type:** code

**Skills used:** angular-developer, typescript-conventions, declarative-naming, extract-encapsulated-logic, classify-errors-construction-vs-runtime

**Depends on:** Step 1
**Parallel-safe with:** —

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/api/features/with-computed.ts` (new)
- `libs/shared/table/src/index.ts` (edit — export `withComputed`)

## Why This Step Exists

Architecture settled item 4: a derive block **is** a feature — `withComputed()` returns
`Feature<In, D>`, which is what lets it compose as its own slot and as a feature's trailing
argument through #69 Step 5's plumbing with no per-feature code. Settled item 8 / D9 / D28:
the `isSignal()` check and the evaluation wrapper live inside this function; the fold stays
uniform.

## What To Do

1. **Signature** (architecture "Types to add", verbatim):

   ```ts
   export function withComputed<In extends Shape, D extends DerivedDict>(
     factory: (store: ReadonlyStore<In>) => D
   ): Feature<In, D>
   ```

   `Shape` from `../../engine/types`; `DerivedDict`, `ReadonlyStore` from `../types`. Return
   type is a **single** `Feature<In, D>` — never an intersection (research trap #3). `factory`
   is required, so trap #2 (omitted optional callback → constraint) does not apply; no
   `IsAny` guard needed here.

2. **Runtime.** The returned feature, called by the fold with `input: In`:

   - **Declare** — call `factory(toReadonlyStore(input))` inside `try`/`catch`. On throw:
     construction-class error, rethrow wrapped:
     `new Error('[createTable] withComputed block threw while declaring its members', { cause })`
     (lib targets es2022; `cause` is available).
   - **Validate** — for each `[key, value]` of the returned dictionary, `isSignal(value)`
     (from `@angular/core`) or throw:
     `[createTable] withComputed: member "${key}" is not a signal — a derive block returns signals only`.
     Construction-class: the type constraint alone is defeated by a JavaScript consumer.
   - **Wrap** — replace each signal with
     `computed(() => { try { return source(); } catch (error) { console.error(`[createTable] derived member "${key}" threw`, error); throw error; } })`.
     ADR-0014 channel (`console.error`, always, not dev-only). Once-per-evaluation falls out of
     Angular's error caching (D9): the outer `computed` stores the error and rethrows it on
     every read until a dependency changes — no dedupe logic.
   - **Return** `{ members: wrapped }` — nothing else. No `stages`, `renderStages`,
     `columnRules`, hooks. This is what makes "no persistence hook reachable" true by
     construction, and what keeps #69 Step 5's "a trailing block may only contribute members"
     guard from ever firing on a `withComputed()`.
   - **Name** — `Object.assign(feature, { displayName: 'withComputed' })` (Step 1).

3. **Extract** two named helpers in the same file (`extract-encapsulated-logic` — each has its
   own reasoning and is independently testable through the public function):
   - `assertDerivedSignals(dict): asserts dict is DerivedDict` — the `isSignal()` pass.
   - `wrapDerivedSignal(key, source): Signal<unknown>` — the reporting `computed`.

   Keep the block call + wrapping loop inline in the returned feature; it reads top-to-bottom.

4. **`toReadonlyStore(input)`** — the type-level projection (D28). At runtime the object is the
   same; the mapped type is not provably assignable from `In`, so this is the file's one
   assertion. Put it in a one-line function with a comment saying it is type-level only; no
   `Object.freeze`, no proxy.

5. **Doc comment** (terse, ≤50 words): a feature that adds derived signals; sees core plus
   every feature declared before it, or — as a feature's trailing argument — core plus that
   feature's members; read-only store; signals only. Point to `docs/1-state/architecture.md`
   for the two placements once #78 writes them — do not narrate D-numbers in the JSDoc.

6. **`index.ts`** — `export { withComputed } from './api/features/with-computed';` next to the
   other feature exports.

## Implementation Notes

- **Cost.** One extra `computed` node per derived member, reading the consumer's signal. It
  recomputes only when the consumer's signal does — AC "same cost as a hand-written
  `computed()`" holds in the recompute sense; the node is the price of naming the member in
  the report. The consumer's original signal is not exposed: a `WritableSignal` returned by a
  block reaches the store as a read-only `computed`, which is the right shape for "derived".
- **Collision.** No pre-check here. Member keys go through the fold's `claimMember` with the
  label `feature N (withComputed)` (Step 1). In the trailing placement, a key that duplicates
  the owning feature's own member is caught by #69 Step 5's `mergeDerivedSpec`; a key that
  duplicates an earlier feature's member is caught by the registry naming the owning feature's
  position.
- **Method members on the read-only store** stay callable (D28). Do not try to strip them.
- `console.error` is the channel until an injectable handler exists (ADR-0014 consequences);
  keep the call in `wrapDerivedSignal` only, so a later swap is one site.

## Risks / Watchouts

- **Not green as a whole.** Shipped `with-*` features are unconverted until #72–#74, so
  `withComputed()` cannot yet be composed with a real feature; Steps 3–4 use synthetic
  features built with `createTableFeature()`. Real-feature composition is #77.
- `isSignal()` returns true for `WritableSignal`, `computed`, `linkedSignal`, `toSignal()`
  results, and `input()` signals — all acceptable; the wrapper makes them read-only members.
- Do not add `ngDevMode` gating to the construction checks: they are cheap, one-time, and must
  fire in production builds.

## Non-Goals

- No `composeFeatures()` (#71). No shipped-feature conversion (#72–#74). No stories (#75).
  No ADR/CLAUDE.md edits (#78).

## Acceptance Checks

- [ ] `withComputed` exported from `src/index.ts`; its return type is exactly
      `Feature<In, D>`.
- [ ] Block throwing → rethrown as an `Error` whose message names `withComputed` and whose
      `cause` is the original.
- [ ] Non-signal value → throws at construction naming the key.
- [ ] Each store member is a `computed` that reads the consumer's signal; a throw inside it
      logs one `console.error` containing the key, then rethrows.
- [ ] Returned spec has only `members`.
- [ ] `displayName === 'withComputed'` on the returned feature.
- [ ] `tsc --noEmit` on the lib passes for this file (other files may still be red from #69's
      window).

---
← [Step 1: engine — Feature.displayName](step-1-feature-display-name-label.plan.md) | [Step 3: with-computed.spec.ts — runtime](step-3-with-computed-spec-runtime.plan.md) →
