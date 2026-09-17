# 02 — Column directive

**What to build:** `NgpTableColumnDirective` on `<th>` for header cell identity and presentation overrides. Resolves column id against `store.columns()` via injected `NGP_TABLE_STORE`, and reads optional width override input for template-local styling.

**Blocked by:** 01 — Core directives and DI tokens

**Status:** ready-for-agent

- [ ] `NgpTableColumnDirective` — selector `[ngpTableColumn]`, required input `columnId`, optional input `width` (alias `ngpColumnWidth`)
- [ ] Computed `column` property resolves `columnId` against store's `columns()` signal
- [ ] No host bindings (presentation overrides are template-local, not element attributes)
- [ ] Export from barrel
