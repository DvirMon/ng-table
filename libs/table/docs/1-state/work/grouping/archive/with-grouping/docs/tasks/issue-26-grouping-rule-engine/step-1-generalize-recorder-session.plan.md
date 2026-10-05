---
title: 'Step 1 — generalize the recorder-session machinery over rule type'
type: task-step
issue: 60
---

# Step 1 — generalize the recorder-session machinery over rule type

**PR scope:** Type-level refactor only. No behavior change to `columnSchema()`/`applyVisible`/
`metadata()` — every existing call site must keep compiling and every existing spec must keep
passing unchanged.

**Task type:** code

**Skills used:** typescript-conventions, file-organization

**Depends on:** none (foundational for this issue)

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/schema/column-schema.types.ts` (edit)
- `libs/shared/table/src/schema/column-schema.ts` (edit)

## Why This Step Exists

D8 commits to the schema-fn declarative layer "reusing `createRecorderSession()`
(`schema/column-schema.ts`), which already collects `apply*` calls into an ordered array in call
order and hands out typed `ColumnHandle`s via the `ColumnsPath` proxy." Today that machinery is
hard-wired to one rule family — `ColumnRule<TRow> = MetadataRule<TRow> | MetadataAsyncRule<TRow>`.
Grouping's declarative sugar (Step 2/3) needs the identical session/proxy mechanism recording a
different rule family (`GroupingRule<TRow>` / `GroupingAsyncRule<TRow>`), not a hand-rolled
duplicate — duplicating the session would violate `general-mechanism-over-enumerated-cases.md`
(one mechanism, not one per consumer) for zero benefit, since the two families never need to
mix inside the same session.

Decision: `../../../3-spec.md` D8.

## What To Do

Parameterize the session, the handle, the path proxy, and the runner over the recorded rule
type, defaulting to today's `ColumnRule<TRow>` so every existing call site is source-compatible
with no edits:

```ts
// column-schema.types.ts
export interface ColumnSchemaRecorder<TRow, TRule = ColumnRule<TRow>> {
  record(rule: TRule): void;
}

export interface ColumnHandle<
  TRow,
  K extends Extract<keyof TRow, string> = Extract<keyof TRow, string>,
  TRule = ColumnRule<TRow>,
> {
  readonly id: K;
  readonly [COLUMN_RECORDER]: ColumnSchemaRecorder<TRow, TRule>;
}

export type ColumnsPath<TRow, TRule = ColumnRule<TRow>> = {
  readonly [K in Extract<keyof TRow, string>]: ColumnHandle<TRow, K, TRule>;
};
```

```ts
// column-schema.ts
function createRecorderSession<TRow, TRule = ColumnRule<TRow>>(): {
  recorder: ColumnSchemaRecorder<TRow, TRule>;
  rules: TRule[];
  close(): void;
  assertOpen(): void;
} {
  /* same body, rules: TRule[], recorder.record(rule: TRule) pushes directly */
}

export function buildColumnsPath<TRow, TRule = ColumnRule<TRow>>(
  recorder: ColumnSchemaRecorder<TRow, TRule>,
): ColumnsPath<TRow, TRule> {
  /* unchanged logic, propagate TRule */
}

export function runColumnsSchemaFn<TRow, TRule = ColumnRule<TRow>>(
  fn: (path: ColumnsPath<TRow, TRule>) => void,
): readonly TRule[] {
  /* unchanged body, propagate TRule */
}
```

`assertPathIsCurrent<TRow, TRule = ColumnRule<TRow>>(handle: ColumnHandle<TRow, never, TRule>): ColumnSchemaRecorder<TRow, TRule>` gets the same default-parameter treatment.

## Implementation Notes

- **The exact generic shape of `record()` is an implementation judgment call, not a typographic
  requirement.** Today's `record<TParams, TResult, T>(rule: MetadataRule<TRow, T> |
MetadataAsyncRule<TRow, TParams, TResult, T>)` is method-generic so `metadata()`/`metadataAsync()`
  (`column-metadata.ts`) get contextual typing of the `{ kind, columnId, key, logic }` literal at
  the call site. A plain `record(rule: TRule)` with `TRule` fixed by the session should typecheck
  the same call sites via structural assignability (a `MetadataRule<TRow, string>` object is
  assignable into a `ColumnRule<TRow>`-typed parameter, same erasure `column-schema.ts` already
  documents as "the sole generic-erasure boundary") — verify by running the existing specs, don't
  assume it compiles from reading alone.
- `ColumnRule<TRow>`, `columnSchema()`, `resolveColumnsConfig()`, and every `apply*` function in
  `column-rules.ts`/`column-metadata.ts` reference these types with zero type arguments today —
  the default-parameter (`TRule = ColumnRule<TRow>`) is what keeps them compiling unedited. Don't
  touch those call sites in this step.
- Keep the doc comments' framing ("mirrors Signal Forms' `FieldPathNode`", "sole generic-erasure
  boundary") — they still apply verbatim to the generalized version; update only what actually
  changed (the added `TRule` parameter).

## Risks / Watchouts

- **Don't collapse `TRule` to `unknown` at the interface level.** The point of the parameter is
  that a _session_ is homogeneous (one rule family per session) while different call sites
  instantiate it differently — `unknown` would defeat the type-checking `assertRuleColumnIdsAreKnown`-
  style downstream code relies on.
- **Don't change `COLUMN_RECORDER`'s runtime value or the proxy's `get` trap logic** — this step is
  additive to the type surface only; the `Proxy` implementation in `buildColumnsPath` is unchanged
  except for propagating `TRule` through its type parameters.
- Re-run `column-schema.spec.ts` and `column-metadata.spec.ts` after the edit — a regression here
  would silently break every `applyVisible`/`metadata()` caller in the codebase.

## Non-Goals

- No grouping-specific types yet (`GroupingRule`, `applyGrouping`) — that's Step 2/3.
- No change to `resolveColumnsConfig()` or `wireColumnsSchemaAsync()` — they keep working at the
  default `TRule = ColumnRule<TRow>` instantiation, untouched.

## Acceptance Checks

- [ ] `tsc --noEmit` passes with no new errors anywhere in `libs/shared/table`.
- [ ] `column-schema.spec.ts` and `column-metadata.spec.ts` pass unchanged (no test file edits in
      this step).
- [ ] `ColumnRule<TRow>`, `ColumnHandle<TRow>`, `ColumnsPath<TRow>` (zero type arguments, relying
      on the new default) still resolve to the exact same effective types they did before this
      step, for every existing caller.

---

[Step 2: Grouping rule types + engine fold →](step-2-grouping-rule-types-and-fold.plan.md)
