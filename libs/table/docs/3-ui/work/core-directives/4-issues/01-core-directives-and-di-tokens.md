# 01 — Core directives and DI tokens

**What to build:** `NgpTableDirective` on `<table>` (store anchor, provides `NGP_TABLE_STORE`), `NgpTableRowDirective` on `<tr>` (carries `RenderRow`, provides `NGP_TABLE_ROW`), and both injection tokens. This unblocks all feature directives (sort, selection, expansion, etc.) that depend on row or store DI.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `NGP_TABLE_STORE` token (`InjectionToken<NgpTableDirective>`)
- [ ] `NGP_TABLE_ROW` token (`InjectionToken<NgpTableRowDirective>`)
- [ ] `NgpTableDirective` — selector `table[ngpTable]`, required input `store`, self-provides under `NGP_TABLE_STORE`
- [ ] `NgpTableRowDirective` — selector `tr[ngpTableRow]`, required input `renderRow`, computed `rowId`, host bindings for `data-row-kind` and `data-depth`, self-provides under `NGP_TABLE_ROW`
- [ ] Type-safe (no `any`/`unknown` at the injection boundary; directives use `unknown` row type only)
- [ ] Both directives export from barrel
