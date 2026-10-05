# Step 4 — The generator carries the map into every slot

**PR scope:** standalone. **Depends on:** Step 3 (the generator emits the
types Step 3 declares; emitting them first produces 16 signatures that
reference a shape that does not exist).
**Parallel-safe with:** Step 2.

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/tools/generate-overloads.ts` (edit)
- `libs/table/src/api/create-table.overloads.ts` (regenerated — never
  hand-edited)
- `libs/table/src/api/create-table.ts` (edit, if the assertion demands it)

## Why This Step Exists

Step 3 opened the slot on `TableStore`. Nothing fills it: `createTable()`
is typed by `CreateTableOverloads`, 16 generated call signatures that bind
`TRow` and `TId` from `config` and hand `TableStore<TRow, TId>` to every
feature slot. Until those signatures bind the declaration and derive the
map, `TValues` defaults to `ColumnValueMap` at every real call site and
the map is dead on arrival — present in the type, never populated.

This is the same shape as #113 Step 2, and the same reason it was a step
of its own: the generator is one edit and the generated file is 16 × 15
lines of consequence. Keeping them apart from the shape change means a
failure here is a generator failure, not an ambiguous one.

## What To Do

**1. `tools/generate-overloads.ts` — `CREATE_TABLE` only.**

```ts
baseGenerics: ['TRow', 'TCols extends readonly ColumnDefInput<TRow, string>[]'],
base: 'TableStore<TRow, ColumnValues<TRow, TCols>>',
leadingParams: ['data: TableDataInput<TRow>', 'config: TableConfig<TRow, TCols>'],
```

`imports` gains `ColumnDefInput` and `ColumnValues` alongside the existing
`TableConfig`, `TableDataInput` and `TableStore` from `./types`.

Nothing else in the generator moves. `ARITY`, `contributions`,
`renderSlotInput`, `renderReturn`, `renderSignature` and the whole
accumulation rule (D27 — slot k is typed against the base ∩ every
preceding slot's contribution) are untouched. If the diff reaches any of
them, the change went wider than it needs to.

**2. Regenerate.** `npm run table:overloads`. Never hand-edit
`create-table.overloads.ts`; if the emitted file is wrong, the generator
is wrong.

**3. `COMPOSE_FEATURES` gets no change.** It is generic in
`In extends Shape`, and `In` is bound at the call site to the concrete
`TableStore<TRow, TValues> & O1 & …` the enclosing `createTable()` slot
supplies — so the phantom rides through structurally, with no `TRow` and
no `TValues` ever named in that file. The evidence is #113 Step 3's case
4, which already proved exactly this carriage for the id union; Step 5
extends that case to the map.

**4. `api/create-table.ts` — check the assertion still holds.** The
implementation signature is `(data: TableDataInput<TRow>, config:
TableConfig<TRow>, ...features): TableStore<TRow>`, cast
`as CreateTableOverloads`. With both new parameters defaulted it should
keep compiling untouched. If it does not, **widen the implementation
signature, not the overloads** — the cast is the static/dynamic boundary
and the overloads are the contract.

## Implementation Notes

- **The generator's `base` string is used in three places** — each slot's
  `In`, each preceding slot's contribution base, and the return type — so
  `TableStore<TRow, ColumnValues<TRow, TCols>>` appears once in source and
  135 times in output. Read the first two emitted signatures after
  regenerating; if they are right, the rest are.
- **`npm run table:overloads` runs the emitted source through Prettier
  with the repo's own config**, so `prettier --write` over the result is a
  no-op and `--check` drift is a real signal rather than a formatting
  artifact. If the check fails right after a regenerate, the generator's
  output changed shape — read the diff, do not re-run.
- **`ColumnValues<TRow, TCols>` is evaluated once per signature, not once
  per slot.** It is a flat, non-recursive mapped type over `TCols[number]`
  — no depth cap, no path recursion (contrast TanStack's `DeepKeys`, which
  caps at depth 5). Compile-time cost on a wide column list is untested;
  see Non-Goals.
- **The `ColumnDefInput` import is new to the emitted file** because the
  constraint names it. Confirm the generated import line resolves from
  `src/api/` — it is `./types`, same as the others.

## Risks / Watchouts

- **A default on `TCols` is what keeps every existing call compiling.**
  Step 3 gives `TableConfig` a defaulted `TCols`; the generated signatures
  bind it explicitly. A call passing a plain widened array infers
  `TCols = ColumnDefInput<TRow, string>[]`, whose `ColumnValues` is an
  index-signature map, whose `ColumnIdIn` is `string` — today's behaviour
  exactly. Verify that against a story fixture, not by reasoning.
- **`create-table.spec.ts` and `with-computed.spec.ts` both declare local
  stand-ins for the overload interface** (`with-computed.spec.ts:17-26`
  hand-writes two arities). Those are typed in terms of `TableStore<MockRow>`
  — one argument, defaulted — so they should be unaffected. Check them
  anyway; they are the places a signature change surfaces as a confusing
  unrelated failure.
- **`ngc` aborts at the first `.ts` error and never reaches the template
  phase.** Fix, re-run, and only the source-clean second run says anything
  about the story templates.

## Non-Goals

- **No feature config changes.** `withFiltering`, `withSorting` and the
  grouping retrofit own their own re-keying —
  [#115](https://github.com/DvirMon/ng-table/issues/115),
  [#100](https://github.com/DvirMon/ng-table/issues/100), and the
  follow-up issue.
- **No consumer reads the map.** This step makes it reachable; nothing
  downstream of `createTable()` resolves against it yet.
- **No `compose-features.overloads.ts` change.** See point 3.
- **No compile-time benchmark.** The workspace discovery doc lists a wide
  (50+) column measurement as not researched, and running one is a build
  (`.claude/rules/never-run-build-serve-test-unprompted.md`). If the
  typecheck gets visibly slower, say so and let the user decide — do not
  start measuring.

## Acceptance Checks

- [ ] `npm run table:overloads:check` clean.
- [ ] `nx run shared-table:typecheck` clean, **run twice**.
- [ ] `nx run shared-table:typecheck-spec` clean.
- [ ] `compose-features.overloads.ts` is unchanged in `git diff`.
- [ ] `git diff --stat` shows the generator, `create-table.overloads.ts`,
      and at most `create-table.ts` — nothing else.

---

← [Step 3: The store shape carries the map](step-3-store-carries-the-map.plan.md) | [Step 5: The end-to-end guard](step-5-end-to-end-guard.plan.md) →
