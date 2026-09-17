---
title: "Step 2 — tools/generate-overloads.ts: 15 createTable + 15 composeFeatures overloads as call-signature interfaces"
type: task-step
issue: 69
---

# Step 2 — `tools/generate-overloads.ts`: 15 `createTable` + 15 `composeFeatures` overloads as call-signature interfaces

**PR scope:** One generator script, two npm scripts, and the two files it emits. Nothing in
`src/` consumes the output yet — Step 4 does. `composeFeatures()`'s implementation is #71; its
overload interface is emitted here because D27 says one script owns both sets.

**Task type:** chore

**Skills used:** typescript-conventions

**Depends on:** Step 1 (the emitted interfaces reference `Feature`, `TableStore`,
`TableDataInput`, `TableConfig`)
**Parallel-safe with:** Step 3, Step 5

**Scaffolding agent:** — (main thread; `chore`)

## Files

- `libs/shared/table/tools/generate-overloads.ts` (new)
- `libs/shared/table/src/api/create-table.overloads.ts` (new — **generated**, committed)
- `libs/shared/table/src/api/features/compose-features.overloads.ts` (new — **generated**,
  committed)
- `package.json` (root — edit, two scripts)

> **The implementer writes the script only.** The user runs it and commits the two emitted
> files. Step 4 must not start until `create-table.overloads.ts` is on disk.

## Why This Step Exists

D27: arity 15, overloads generated, committed output drift-checked. ~30 near-identical blocks
hand-written is the failure mode being avoided. Emitting **call-signature interfaces** (user
decision at `/to-tasks`) keeps the implementation files hand-written and lets the drift check
diff a types-only artefact:

```ts
// create-table.overloads.ts (shape of the emitted file)
export interface CreateTableOverloads {
  <TRow>(data: TableDataInput<TRow>, config: TableConfig<TRow>): TableStore<TRow>;
  <TRow, O1 extends object>(
    data: TableDataInput<TRow>, config: TableConfig<TRow>,
    f1: Feature<TableStore<TRow>, O1>
  ): TableStore<TRow> & O1;
  <TRow, O1 extends object, O2 extends object>(
    data: TableDataInput<TRow>, config: TableConfig<TRow>,
    f1: Feature<TableStore<TRow>, O1>,
    f2: Feature<TableStore<TRow> & O1, O2>
  ): TableStore<TRow> & O1 & O2;
  // ... through f15
}
```

`composeFeatures` gets the same accumulation with `In` in place of `TableStore<TRow>`:

```ts
export interface ComposeFeaturesOverloads {
  <In extends Shape, O1 extends object>(f1: Feature<In, O1>): Feature<In, O1>;
  <In extends Shape, O1 extends object, O2 extends object>(
    f1: Feature<In, O1>, f2: Feature<In & O1, O2>
  ): Feature<In, O1 & O2>;
  // ... through f15
}
```

## What To Do

1. **Script** — `tools/generate-overloads.ts`, same conventions as `tools/generate-status.ts`
   (ESM, `node:fs`/`node:path`, `import.meta.dirname`, run with
   `node --experimental-strip-types`). Constants: `ARITY = 15`, the two output paths, and a
   header comment that names the generator path and says "generated — do not edit".
2. **Emit** both interfaces from one `renderOverloads({ name, leadingParams, base, arity })`
   helper: `createTable` has leading params `data`, `config` and base `TableStore<TRow>`;
   `composeFeatures` has no leading params and base `In`. Zero-feature signature only for
   `createTable`. Generic list per arity N: `TRow` (or `In extends Shape`), then
   `O1..ON extends object`. Slot k is `Feature<base & O1 & ... & O(k-1), Ok>`; return is
   `base & O1 & ... & ON` (for `composeFeatures`: `Feature<In, O1 & ... & ON>`).
3. **Imports in the emitted files**: `create-table.overloads.ts` imports `Feature` from
   `../engine/types` and `TableConfig`, `TableDataInput`, `TableStore` from `./types`;
   `compose-features.overloads.ts` imports `Feature`, `Shape` from `../../engine/types`.
4. **`--check` mode**: render to a string, compare byte-for-byte with the committed file,
   exit 1 with a message naming the file if they differ. `--dry-run` prints.
5. **npm scripts** in root `package.json`, next to `table:status`:
   - `table:overloads` → `node --experimental-strip-types libs/shared/table/tools/generate-overloads.ts`
   - `table:overloads:check` → same, with `--check`
6. Do **not** run the script. Do not hand-write the two output files.

## Implementation Notes

- Formatting: emit in the repo's Prettier style (2-space, single quotes, trailing commas) so a
  `prettier --write` pass is a no-op — otherwise the drift check fights the formatter. Put the
  emitted files in `.prettierignore` only if that proves impossible; say so in the PR.
- The three silent-`any` traps (research §"Three silent-failure traps") are guarded at the
  **feature** and `withComputed` declarations, not in these overloads — `Ok extends object`
  with no wildcard is exactly the verified probe shape. Do not add `IsAny` guards here.
- 16th argument: no overload matches → TS reports "No overload matches this call". That is the
  intended error (AC). No rest-parameter catch-all — a catch-all would degrade to `any`.

## Risks / Watchouts

- **`import.meta.dirname`** requires Node ≥ 20.11; `generate-status.ts` already relies on it.
- A `Feature<In, {}>` slot (member-less feature) intersects as `& {}`, which is inert. Step 6
  asserts no cosmetic `& object` leaks.
- Keep the generated file free of anything hand-maintained (no re-exports, no helpers) so
  regeneration is always a clean overwrite.

## Non-Goals

- No `composeFeatures()` implementation (#71) — the interface only.
- No CI wiring of `table:overloads:check` beyond the npm script; a project.json target can be
  added at #77 if wanted.

## Acceptance Checks

- [ ] `tools/generate-overloads.ts` exists, exports nothing, reads `ARITY = 15`.
- [ ] Running `npm run table:overloads` (user) writes both files; a second run is a no-op.
- [ ] `npm run table:overloads:check` exits 0 on committed output, 1 after editing one byte.
- [ ] Emitted `CreateTableOverloads` has 16 call signatures (0..15 features);
      `ComposeFeaturesOverloads` has 15 (1..15).
- [ ] Emitted files compile on their own (`tsc --noEmit`) once Step 1 is in.

---
← [Step 1: types — Feature<In, Out> contract](step-1-feature-contract-types.plan.md) | [Step 3: compose-table.ts — fold hands each feature the store](step-3-fold-store-only-input.plan.md) →
