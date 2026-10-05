# Step 1 — Split the shared body; gate the construction half

**PR scope:** standalone. **Depends on:** none (#131 shipped).
**Parallel-safe with:** Step 2

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/schema/validate.ts` (edit)
- `libs/table/src/api/features/with-grouping/feature.ts` (edit —
  writer call site only, `:169`)

## Why This Step Exists

Issue #132: "Verify the writer path is genuinely a separate
throw site before landing the wrap; if the two share a body,
the split has to be made structural first."

**Verified 2026-09-24: they share a body.** Grouping's
construction check (`feature.ts:112`) and its writer check
(`feature.ts:169`) both call `assertDeclarationsAreKnown`.
Architecture R8's "the writer throw lives elsewhere" is wrong
for HEAD. Gating that body as-is would strip the writer throw
from production, which reverses G76.

So this step makes the split structural and adds the gate in
the same change. R7 puts the gate once, in the shared body.

## What To Do

### 1. Two exports, one throwing body

In `schema/validate.ts`:

- An **ungated** export for writer paths, e.g.
  `assertWrittenIdsAreKnown(ids, knownIds, label)`. It holds
  the loop and the `throw`, the only copy of either.
- `assertDeclarationsAreKnown(declaredIds, knownIds, label)`
  keeps its name and signature. Its body is the `ngDevMode`
  gate, and inside the gate it calls the ungated export.
  **This is the only gate in the file.**

Name the ungated export for the path that uses it (a written
id), per `declarative-naming`. Don't use a name like `Raw` or
`Ungated`.

### 2. The gate spelling (R7)

Copy the spelling from `engine/columns.ts:17` and `:51`:

```ts
declare const ngDevMode: boolean | undefined;
// …
if (typeof ngDevMode === 'undefined' || ngDevMode) { … }
```

Put the `declare` at module scope with the same comment as
`columns.ts:14-16`. Don't add an ambient `.d.ts`.

### 3. E12 — the message

`:17-18` currently ends with "no column with this id exists
in the `columns` array." There is no such array now. Change
it to say that no declared column has this id, without naming
any config property. `label` already names the declaring
surface, so no caller needs to change for this.

### 4. Grouping's writer

`feature.ts:169` (inside `groupingView`'s write callback)
calls the ungated export. `feature.ts:112` (construction)
stays on `assertDeclarationsAreKnown`, so it becomes
dev-only. That is G76.

Rewrite the doc comment on the ungated export to name why it
is ungated: the ids come from a user action or a saved
layout, may never appear in dev, and G76 covers it. Update
the file-level doc comment's claim that one body serves
"`columnsSchema`, `withGrouping`, `withFiltering` and
`withSorting`". The only callers today are `resolve.ts` and
grouping, so re-grep before writing the new list.

## Implementation Notes

- Gate by wrapping, not by returning early from a shared
  body. The ungated export must never read `ngDevMode`.
- Don't touch `feature.ts:194-203` (`groupingLevels`' degrade
  path, G72). It is the runtime half and has nothing to do
  with this change.

## Risks / Watchouts

- `validate.spec.ts:15-16` asserts the old message
  literally, so it fails after this step. Step 4 owns that
  fix. Don't edit specs here.
- `with-grouping/feature.spec.ts:690` and `:719` (the writer
  throws) must keep passing unchanged. In vitest
  `ngDevMode` is undefined, so both halves still throw there.

## Non-Goals

- Moving any check into `createColumns` (Step 2).
- Switching the writer to degrade-and-report. R8 rejected
  that and recorded it as the option to revisit.
- Spec edits (Step 4).

## Acceptance Checks

- [ ] `schema/validate.ts` contains exactly one `ngDevMode`
      test, and it is in `assertDeclarationsAreKnown`.
- [ ] Grouping's writer calls the ungated export, and
      grouping's construction path does not.
- [ ] The message no longer mentions a `columns` array.
- [ ] `nx run shared-table:typecheck` clean, **run twice**.
- [ ] Hand-off names the ungated export's final name.
      Steps 4 and 5 need it.

---

[Step 2: Move the checks into `createColumns`](step-2-relocate-into-create-columns.plan.md) →
