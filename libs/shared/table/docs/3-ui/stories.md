---
title: Storybook story conventions
type: reference
status: reflects current practice as of the 8 stories in src/stories/
date: 2026-09-03
---

# Storybook story conventions — `libs/shared/table`

Read this before adding or extending a story in `src/stories/`. It records the pattern the
existing 8 stories already follow, so a new one doesn't drift from it. Not previously written
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
| `row-edit.http.ts` | `injectRowEditApi()` — `HttpClient` wrapper for the save/delete round trips, shared by the five fixed-mode save/delete story hosts |
| `row-edit.handlers.ts` | MSW request handlers |
| `row-edit-story.css` | Shared story styling |
| `code-tabs.css` | The mdx HTML/TS toggle, shared by every story's mdx |

Don't inline mock data or a schema call inside a story-host component — same rule as any other
component in this repo (`file-organization.md`).

**Transport decision (2026-09-05):** the five save/delete story hosts use `inject(HttpClient)`
via `injectRowEditApi()`, Observable-based (`.subscribe()`, not `firstValueFrom`) — not TanStack
Query. No shared/cached server-state exists across these demo-only stories to justify TanStack's
caching model, and `HttpClient` matches the repo's only other transport precedent.

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

**Every CRUD op in every row-editing story is a real MSW-intercepted round trip** — add, edit,
and delete alike, gated and live, optimistic and pessimistic. `forceFailure` and `latencyMs`
Storybook controls thread into request headers `row-edit.handlers.ts` reads, so the
failure/latency path is a real intercepted request, never a fake `await`. (Revised 2026-09-04 —
this used to carve out an exception for "a pessimistic, no-rollback story doesn't need MSW, a
plain `await` is enough." That's no longer the policy: pessimistic stories now hit the same mock
server as their optimistic siblings, just with the request awaited before the row closes instead
of after. Reserve a plain `await`/`Promise` stub for a story that isn't about save/delete at all.)

- **Synchronous, local mutation** — call the verb directly off the button
  (`this.table.editing.update(beginEdit(id))`, `this.table.editing.update(revertEdit(id))`).
  This is the default for everything that isn't itself a CRUD write; most buttons in the
  existing stories are this shape.
- **Real server round-trip** — every add/edit/delete button, per the rule above.
  `gated-single-optimistic/`, `gated-single-pessimistic/`, `gated-multiple-optimistic/`,
  `gated-bulk-optimistic/`, `live-table/`, and `live-optimistic/` all do this.

## `.stories.ts` and `.mdx`

- `.stories.ts` defines `Meta` + one exported story object per distinct **Storybook-arg**
  variant the story demonstrates (e.g. `Default`/`ForcedFailure` for `live-optimistic/`,
  `gated-multiple-optimistic/` — a `forceFailure` arg toggling a real MSW-intercepted `HttpClient`
  request).
  A single `Default` is enough when there's nothing to vary this way (`gated-single-pessimistic/`,
  whose save path is a stubbed `Promise` with no `forceFailure`/`latencyMs` to control). Don't
  add a second story object for something a control already covers — see the general
  `story-plan` guidance on when a variant earns its own story vs. a control.
- **An on-canvas toggle that switches between two incompatible code paths is not a control —
  it earns separate story folders, one host each.** A Storybook arg control (`forceFailure`,
  `latencyMs`) varies *input* to one fixed code path; a button that flips `saveMode` or
  `multiple` mid-story varies the *path itself*, which means the host's source always carries
  a dead branch for whichever mode isn't active — the opposite of "copy-paste code" (below).
  The row-editing cluster used to bundle Save-mode (Pessimistic/Optimistic) and session-shape
  (Live/Gated) behind exactly these toggles; it's now `live-optimistic/`,
  `gated-single-optimistic/`, `gated-single-pessimistic/`, `gated-multiple-optimistic/`,
  `gated-bulk-optimistic/` — five fixed-mode siblings, each host hardcoded to one path,
  cross-referencing the others in its doc-comment for contrast. Save-mode (Pessimistic/Optimistic)
  is a **gated**-only axis — it means "does the row stay open until the server confirms, or close
  right away" (`endEdit` after vs. before the fetch), which only makes sense where there's a
  session to hold open in the first place. A live table has no session (D29), so `live-pessimistic/`
  — added for verb symmetry with `live-optimistic/`, not from a product requirement — was removed;
  live's only axis is rollback vs. no rollback (`live-optimistic/` vs. `live-table/`).
  (`gated-multiple-pessimistic` has
  no story: bulk edit under `multiple: true` is optimistic-only by design — see
  `docs/1-state/work/with-multiple-edit/1-design.md`, which closes G4 — so that combination is
  intentionally unsupported, not merely undemoed. `gated-bulk-optimistic/` is optimistic-only for
  the same reason.)
- `.mdx` stays a thin wrapper: `Meta`/`Canvas`/`Source`, plus a code-tabs block. It is not the
  place to describe what the story proves — that's the host component's doc-comment (previous
  section). An exception: `live-optimistic.mdx` carries a short prose paragraph explaining *why*
  no `withRowEdit()` is composed here, because that's a non-obvious composition choice a reader
  needs before looking at the code. Add prose to an mdx only for that kind of "why," not a
  restatement of what's visible in the canvas.
- **Every story that exports a `ForcedFailure` variant gets its own `## Forced failure` section
  in the `.mdx`, with a `<Canvas of={Stories.ForcedFailure} />` and a one-paragraph summary of
  what's different from `Default`.** Angular's Storybook docgen does not surface a CSF export's
  own JSDoc comment into the UI — only the `.mdx` is an actual visible description surface — so
  the doc-comment above `export const ForcedFailure` in `.stories.ts` is source-only context for
  a code reader; without a matching `.mdx` section, `Default` and `ForcedFailure` render with the
  same (or no) description in Storybook, indistinguishable to a viewer. Keep the two in sync when
  either changes.
- **The code-tabs block covers only what a consumer needs to copy to reproduce the feature** —
  not every file the host happens to import. Matches the pattern Angular Material's own example
  viewer uses (e.g. "Dialog Animations": `HTML | TS | CSS | dialog-animations-example-dialog.html`).
  Tabs are two clusters, in this fixed order:
  1. **The host's own files, generically labeled: `HTML`, then `TS`, then `CSS` if it has a
     stylesheet** — always first, always in that order, always together. `CSS` means whatever
     the host's `styleUrl`/`styleUrls` actually is, local or shared — `row-edit-story.css` fills
     this slot generically labeled `CSS` for a story with no local override (`live-optimistic/`,
     the `gated-*` stories). Only when a host has **two** stylesheets (its own local one plus the
     shared one, e.g. `sorting-editing/`) does the local file take the `CSS` slot and the shared
     one drop to cluster 2, filename-labeled — one generic `CSS` tab per story, never two.
  2. **Extra files**, one tab each, labeled with the file's **literal filename** (not a made-up
     name like "Schema") — e.g. `row-edit.schema.ts`, `row-edit-story.css`. A file shared out of
     the story-cluster root is still just its own filename; there's no separate `Row ` prefix
     scheme — the filename itself already says whether it's local or shared. A plain extra file
     (schema/config logic) gets exactly one tab. An extra file that is itself a sub-component
     (has its own `.ts` **and** `.html`) gets a tab per file, filename-labeled, the same way the
     host's own two are — never collapsed into one.
  **Types, Mock, Utils, and Directive tabs are excluded entirely** — none of them are something
  a consumer copies: a row/data shape is inferred from the schema, not typed out by hand; mock
  data is fixture-only; a "utils" file is usually story-only glue (a fake save function, a
  demo-only diff/cycle helper) rather than reusable feature code; a directive is an import, not
  something copied inline. `?raw`-import each included file. When a story has both a local and
  a shared stylesheet (e.g. local `sorting-editing-flip.css` alongside shared
  `row-edit-story.css`), the local one keeps the cluster-1 `CSS` slot and the shared one gets
  its own filename-labeled tab in cluster 2. `code-tabs.css`'s positional `:nth-child` pairing
  between tab and panel currently supports up to 10 tabs; extend it (add another
  `:nth-child(11)` pair to both selector lists) before adding an 11th tab to any story —
  unlikely to matter at this scope, since every story in this cluster tops out at 5.

## Reference implementations

- `gated-single-optimistic/`, `gated-single-pessimistic/`, `gated-multiple-optimistic/` — the
  fullest examples: multiple mutation verbs, per-row transient UI state (`needsUniqueName`) kept
  separate from table state, and (for the two `-optimistic/` stories) `withRowEdit()`'s config
  wired to a fixed `multiple` value. Three separate hosts, not one host with toggles — see
  "`.stories.ts` and `.mdx`" above for why.
- `gated-bulk-optimistic/` — D32's batched-write answer: `createRow`'s array overload opens N rows
  in one call (no loop), `POST /api/rows/bulk` saves them in one request, one rollback unit.
  Scoped to only the bulk-create path (no update/delete) — that's the point of a standalone story
  here, not an oversight.
- `live-table/` + `live-optimistic/` — grouped under one `Live` nav entry (both focus-triggered,
  no session, per D29). `live-table/` is the no-rollback baseline (sorting + editing + deletion,
  persistent per-row errors with Retry, one manual undo slot); `live-optimistic/` isolates just
  the `withOptimistic()` rollback verbs (capture on focus, revert-after-failure on blur), plus a
  timed Undo affordance for delete.
- `external-write/` — demonstrates an effect from *outside* the story's own button clicks
  (`simulateServerPush`), scoped to exactly §1.5's two acceptance criteria (conflict banner on
  an open row, quiet patch on a closed one) — a worked example of the scope discipline above:
  it originally also carried a deletion-notice flow that belonged to a different user story
  (§1.2) and was cut for that reason.
