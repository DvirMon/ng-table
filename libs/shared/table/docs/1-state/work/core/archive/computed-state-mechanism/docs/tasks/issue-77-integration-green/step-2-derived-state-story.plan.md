---
title: "Step 2 — derived-state.stories.ts + derived-state.mdx — Table / Composition / Derived State"
type: task-step
issue: 77
---

# Step 2 — `derived-state.stories.ts` + `derived-state.mdx` — `Table / Composition / Derived State`

**PR scope:** Two files in `src/stories/composition/derived-state/`. No host changes.

**Task type:** story

**Skills used:** story-create (via story-implementer); read
`libs/shared/table/docs/3-ui/stories.md` sections "`.stories.ts` and `.mdx`" and "Reference
implementations" first — they override the generic React conventions.

**Depends on:** Step 1
**Parallel-safe with:** Step 3

**Scaffolding agent:** story-implementer

## Files

- `libs/shared/table/src/stories/composition/derived-state/derived-state.stories.ts` (create)
- `libs/shared/table/src/stories/composition/derived-state/derived-state.mdx` (create)

## Why This Step Exists

AC 3 ("every table story renders") and AC 4 need the Step 1 host reachable in the Storybook
sidebar. The `.stories.ts` is the Meta + one `Default` story; the `.mdx` is the thin
Meta/Canvas/Source wrapper every other story has. Separate from Step 1 so `/implement` routes
it through story conventions, not component conventions.

## What To Do

1. `derived-state.stories.ts` — copy the shape of
   `selection/multi-selection/multi-selection.stories.ts` exactly:
   `Meta<DerivedStateStoryHostComponent>`, `title: 'Table / Composition / Derived State'`,
   `parameters: { layout: 'padded' }`, `type Story = StoryObj<…>`, one
   `export const Default: Story = {};` with a doc-comment listing what the canvas shows (filter
   by dept, tick rows, banner splits visible/hidden). Every verb is synchronous and local — no
   failure path, no second story.
2. `derived-state.mdx` — copy `multi-selection.mdx` and follow `stories.md`'s code-tab rule:
   cluster 1 is the host's own files labelled `HTML`, `TS` (and `CSS` only if Step 1 added a
   local stylesheet — otherwise the shared `styles/story-host.css` fills the `CSS` slot, as the
   `gated-*` stories do); cluster 2 is the shared files with descriptive labels
   (`Schema` → `composition/fixtures/schema.ts`).
3. No args controls — nothing in this host varies at construction time.

## Implementation Notes

- Storybook config (`libs/shared/table/.storybook/main.ts`) globs `src/**/*.stories.ts` and
  `*.mdx`; no registration step.
- Title casing follows the sidebar pattern already in use (`Table / Selection / Multi`).

## Risks / Watchouts

- The `.mdx` `Source` blocks reference files by relative path — a wrong depth is a Storybook
  build error, not a type error (cf. commit `9dde224`, a `.css` import-depth fix). Count the
  `../` against the actual folder.

## Non-Goals

- Interaction tests (`play`) — no story in this library has them.
- Host or fixture edits — Step 1.

## Acceptance Checks

- [ ] `npx tsc -p libs/shared/table/.storybook/tsconfig.json --noEmit` → exit 0
- [ ] `derived-state.mdx` `Source` paths resolve (`ls` each referenced file from the mdx's folder)
- [ ] Title is `Table / Composition / Derived State`; exactly one exported story

---
← [Step 1: `stories/composition/` fixtures + host](step-1-composition-derived-state-host.plan.md) | [Step 3: `stories.md` layout tree + fixtures table](step-3-stories-doc-composition-folder.plan.md) →
