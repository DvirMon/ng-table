---
title: Storybook story conventions
type: reference
status: reflects current practice as of the 6 stories in src/stories/
date: 2026-08-31
---

# Storybook story conventions — `libs/shared/table`

Read this before adding or extending a story in `src/stories/`. It records the pattern the
existing 6 stories already follow, so a new one doesn't drift from it. Not previously written
down anywhere — reverse-engineered from the shipped stories; correct it in place if practice
moves on.

For which stories a feature *needs* (coverage against the product doc, merge/standalone
decisions), that's a separate concern — see the `story-plan` skill.

## File layout — one folder per story, one concern per file

```
src/stories/<story-name>/
├── <story-name>-story-host.component.ts     ← the demo component
├── <story-name>-story-host.component.html   ← template — NEVER inline
├── <story-name>.stories.ts                  ← Storybook Meta + exported story objects
└── <story-name>.mdx                         ← thin wrapper: Meta/Canvas/Source only
```

Shared fixtures for a cluster of related stories (the row-editing set) live one level up,
split by concern per `file-organization.md`:

| File | Contents |
|---|---|
| `row-edit.types.ts` | The shared row shape (`EditRow`) |
| `row-edit.mock.ts` | Fixture rows, option lists (`EDIT_ROWS_MOCK`, `DEPT_OPTIONS`) |
| `row-edit.schema.ts` | `createTableSchema()` calls per story variant (`gatedTableSchema`, `liveTableSchema`, `liveOptimisticSchema`) + the shared Signal Forms `editRowsSchema` |
| `row-edit.utils.ts` | Pure helpers (`saveRowPessimistic`) |
| `row-edit.handlers.ts` | MSW request handlers |
| `row-edit-story.css` | Shared story styling |
| `code-tabs.css` | The mdx HTML/TS toggle, shared by every story's mdx |

Don't inline mock data or a schema call inside a story-host component — same rule as any other
component in this repo (`file-organization.md`).

## The story-host component

- **Standalone, separate template.** `templateUrl`/`styleUrl`, never an inline `template:`
  string — same rule as every other Angular component in this repo
  (`.claude/rules/typescript-conventions.md`, restated for a sibling app in
  `apps/ng-table/docs/CONVENTIONS.md`). A story is still a component; it doesn't get an
  exception for being demo-only.
- **Class name keeps the `Component` suffix** (`GatedEditStoryHostComponent`, not
  `GatedEditStoryHost`) — this is the one place in the repo that suffix convention is kept,
  because the file is explicitly a story harness, not a design-system domain component.
- **A doc-comment naming which product/design decision the story proves**, not what it renders.
  Every existing host opens with one (`/** S2 — the gated table (`withRowEdit()`)... */`,
  `/** S6 — the live table with rollback (D39)... */`). Point at the ADR/decision-record id if
  one exists, and say *why* the story is shaped the way it is (why this feature and not that
  one, why a config is passed as a signal instead of a plain value) — not a restatement of the
  template.
- **State lives in signals on the host**, following the schema/mock split above — `data`,
  `saveError`, per-row flags like `needsUniqueName`. The host wires `createTable()` and
  `form()` together; it does not reimplement table logic.

## Story scope — copy-paste code, not a realistic app

A story's code is what a consumer copies to implement the feature(s) it's proving — not a
sketch of what a real app around that feature would also need. Two questions gate every line:

- **Does this serve the feature this story proves?** If a real consumer would plausibly add it
  regardless of which feature they're implementing (a confirm dialog before a destructive
  action, a toast system, loading skeletons), it's app chrome, not the feature — leave it out
  unless the story's whole point *is* that affordance.
- **Is this feature inherent to the surface being shown, or merely adjacent?** A story may cover
  several features at once only when they're inseparable from what that surface actually is —
  `live-table/` shows sorting + editing + deletion together because a live table *is* that set of
  capabilities, not because bundling them was convenient. A single-feature story (`external-write/`
  proving §1.5 reconciliation) doesn't get a second feature bolted on just because it's plausible
  a consumer would want it there too — that belongs to whichever story already proves it, or a
  story of its own.

**Exception — design stories.** When the story's subject is visual/interaction design itself
(a component's states, a layout), the "copy-paste code" framing doesn't apply the same way —
the story *is* the design surface being reviewed, not a feature implementation to lift. Scope
still applies, just against the design surface being shown instead of a product feature.

If review turns up a flow that doesn't answer "which feature does this line serve," cut it —
even if it's realistic, even if it's already-written, even if removing it shrinks the demo.
`external-write/` had exactly this: a deletion-notice UI attributed in its own doc-comment to
the feature it was proving, but the acceptance criteria it actually cited belonged to a
different, already-covered user story. Noise doesn't announce itself as noise — check the claim
against the actual spec section, don't take the comment's word for it.

## Mocking actions: buttons over the actions panel

Every mutation a person can trigger needs an on-canvas button calling a real table/form
updater — never a Storybook actions-panel-only trigger, and never a bare `console.log`. A
person reading the story should be able to click through the whole flow and see the resulting
table state change, not just see an event logged in a side panel.

Two tiers, by how much the story needs to prove:

- **Synchronous, local mutation** — call the verb directly off the button
  (`this.table.editing.update(beginEdit(id))`, `this.table.editing.update(revertEdit(id))`).
  This is the default; most buttons in the existing stories are this shape.
- **Simulated server round-trip** — when the story is specifically about save/delete
  reliability (optimistic rollback, pending state, retry), intercept a real `fetch()` with MSW
  rather than stubbing a `Promise`. `optimistic-save/` and `live-optimistic/` both do this: a
  `forceFailure` boolean and `latencyMs` number are Storybook controls, threaded into request
  headers the MSW handler reads (`row-edit.handlers.ts`), so the failure/latency path is a real
  intercepted request, not a fake await. Reach for this whenever a story's whole point is
  proving what happens when a save is slow or rejected — a pessimistic, no-rollback story
  (`gated-edit/`'s plain Save) doesn't need it; a plain `await` is enough there.

## `.stories.ts` and `.mdx`

- `.stories.ts` defines `Meta` + one exported story object per distinct mode/config the story
  demonstrates (e.g. `SingleMode`/`MultipleMode` for `gated-edit/`, `Default`/`ForcedFailure`
  for `optimistic-save/`). Don't add a second story object for something a control already
  covers — see the general `story-plan` guidance on when a variant earns its own story vs. a
  toggle.
- `.mdx` stays a thin wrapper: `Meta`/`Canvas`/`Source`, plus the shared HTML/TS code-tabs
  block every existing mdx repeats verbatim. It is not the place to describe what the story
  proves — that's the host component's doc-comment (previous section). An exception:
  `live-optimistic.mdx` carries a short prose paragraph explaining *why* no `withRowEdit()` is
  composed here, because that's a non-obvious composition choice a reader needs before looking
  at the code. Add prose to an mdx only for that kind of "why," not a restatement of what's
  visible in the canvas.

## Reference implementations

- `gated-edit/` — the fullest example: multiple mutation verbs, a Storybook boolean arg wired
  live into `withRowEdit()`'s config, per-row transient UI state (`needsUniqueName`) kept
  separate from table state.
- `live-optimistic/` + `optimistic-save/` — the MSW/simulated-server-round-trip pattern.
- `external-write/` — demonstrates an effect from *outside* the story's own button clicks
  (`simulateServerPush`), scoped to exactly §1.5's two acceptance criteria (conflict banner on
  an open row, quiet patch on a closed one) — a worked example of the scope discipline above:
  it originally also carried a deletion-notice flow that belonged to a different user story
  (§1.2) and was cut for that reason.
