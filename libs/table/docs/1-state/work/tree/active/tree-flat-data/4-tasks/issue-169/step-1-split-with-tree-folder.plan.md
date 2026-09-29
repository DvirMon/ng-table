---
step: 1
type: code
commit: ref
depends_on: []
files:
  - libs/table/src/api/features/with-tree/types.ts (new)
  - libs/table/src/api/features/with-tree/nest.ts (new)
  - libs/table/src/api/features/with-tree/feature.ts (new)
  - libs/table/src/api/features/with-tree.ts (deleted)
  - libs/table/src/api/features/with-tree/feature.spec.ts (moved from api/features/with-tree.spec.ts)
  - libs/table/src/index.ts
  - libs/table/src/api/features/with-expansion.spec.ts
  - libs/table/src/api/features/with-filtering/feature.spec.ts
  - libs/table/src/api/features/with-grouping/feature.spec.ts
  - libs/table/src/api/features/with-grouping/feature.types.spec.ts
  - libs/table/src/table.mock.ts
---
# Step 1 — Split with-tree into a folder

This step turns `with-tree.ts` into a `with-tree/` folder, with no behaviour change.
The later steps add their code to the new files.

## Do

- Create `with-tree/types.ts`. It holds `WithTreeConfig`, `TreeSlice` and `TreeMembers`, and re-exports `ExpansionChange` and `ExpansionWriteOptions`.
- Create `with-tree/nest.ts`. It holds the flat `'tree'` render stage:
  - `buildFlatTreeStage`;
  - `nestFlatPool` and `nestFlatSiblings`;
  - the guard and report helpers.
- Create `with-tree/feature.ts`. It holds `buildTreeSpec`, discovery, `parentOf` / `descendantsOf` and the `withTree` overloads.
- Delete `with-tree.ts`.
- Move `with-tree.spec.ts` to `with-tree/feature.spec.ts`. Change only its import paths.
- Point every importer at the new files directly, for example `./with-tree/feature` and `./with-tree/types`. The importers are `index.ts` and the four specs listed above.
- In `table.mock.ts`, fix the two comments (around lines 240 and 245) that name `with-tree.spec.ts`.

## Watch out

- Do not add a `with-tree/index.ts`. `src/index.ts` is the only barrel.
- Do not rename any symbol.

## Out of scope

- Any new behaviour.

## Done when

- [ ] The moved spec passes unchanged.
- [ ] No file imports `with-tree.ts` any more.

---
[Step 2: Engine read of context rows](step-2-ctx-context-rows.plan.md) →
