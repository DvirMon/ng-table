---
step: 3
type: code
commit: feat
depends_on: [2]
files:
  - libs/table/src/api/types.ts
  - libs/table/src/engine/compose-table.ts
  - libs/table/src/api/create-table.spec.ts
  - libs/table/src/api/create-table.types.spec.ts
---

# Step 3 — Focus request counter

Adds `table.focus.focusRequests`, a counter that records accepted `focusElement` requests.
The directive that reads it is left to #235.

Decisions: K15, K12c

## Do

Add `readonly focusRequests: Signal<number>` to `TableFocus`.

JSDoc: incremented by each accepted `moveTo(…, { focusElement: true })`.
Read by the `ngpTable` directive to move DOM focus after render.
Consumers use the `focusElement` option, not this signal.

Back it with a per-table `signal(0)`, exposed read-only.

`moveTo` increments it only when the write is accepted and `options?.focusElement === true`.
It is never reset, and there is no consume API.

```ts
table.focus.moveTo(target, { focusElement: true });
table.focus.focusRequests(); // 1
```

## Watch out

Increment after step 2's check passes, never on the reject path.

Test `=== true`, not "options present".

## Out of scope

- The directive effect that consumes the counter (#235).

## Done when

- The test plan is green.
- Both typecheck targets are clean.
