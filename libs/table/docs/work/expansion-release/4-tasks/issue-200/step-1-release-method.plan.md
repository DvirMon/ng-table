---
step: 1
type: code
commit: feat
depends_on: []
files:
  - libs/table/src/api/features/with-expansion.ts
  - libs/table/src/api/features/with-expansion.spec.ts
---

# Step 1 — The release() method on the expansion slice

Adds `release` to `ExpansionSlice` and implements it in `buildExpansionSpec`.
Leaves the docs to Step 2.

Decisions: [E62, E63, E39](../../../../decisions/expansion.md)

Tests are written first, from the approved test plan: [step-1-release-method.test-plan.md](step-1-release-method.test-plan.md).

## Do

- Add `release(ids?: readonly RowId[]): void` to `ExpansionSlice`.
- Give it a consumer-facing JSDoc. It frees the kept panels of closed ids. Open ids are skipped. Omitted `ids` means every closed id. `[]` is a no-op. It never emits.
- Add `function release` in `buildExpansionSpec`, next to `set`.
- Add `release` to the `Object.assign` member object.
- The candidates are `ids`, or every id in `everExpanded()` when `ids` is omitted.
- Remove a candidate only if it is not in `store.expanded()`.
- If nothing is removed, do not write the signal. The `Set` reference stays the same.
- Otherwise write a new `Set`. This is the same copy-on-write shape the `onExpanded` accumulator uses.
- Do not call the store's write funnel. Do not emit on `changed`. Take no options parameter.

```ts
table.expansion.release(); // frees every closed kept panel
table.expansion.release(['r1']);
```

## Watch out

- The open-id skip also applies when `ids` is omitted.
- Only an omitted argument means "all". `[]` must not fall into that branch.
- Unknown ids are runtime data. Ignore them and never throw (ADR-0014).
- `index.ts` does not change. The slice type is not exported today.

## Out of scope

- An options parameter.
- Closing open panels.
- Pruning on row removal.
- A tree counterpart.
- Any directive change.
- Exporting slice types.

## Done when

- [ ] `release()` removes only closed ids, including with no argument.
- [ ] A call that removes nothing leaves `everExpanded()` the same reference.
- [ ] `changed` never emits from `release()`.
- [ ] All eight seams in the test plan pass.

---

[Step 2 — Document release() as shipped](step-2-docs-release.plan.md) →
