# File organization: this repo's worked example

The general model (concern-to-filename table, three levels, folder axis, invariants) is in the
global `file-organization.md` and `extract-encapsulated-logic.md` rules. This file is only this
repo's instance.

Reference implementation: `libs/table/src/`.

`libs/table/src/` crossed the threshold at ~17 source files and now
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
[ADR-0004](../../libs/table/docs/adr/0004-table-source-layout.md).
