# Step 2 — Decouple `path-proxy.ts` from the columns schema

**PR scope:** standalone. **Depends on:** Step 1 (AC #3 — the reading is
recorded before code moves). **Parallel-safe with:** Step 4.

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/schema/path-proxy.ts` (edit)
- `libs/table/src/columns-schema/types.ts` (edit)
- `libs/table/src/columns-schema/metadata.ts` (edit)
- `libs/table/src/columns-schema/schema.ts` (edit)
- `libs/table/src/columns-schema/schema.spec.ts` (edit — one test title string)
- `libs/table/src/api/features/with-grouping/schema.ts` (edit)
- `libs/table/src/api/features/with-grouping/types.ts` (edit — one comment)

## Why This Step Exists

`schema/path-proxy.ts` is meant to be the key-space-agnostic mechanism
behind every schema fn, and it is not: line 1 imports `MetadataRule` /
`MetadataAsyncRule` from `columns-schema/types`, and `PathRecorder.record()`
bakes both into its **shared** signature (`:18-20`). The shared mechanism
depends on one of its consumers, and that is the direct cause of the two
documented generic-erasure casts — `rules.push(rule as unknown as TRule)`
(`:57`) and `applyGroupingAsync`'s `rule as unknown as AnyGroupingRule<TRow>`
(`with-grouping/schema.ts:116-118`).

`assertPathIsCurrent` (`:82`) asserts nothing. It returns
`handle[PATH_RECORDER]`; the open-check lives inside `record()`. The name
describes a check that moved.

This step is node **M1** in [`decisions.md`](../../decisions.md).
Behaviour-preserving — no exported symbol changes shape, and every existing
spec passes with no assertion edited.

## What To Do

### 1. `schema/path-proxy.ts` — drop the columns arms

Delete the `import type { MetadataAsyncRule, MetadataRule } from
'../columns-schema/types';` line and the comment block at `:6-11` that
explains why the arms are there.

`PathRecorder.record()` becomes generic in its rule type only:

```ts
/**
 * Internal recorder every declare-phase call writes into. One instance per
 * schema-fn execution.
 * @internal
 */
export interface PathRecorder<TRow, TRule> {
  /** Records one rule into this session for later resolution by the owning
   * feature/schema. */
  record(rule: TRule): void;
}
```

In `createRecorderSession`, the stored `record` loses its generics and its
cast:

```ts
record(rule: TRule): void {
  assertOpen();
  rules.push(rule);
},
```

Delete the four-line "Sole generic-erasure boundary" comment above the push
— there is no longer a boundary there to document.

### 2. `schema/path-proxy.ts` — rename `assertPathIsCurrent` → `recorderOf`

```ts
/**
 * The recorder a handle was fabricated against. `record()` itself rejects a
 * handle used after its session closed, so the open-check stays in one place
 * and this is a plain accessor.
 */
export function recorderOf<TRow, TRule>(
  handle: RecordedHandle<TRow, TRule>
): PathRecorder<TRow, TRule> {
  return handle[PATH_RECORDER];
}
```

Also fix `createRecorderSession`'s own doc comment (`:34`), which names
`assertPathIsCurrent`.

Call sites, all mechanical:

| File | Sites |
|---|---|
| `columns-schema/metadata.ts` | import `:2`, `:44`, `:71` |
| `columns-schema/schema.ts` | the re-export on `:15` |
| `api/features/with-grouping/schema.ts` | import `:4`, and `:61`, `:78`, `:116`, `:131` |
| `columns-schema/schema.spec.ts` | `:69` — the `it(...)` **title string only** |

### 3. `columns-schema/types.ts` — `MetadataAsyncRule` goes method-shorthand

This is the fallout that makes the step more than a rename, and it must
land in the same commit or `metadataAsync()` stops compiling.

With the arms gone, `metadataAsync()`'s concrete
`MetadataAsyncRule<TRow, TParams, TResult, T>` has to be assignable to
`ColumnRule<TRow>`'s erased member `MetadataAsyncRule<TRow, unknown,
unknown, unknown>`. Under `strictFunctionTypes`, `factory`'s
`Signal<TParams | undefined>` parameter and `onSuccess`'s `TResult`
parameter are **contravariant** while declared as `readonly` properties, so
`unknown` is not assignable to either and the assignment fails.

`GroupingAsyncRule` already solved exactly this with method-shorthand
syntax and a comment saying why (`with-grouping/types.ts:32-37`). Mirror it:

```ts
export interface MetadataAsyncRule<TRow, TParams = unknown, TResult = unknown, T = unknown> {
  readonly kind: 'metadata-async';
  readonly columnId: string;
  readonly key: ColumnMetaKey<T>;
  readonly params: (ctx: ColumnRuleContext<TRow>) => TParams | undefined;
  // Method-shorthand syntax (not `readonly factory: (…) => …` properties) deliberately, so
  // `TParams`/`TResult`/`T` check bivariantly here — this member is reached only through
  // `PathRecorder.record(rule: TRule)`, where `TRule` is `ColumnRule<TRow>`, whose
  // `MetadataAsyncRule` member is erased to its `<unknown, unknown, unknown>` default.
  // Property-typed functions would reject a concretely-typed `factory`/`onSuccess` under
  // strict contravariance. Same shape and same reason as `GroupingAsyncRule`.
  factory(params: Signal<TParams | undefined>): ResourceRef<TResult | undefined>;
  onSuccess(result: TResult): T;
  readonly onError: (error: unknown) => T;
}
```

`params` and `onError` stay properties — `params`' parameter type does not
vary with the generics, and `onError` takes `unknown` at every
instantiation.

### 4. `with-grouping/` — delete the double cast, if it is gone

`applyGroupingAsync` (`schema.ts:98-119`) builds a typed `rule`, then
records it through `rule as unknown as AnyGroupingRule<TRow>` with an
eight-line comment tying the cast to `record()`'s `MetadataRule` /
`MetadataAsyncRule` arms. Those arms are gone, and `GroupingAsyncRule`'s
methods are already bivariant, so the cast should be unnecessary:

```ts
recorderOf<TRow, AnyGroupingRule<TRow>>(path).record(rule);
```

**Verify, do not assume** — #111's AC #7 asks for exactly this. Remove the
cast and its comment, typecheck, and:

- If it compiles, the cast is gone. Done.
- If it does not, restore the cast and **rewrite** its comment to name the
  real cause the compiler reports, not the arms that no longer exist.
  Record the finding in the PR description either way.

In `with-grouping/types.ts:32-37`, the comment names "`PathRecorder.record()`'s
generic `| TRule` catch-all arm". That arm is gone. Reword it to point at
`record(rule: TRule)` and the erased `AnyGroupingRule<TRow>` union member —
the shorthand itself is still required, only the explanation changes.

## Implementation Notes

- **`PathRecorder`'s `TRow` becomes phantom, on purpose.** After the arms
  are dropped nothing in the interface mentions `TRow`, so `PathRecorder<A,
  R>` and `PathRecorder<B, R>` are structurally identical. Keep the
  parameter: it is part of `ColumnHandle` and `GroupingHandle`'s declared
  shape (`columns-schema/types.ts:26`, `with-grouping/types.ts:84`), which
  AC #8 freezes. Handle-mixing is still rejected, because `TRule` is always
  instantiated as `ColumnRule<TRow>` or `AnyGroupingRule<TRow>` and carries
  the row type itself.
- **Why `metadata()` needs no change.** `MetadataRule<TRow, T>`'s only
  generic position is `logic: T | ((ctx) => T)` — a covariant return.
  It erases to `MetadataRule<TRow, unknown>` cleanly.
- **Why the spec title may be edited.** `columns-schema/schema.spec.ts:69`
  names `assertPathIsCurrent` in an `it(...)` string. AC #8 freezes spec
  *assertions*, not a test's prose; leaving a title naming a deleted symbol
  is a stale reference nobody will find later. No `expect` in that file
  changes.

## Risks / Watchouts

- **`ngc` aborts at the first `.ts` error and never reaches templates.**
  This step will produce `.ts` errors on the first run by design (the
  `metadataAsync` fallout). Fix, re-run, and only the second, source-clean
  run says anything about the story templates —
  `.claude/rules/typecheck-angular-templates.md`.
- Run `nx run shared-table:typecheck-spec` too. `columns-schema/schema.spec.ts`
  and `with-grouping/schema.spec.ts` are not in `tsconfig.lib.json`'s
  include, so the lib target cannot see the renamed call sites in them.
- Do not "simplify" `RecordedHandle` or `createPathProxy` while in the
  file. Both are already key-space agnostic and are what Step 3 builds on.

## Non-Goals

- No shared runner — that is Step 3, and it rewrites the same two
  `schema.ts` files, which is why these are sequenced.
- No shared validator — Step 4, disjoint files.
- `engine/filters/build.ts` is untouched (reading B).
- No change to `index.ts`. `recorderOf` and `PathRecorder` are `@internal`
  and were never exported from the public barrel.

## Acceptance Checks

- [ ] `libs/table/src/schema/path-proxy.ts` imports nothing from
      `columns-schema` (AC #1).
- [ ] `assertPathIsCurrent` no longer exists anywhere in `libs/table/src`
      (AC #2).
- [ ] `rules.push(rule as unknown as TRule)` is gone; the `record()`
      signature is `record(rule: TRule): void`.
- [ ] `applyGroupingAsync`'s double cast is either deleted or kept with a
      comment naming the actual compiler error (AC #7).
- [ ] No `expect(...)` in any existing spec was edited (AC #8).
- [ ] `nx run shared-table:typecheck` clean — **run twice**.
- [ ] `nx run shared-table:typecheck-spec` clean.

---
← [Step 1: Record reading B](step-1-record-reading.plan.md) | [Step 3: Shared recording runner](step-3-shared-recording-runner.plan.md) →
