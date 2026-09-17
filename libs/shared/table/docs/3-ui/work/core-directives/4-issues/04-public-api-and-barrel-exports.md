# 04 — Public API and barrel exports

**What to build:** Wire all four directives + both injection tokens into the public API. Update `index.ts` barrel exports, ensure directives are discoverable and documented for consumers.

**Blocked by:** 01, 02, 03 — all directives must exist first

**Status:** ready-for-agent

- [ ] All four directive classes export from `table.directives.ts`
- [ ] Both injection tokens export from `table.directives.ts`
- [ ] `index.ts` barrel includes directives and tokens
- [ ] Directives standalone-ready (no module exports needed)
- [ ] JSDoc on each directive notes its element/role/inputs per spec (`core.md`, `columns.md`)
