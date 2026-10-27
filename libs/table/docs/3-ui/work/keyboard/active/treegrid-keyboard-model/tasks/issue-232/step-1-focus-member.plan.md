---
step: 1
type: code
commit: feat
depends_on: []
files:
  - libs/table/src/api/types.ts
  - libs/table/src/engine/slots.ts
  - libs/table/src/engine/compose-table.ts
  - libs/table/src/index.ts
  - libs/table/src/api/create-table.spec.ts
  - libs/table/src/api/create-table.types.spec.ts
  - libs/table/src/api/types.types.spec.ts
---

# Step 1 — Focus member: read and write

Adds the always-present `table.focus` member: read the focused position, write it with `moveTo`.
Id validation, `focusElement` and the request counter are left to steps 2 and 3.

Decisions: K12, K12b, K12c, K16

## Do

Add `FocusTarget<TCol>`, `FocusMoveOptions` and `TableFocus<TCol>` to `api/types.ts`, exactly as in [3-architecture.md § Types](../../3-architecture.md).
`TableFocus` is a callable `(): FocusTarget<TCol> | null` plus `moveTo(target, options?)`.
Do not add `focusRequests` yet.

Add `readonly focus: TableFocus<ColumnIdIn<TValues>>` to `TableStore`.

Add `'focus'` to `CORE_MEMBER_KEYS` in `engine/slots.ts`.

Build the member in `createBaseStore` (`engine/compose-table.ts`).
Back it with a per-call `signal<FocusTarget | null>(null)`.
Expose it as `Object.assign(computed(read), { moveTo })`, the same shape as `ExpansionSlice` and `TreeSlice`.
`moveTo` writes the target. It accepts `options` and ignores them in this step.

Export the three types from `src/index.ts`.

```ts
table.focus(); // null
table.focus.moveTo({ area: 'body', rowId: 'r1', columnId: null });
table.focus(); // { area: 'body', rowId: 'r1', columnId: null }
```

## Watch out

Create the signal inside `createBaseStore`, never at module scope.

`exhaustiveCoreMemberKeys` stops compiling until `'focus'` is listed.

The name stays `TableFocus`, not `FocusSlice`.

## Out of scope

- Id validation (step 2).
- `focusElement` and `focusRequests` (step 3).
- Recovery when data changes (#233).
- Any directive or DOM work (#235).

## Done when

- The test plan seams are green.
- `nx run shared-table:typecheck` and `nx run shared-table:typecheck-spec` are clean.
