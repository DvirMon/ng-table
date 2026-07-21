---
globs:
  - "libs/**/*.ts"
  - "apps/**/*.ts"
---

# File organization: one concern per file

Split generated/edited code by concern instead of putting everything in one file. Follow the naming pattern already used in `libs/shared/design-system/src/ui/table/` (`table.store.ts`, `table.types.ts`, `table.pipeline.ts`): `<feature>.<concern>.ts`, not a bare generic name — this avoids collisions when multiple features live in sibling folders and keeps imports self-describing.

| Concern | File | Contents |
|---|---|---|
| Types/models | `<feature>.types.ts` | interfaces, type aliases, enums |
| Store/state | `<feature>.store.ts` | signal store / state container, actions |
| Mock data | `<feature>.mock.ts` | fixtures, sample data for demos and tests |
| Helpers | `<feature>.utils.ts` | pure helper/utility functions |
| Pipeline/derivation logic | `<feature>.pipeline.ts` | data transforms feeding the store (when non-trivial) |
| Feature plugin | `with-<capability>.ts` | one file per opt-in feature (e.g. `with-sorting.ts`), matching its own `.spec.ts` |

Rules:
- Don't inline an interface/type inside a component or store file — put it in `<feature>.types.ts` and import it.
- Don't inline mock/sample data in a component (e.g. a `-demo` component) — put it in `<feature>.mock.ts` and import it.
- A folder's `index.ts` is a barrel: re-export the public API only, don't define logic there.
- Keep each file scoped to its single concern — if a `.store.ts` file starts accumulating helper functions or type definitions, split them out rather than growing the file.

This does not require rewriting existing single-file components; apply it to new features and when a file grows past one concern.
