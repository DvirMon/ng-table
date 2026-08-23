---
globs:
  - "libs/**/*.ts"
  - "apps/**/*.ts"
---

# File organization: one concern per file

Split generated/edited code by concern instead of putting everything in one file. Use `<feature>.<concern>.ts`, not a bare generic name — this avoids collisions when multiple features live in sibling folders and keeps imports self-describing.

Reference implementations: `apps/issa-landing/src/design-system/components/upload/FileUploader/` (flat, 24 files) and `libs/shared/table/src/` (grouped — see "Once a domain outgrows flat" below).

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

## Once a domain outgrows flat — the worked example

The general model (the three levels, how to pick a folder axis, the invariants once nested) is in
the global `file-organization.md` rule, injected into every session. Don't restate it here. This
section is only this repo's instance of it.

`libs/shared/table/src/` crossed the threshold at ~17 source files and now
groups by contract boundary first, lifecycle phase second:

```
index.ts       ← the only definition of the public surface; no other barrels
api/           ← everything a consumer touches (api/features/ = opt-in with-*() plugins)
engine/        ← the runtime; nothing here is exported
directives/    ← the view layer
```

`api/features/with-columns-schema/` shows the sub-split: `resolve.ts` (compile) → `wiring.ts`
(run) → `feature.ts` (declare). Its siblings `with-sorting.ts` and `with-expansion.ts` are still
single files — they haven't outgrown one.

Full rationale, plus the Angular Signal Forms / TanStack / AG Grid comparison and the three
Angular conventions deliberately rejected:
[ADR-0004](../../libs/shared/table/docs/adr/0004-table-source-layout.md).

This does not require rewriting existing single-file components; apply it to new features and when a file grows past one concern.

For *whether* inline logic should be pulled out of its host's scope at all (own named function or
own file, reuse not required) — see [extract-encapsulated-logic.md](extract-encapsulated-logic.md).
This file only governs where something goes once that question is settled.
