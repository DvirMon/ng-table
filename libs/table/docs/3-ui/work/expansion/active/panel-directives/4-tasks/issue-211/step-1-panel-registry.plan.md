---
step: 1
type: code
commit: feat
depends_on: []
files:
  - libs/table/src/directives/panel-registry.ts (new)
  - libs/table/src/directives/ngp-table.directive.ts
---

# Step 1 — Panel registry and its provider

This step adds an internal per-table registry that mints panel ids and tracks panels and toggles. It leaves the panel directive to Step 2 and the toggle to #212.

Decisions: [D1, D9, D13](../../1-decisions.md) · [E44, E52, E56](../../../../../../../decisions/expansion.md)

## Do

- Create `panel-registry.ts` with a factory and an `NGP_TABLE_PANEL_REGISTRY` `InjectionToken`.
- Do not export either from `index.ts`. Do not add them to `table.tokens.ts`, which is re-exported with `export *`.
- Implement this contract:

```ts
interface PanelRegistry {
  registerPanel(id: RowId, host: HTMLElement): string;
  unregisterPanel(id: RowId): void;
  registerToggle(id: RowId, host: HTMLElement): void;
  unregisterToggle(id: RowId, host: HTMLElement): void;
  panelId(id: RowId): Signal<string | null>;
  toggleOf(id: RowId): HTMLElement | null;
}
```

- `registerPanel` returns the minted id `ngp-t${tableSeq}-panel-${encodeURIComponent(String(id))}`.
- `tableSeq` is a module-level counter. Each registry instance takes its value once.
- In dev mode, `registerPanel` throws when the `RowId` already has a panel. The message names the id and says one panel per row.
- `panelId` is reactive and returns `null` while no panel is registered. One signal holding a `ReadonlyMap` is enough.
- `unregisterToggle` removes the toggle only when the given host matches the registered one.
- `NgpTableDirective` provides the registry with a factory provider beside `NGP_TABLE_STORE`.

## Watch out

- Gate the dev check with `typeof ngDevMode === 'undefined' || !ngDevMode`, as `assertTreeComposed` does.
- Do not use `effect()`.

## Out of scope

- Any directive that uses the registry.
- Tests. The registry is tested only through `ngpTablePanel` in Step 2 and through the toggle in #212.

## Done when

- [ ] `index.ts` does not export the token or the factory.
- [ ] `NgpTableDirective` provides the registry.

---

[Step 2: ngpTablePanel: identity, inert and wiring errors](step-2-panel-identity-inert.plan.md) →
