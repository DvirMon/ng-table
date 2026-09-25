# Step 4 — `CLAUDE.md` invariants and layout rows

**PR scope:** standalone. **Depends on:** #139 closed (external,
since it deletes the array intake that the rows describe).
**Parallel-safe with:** Step 1, Step 2, Step 3, Step 6

**Task type:** docs

**Skills used:** —

**Scaffolding agent:** — (main thread)

## Files

- `libs/table/CLAUDE.md`

## Why This Step Exists

#141 acceptance item 6. The design brief
(`design-create-columns.md` § "Invariants the design rests
on") says: record "`Feature<In, Out>` stays callable" in this
file. The code-layout table also describes a shape that #131
and #139 removed.

## What To Do

1. **New invariant**, in "Feature plugin pattern" § Rules
   (or "Locked invariants", whichever the surrounding text
   fits):
   > **`Feature<In, Out>` stays callable.** A feature slot sees
   > the column ids from a context-sensitive `columns` argument
   > only because the feature is a function type. A generic
   > feature returning a plain object is resolved before `TCols`
   > is inferred, and the id union reaching every slot collapses.
   > Probe: `design-create-columns.md` P1j.
2. **Add an `api/create-columns.ts` row.** There is none today:
   `createColumns(data, build, schema?)`, the `col()` builder
   and `col.from`, the type-only `ColumnDecl` brand, and
   `ColumnSet { columns, rules }`. It runs the two schema
   construction checks (dev-gated in their own body).
3. **Refresh the `columns-schema/` rows.**
   - `schema.ts`: says `columnSchema()` and the `ColumnsPath`
     proxy. Check it against the source, and say the path
     reaches consumers through `createColumns`'s schema
     argument.
   - `rules.ts`: already says `visible()`/`visibleAsync()`.
     Check it.
   - Top-level tree comment (`columns-schema/ ← column schema
     DSL: columnSchema(), …`): check the names.
4. **Remove the deleted `resolve.ts`.** The
   `engine/columns-schema/` row lists `resolve.ts (compile —
   resolveColumnsConfig())`, and the Naming paragraph cites
   `engine/columns-schema/resolve.ts` as the compile-verb
   example. The file is deleted in the working tree. Write
   what replaced it (read `engine/columns-schema/index.ts` and
   `api/create-table.ts`), and choose another example of a
   compile-phase entry point named for its verb
   (`engine/filters/build.ts` already is one).
5. **`api/types.ts` row.** If it still lists `ColumnDef` as the
   declaration type, add `ColumnDecl`/`ColumnSet` as the input
   side, or point at the new row.

## Implementation Notes

- `claude-md-no-implementation-status`: rules and file purposes
  only. No "#139 shipped", and no "array intake removed in
  #139". Describe the current shape.
- Verify each row against `src/` before writing it, not against
  the spec. The spec describes intent.

## Non-Goals

- The Errors bullet. #132 already rewrote it (dev-gated, gate
  in the body, G76 writer ungated).
- Sections unrelated to columns.

## Acceptance Checks

- [ ] The "`Feature<In, Out>` stays callable" invariant is
      present, with its reason.
- [ ] `api/create-columns.ts` has a row, and it matches the
      source.
- [ ] No reference to `engine/columns-schema/resolve.ts` or
      `resolveColumnsConfig` remains, unless the symbol still
      exists in `src/`.
- [ ] No status language added.

---
← [Step 3: ADR amendments](step-3-adr-amendments.plan.md) | [Step 5: Check #140's order-window doc](step-5-verify-order-window-doc.plan.md) →
