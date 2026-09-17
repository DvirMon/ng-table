# 03 — Cell directive

**What to build:** `NgpTableCellDirective` on `<td>` for data cell styling hooks and identity. Applies `data-column-id` host attribute and is queryable/extensible for future cell-scoped features without template changes.

**Blocked by:** 01 — Core directives and DI tokens

**Status:** ready-for-agent

- [ ] `NgpTableCellDirective` — selector `[ngpTableCell]`, required input `columnId` (alias `ngpTableCell`)
- [ ] Host binding `[attr.data-column-id]` set to `columnId`
- [ ] No behavior logic yet (no click handling, no value formatting)
- [ ] Export from barrel
