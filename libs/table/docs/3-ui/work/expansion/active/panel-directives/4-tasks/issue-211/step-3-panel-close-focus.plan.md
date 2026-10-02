---
step: 3
type: code
commit: feat
depends_on: [2]
files:
  - libs/table/src/directives/ngp-table-panel.directive.ts
  - libs/table/src/directives/ngp-table-panel.directive.spec.ts
---
# Step 3 — ngpTablePanel: close paths and focus return

This step adds `close()`, the Esc handler and focus return to the panel. It leaves focus-return tests and the toggle directive for #212.

Decisions: [D5, D6, D8](../../1-decisions.md) · [E48, E49, E51](../../../../../../../decisions/expansion.md)

After closing on Esc, the panel calls `event.preventDefault()` to mark Esc handled. This was decided on 2026-10-02 at `/to-tasks`. It extends D6 and is not yet in the decisions log.

## Do
- Add `exportAs` and the Esc listener to the existing host metadata:

```ts
@Directive({ selector: '[ngpTablePanel]', exportAs: 'ngpTablePanel',
  host: { …, '(keydown.escape)': 'onEscape($event)' } })
close(): void  // collapse([id]), then returnFocus({ allowBody: true })
```

- `onEscape` returns when `event.defaultPrevented` is true. Otherwise it calls `close()`, then `event.preventDefault()`.
- `returnFocus(allowBody)` reads `document.activeElement`.
- It sets `inside = host.contains(active)`.
- It sets `allowed = inside || (allowBody && (active === null || active === document.body))`.
- When `allowed`, it focuses `registry.toggleOf(id)`, but only if that element is connected. Use plain `.focus()`.
- In `onDestroy`, call `returnFocus({ allowBody: false })` before the existing `inert` write.

## Watch out
- The order in `onDestroy` matters. Writing `inert` first drops focus to body before the check runs.
- Do not use `effect()`.

## Out of scope
- Focus-return tests. No toggle exists until #212.
- The toggle directive.

## Done when
- [ ] The tests in the test plan pass.
- [ ] A consumer can call `p.close()` through `#p="ngpTablePanel"`.

---
← [Step 2: ngpTablePanel: identity, inert and wiring errors](step-2-panel-identity-inert.plan.md)
