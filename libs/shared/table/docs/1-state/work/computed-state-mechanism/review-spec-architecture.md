---
title: Review — spec.md and architecture.md against source
type: review
status: applied 2026-09-12 — spec.md, architecture.md, 2-research.md edited; D25–D28 added
date: 2026-09-12
audience: developers
---

# Review — `spec.md` + `architecture.md` vs `feat/table` source

Read both docs, `2-research.md`, `3-decisions.md` (D19–D24, owed-docs list), and the engine/api
source they describe. Findings ranked. "Issue" = the GitHub issue that already absorbs the fix.

## Blocking — doc contradicts code or itself

### 1. `composed` is not unused — grouping reads it

Spec (Implementation Decisions → The feature contract): *"The feature-to-feature seam (`composed`)
is retired … No shipped feature uses it today."* False. `withGrouping()` reads
`composed['expandedRows']` inside its `group` render stage (`with-grouping.ts:79`), guarded by
`isExpandedRowsSignal`, and its doc comment cites ADR-0007 for why the guard is sufficient.

Under positional composition the read splits in two: the **type** of grouping's input includes
`expandedRows` only if `withExpansion()` precedes it; the **runtime** lazy read on the shared store
object works in either order. Spec must state that rule explicitly. Issue: #72 AC "grouping picks
up expansion regardless of argument order".

### 2. Architecture fold steps 3 and 4 contradict each other

Step 3: *"A derive feature is not special-cased."* Step 4: *"wrap each derived member so a throw
during evaluation reports the member key … validate each returned value with `isSignal()`."* At
fold level `isSignal()` would reject every method member an ordinary feature contributes
(`selectRow`, `beginEdit`, `rowsOf`). The wrapping and validation must live **inside**
`withComputed()`; the fold stays uniform. Issue: #70 is written this way; architecture should say
so.

### 3. `indexById` / `baseColumns` unaddressed

Both editing features read `core.indexById` (`with-row-edit.ts:86`, `editing-state.ts:230`);
column-schema wiring reads `core.baseColumns`. Neither is on `TableStore`, so a
`Feature<In extends Shape>` cannot reach them. Neither doc mentions it. Settled in #69:
`indexById` becomes a public read-only member; `baseColumns` stays engine-only because the schema
wiring is spliced internally and keeps taking the core handle. Decisions log owes a D25.

### 4. "Read-only over the store" has no type

Spec: *"The store handed to a derive block is read-only: no write views, no update paths."* Story
16 promises a compile error on write. `TableStore` carries `value` and `columns` as `WritableView`
(with `.update`), and features contribute mutating methods. The probe passes `store` raw. No
`ReadonlyStore<In>` projection is defined anywhere.

Decide one of:
- (a) mapped type stripping `.update` from write views; mutating methods stay visible (cannot be
  distinguished statically) — story 16 holds for views, "by convention" for methods;
- (b) drop the compile-time claim; document read-only as convention.

Recommend (a), stated explicitly in spec + architecture "Types to add". Issue: #70 AC "writing
through it is a compile error" assumes (a).

## Inconsistencies

### 5. Arity — spec decides, architecture reopens

Spec: *"Default arity: 15 slots."* Architecture OQ2 reopens it. `composeFeatures()` needs its own
accumulating overloads → ~30 near-identical blocks, which strengthens OQ3 (generate, commit output,
CI check that committed output matches). Settle both in one line: keep 15, generate.

### 6. Research header says two traps, body lists three

`2-research.md` §"Two silent-failure traps" — third added inline after D22. Spec and architecture
say three. Rename the header.

### 7. `describeFeature` description wrong

Architecture table: *"`describeFeature(index)` → `features[0]`"*. Actual: `features[${index}]`,
off by one because `wireColumnsSchemaAsync` is spliced as feature 0. #68 wording corrected.

### 8. Persistence gate unmet

Spec: *"The persistence spec and this change both touch the feature contract and must agree
before either lands."* `state-persistence.md` has no mention of derived members or
`withComputed`. Owed-docs list marks it "unchanged by D21" — the exclusion row is still owed.
Either add the one paragraph now or downgrade the gate to "before persistence lands". Issue: #78.

### 9. `any` in `Shape`

`Shape = { rows: Signal<readonly any[]> }`. `Signal<TRow[]>` is assignable to
`Signal<readonly unknown[]>`, and `RowOf` infers through `readonly (infer R)[]` either way. Repo
convention avoids `any`; research trap #1 is precisely "a wildcard in a constraint's slot".
Re-verify the probe with `unknown[]`.

### 10. No migration guide owed

Story 28 promises a "clear mechanical rewrite"; the owed-docs list has no before/after entry.
Add a before/after table (thunk+array → positional; `withX<TRow>()` → `withX()`;
`createTableSchema()` → plain object with explicit `trackBy`; `options.injector` →
`config.injector`) to `CLAUDE.md` or a `MIGRATION.md`. Issue: #78.

### 11. Types are stricter than runtime — say it once

Spec "What changes semantically" states argument order governs member visibility. It should also
state the runtime truth: the store object is one shared reference, so a lazy read from a method or
`computed()` sees everything regardless of order (today's `composed` late-read, unchanged). Types
are the stricter of the two; finding 1 is the worked example.

### 12. Missing negative type tests in "Testing Decisions"

D24 verified *"a `withComputed` in slot 1 cannot see a later slot's members (compile error, not a
silent `any`)"*. Spec's type seam lists "a member of an uncomposed feature being absent" but not
the later-slot case, nor `composeFeatures()` at all. Issues: #69, #71 ACs.

## Settled by the breakdown — record, don't reopen

- OQ1 `createTableSchema()` — removed (#69). Consequence: `trackBy` explicit at every call site;
  consistent with story 3.
- OQ4 spike — no; #77 integrate-and-verify is the runtime verification. Record in decisions log.
- OQ5 `totalRowCount` override — one sentence owed on ADR-0005 (#78).
- OQ6 editing store — finding recorded on #74, rationale rewritten in #78.

## Verified correct

- No shipped feature declares a core key → #68 breaks nothing.
- `Signal<TRow[]>` satisfies `Shape` and `RowOf` infers `TRow` (mutable → readonly array
  assignability).
- `injector` in config, `columnsSchema` dual form, ADR-0010 splice intact, pipeline order fixed —
  all consistent between spec, architecture and D24.
- Error classification (D9) matches ADR-0014's channel (`console.error`, key-deduped) and its
  construction/runtime split.
