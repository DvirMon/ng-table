---
step: 2
type: code
commit: feat
depends_on: [1]
files:
  - libs/table/src/engine/render-stages.ts
  - libs/table/src/engine/compose-table.spec.ts
  - libs/table/src/engine/render-stages.spec.ts
---

# Step 2 — Runtime row-id checks on render stages

`runRenderStages` checks each stage's output after it runs,
walking nested `children`. The stage's output is always passed
through unchanged; nothing throws.

Decisions: [Checks](../../plan.md)

## Do

Two checks, both walking a stage's full output tree:

- duplicate ids in the output — report;
- a real row (`data !== null`) whose id was not in that stage's
  input — report. A row with `data === null` is made up and is
  exempt.

Each check reports at most once per stage per evaluation, via
`console.error`. Message shape:

```
[createTable] render stage "tree" (feature 1) emitted duplicate row id "r1" — output passed through.
[createTable] render stage "tree" (feature 1) emitted row id "x" that was not in its input — output passed through.
```

Not gated on `ngDevMode`. The id set built from one stage's
output becomes the next stage's input set, so each output is
walked once. The seed's id set is the first stage's input.

## Watch out

- This is the hot render path. One walk per stage output, no
  per-row try/catch.
- `synthesizesRows` is not read at runtime.
- `render-stages.spec.ts`'s `mapNodes reach` test (~line 65) has
  a stage emitting a new real row. It will now log. Silence it
  with `vi.spyOn(console, 'error').mockImplementation(() => {})`
  in that test.

## Out of scope

- Pipeline-stage checks.
- Any change to grouping's own input self-check
  (`engine/grouping/render.ts`).
- Documenting the inert-stage contract.

## Done when

- [ ] A duplicate id and an invented real id each report once
      and rows still render.
- [ ] `data: null` rows never trigger a containment report.
- [ ] Reports fire with `ngDevMode` off, per
      [step-2-runtime-row-id-checks.test-plan.md](step-2-runtime-row-id-checks.test-plan.md).

---

← [Step 1: Carry the feature label on resolved stages](step-1-resolved-stage-label.plan.md) | [Step 3: Record the made-up-row ruling](step-3-record-made-up-row-ruling.plan.md) →
