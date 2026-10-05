# Implementation Progress — column mutation free functions

**Issue:** #13
**Status:** 9 / 9 complete

| Step | Title                                                                          | Status  | PR  |
| ---- | ------------------------------------------------------------------------------ | ------- | --- |
| 1    | `engine/core.ts` + `engine/types.ts` — writable columns, drop mutation methods | ✅ done | —   |
| 2    | `api/types.ts` — public `TableStore` mirrors writable-columns change           | ✅ done | —   |
| 3    | `api/update-columns.ts` — the free functions                                   | ✅ done | —   |
| 4    | `with-columns-schema` — switch internal wiring to the free function            | ✅ done | —   |
| 5    | `table.mock.ts` — drop the four method stubs                                   | ✅ done | —   |
| 6    | `apps/demo/table-demo.ts` — switch to the free function                        | ✅ done | —   |
| 7    | `api/create-table.spec.ts` — remove stale store-method tests                   | ✅ done | —   |
| 8    | `api/update-columns.spec.ts` — unit tests for the free functions               | ✅ done | —   |
| 9    | `table/CLAUDE.md` — sync file-table row                                        | ✅ done | —   |
