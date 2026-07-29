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

## Extract inline logic into named functions

Beyond file-splitting, watch for logic that should be its own **named function** even when it stays in the same file — this is the more common miss during code generation.

Extract when inline logic is:
- **Reused, or one edit away from reuse** — e.g. a `.map()` callback that builds an object from raw input (validation + shape assembly) belongs in `createX`/`toX` in `<feature>.utils.ts`, not inlined in the caller.
- **A stateful primitive with its own lifecycle** — a `useRef`/timer/subscription map with schedule/cancel/cleanup semantics belongs in its own `use<Thing>` hook, not inlined inside a larger orchestration hook. Signal: the containing hook's `useEffect`/`useCallback` list is mixing unrelated lifecycles (e.g. object-URL cleanup + timer cleanup + drag state in one hook).
- **Independently testable** — if you'd want a unit test for just this piece without mounting the whole hook/component, it's a sign it should be a named export.

Don't extract when:
- The logic is a single expression or trivial transform used exactly once, with no independent meaning (over-extraction produces a maze of one-line indirections).
- Extraction would require passing back most of the caller's local state anyway (no real seam exists yet).

When generating a hook or component: before returning, scan for (a) inline object-construction inside a `.map`/`.forEach` that could be a `create*`/`to*` helper, and (b) an inline `useRef` + effect pair that constitutes its own lifecycle — pull both out by default unless they fail the "don't extract" cases above.
