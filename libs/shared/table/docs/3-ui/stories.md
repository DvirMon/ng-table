---
title: Storybook story conventions
type: reference
status: reflects current practice as of the 18 stories in src/stories/
date: 2026-09-14
---

# Storybook story conventions — `libs/shared/table`

Read this before adding or extending a story in `src/stories/`. It records the pattern the
existing 18 stories already follow, so a new one doesn't drift from it. Not previously written
down anywhere — reverse-engineered from the shipped stories; correct it in place if practice
moves on.

For which stories a feature *needs* (coverage against the product doc, merge/standalone
decisions), that's a separate concern — see the `story-plan` skill.

## Where a story's inputs live

Planning a story for a feature means reading three doc classes, in three different places. The
product doc is the *output* of the research, not the research — reading only `0-product/` and
calling that the input set is how a plan ends up inventing affordances.

| Input | Path | Answers |
|---|---|---|
| Product user stories | `docs/0-product/<feature>.md` | what a person needs to be able to do; the coverage marks a plan re-derives |
| Research corpus | `docs/1-state/work/with-<feature>/research-*.md` | the evidence behind the product doc |
| Story conventions | this file | the shape a story takes in this repo |

Inside the research corpus, `research-<feature>-ux-capabilities.md` is the one that decides what
a story's buttons look like — a version-pinned, URL-cited inventory of what a person can click,
tap and press across AG Grid, TanStack Table v8, MUI X Data Grid, PrimeNG, Material React Table
and (for selection) Angular CDK's `SelectionModel`. Its siblings carry community pain
(`research-<feature>-community-pain.md`), what this library already ships
(`research-<feature>-internal-coverage.md`), and per-feature design questions.

Where that research shows peer libraries converging on one affordance, a story demonstrates that
convention by default. Deviations are stated and justified, not silent.

Worked examples of a plan built this way: `work/selection-stories/`, `work/filtering-stories/`,
`work/grouping-stories/` — each carries a "Conventions from peer libraries" matrix ahead of its
target story set.

## File layout — feature folder first, one folder per story inside it

`src/stories/` groups by **feature**, matching the Storybook sidebar: every story titled
`Table / Row Editing / …` lives under `row-edit/`. No loose files at the root.

```
src/stories/
├── styles/                                  ← the only genuinely cross-feature files
│   ├── story-host.css                       ← shared host styling, BEM block `.story-host`
│   └── code-tabs.css                        ← the mdx HTML/TS toggle
├── row-edit/                                ← one folder per feature
│   ├── fixtures/                            ← shared by this feature's stories, nothing else
│   │   ├── types.ts  mock.ts  schema.ts
│   │   └── utils.ts  http.ts  handlers.ts
│   ├── ui/                                  ← demo-only components/directives
│   │   ├── commit-counter.component.ts
│   │   ├── focus-new-row.directive.ts
│   │   └── local-undo-slot.ts
│   └── <story-name>/
│       ├── <story-name>-story-host.component.ts     ← the demo component
│       ├── <story-name>-story-host.component.html   ← template — NEVER inline
│       ├── <story-name>.stories.ts                  ← Storybook Meta + exported story objects
│       └── <story-name>.mdx                         ← thin wrapper: Meta/Canvas/Source only
├── composition/                             ← fixtures/ + derived-state/: the positional-composition showcase (withComputed() in both placements)
├── filtering/                               ← fixtures/ + filtering-story.css + 3 hosts
│   └── client-filtering/  server-filtering/  selection-filtering/
├── grouping/                                ← fixtures/ + grouping-story.css + 3 hosts
│   └── grouping-static/  grouping-collapsible/  grouping-selection/
└── selection/                               ← fixtures/ + selection-story.css + 2 hosts
    └── multi-selection/  single-selection/
```

**A feature's own stylesheet sits beside its `fixtures/`, not inside it.** `filtering-story.css`,
`grouping-story.css` and `selection-story.css` are each imported by every host in their feature
and by nothing else — a second importer within the feature, which is the `fixtures/` bar, but
they are not fixtures. They layer after `styles/story-host.css`, which every host also lists
first in `styleUrls`.

The folder supplies the domain, so files inside drop the redundant prefix —
`row-edit/fixtures/mock.ts`, not `row-edit/fixtures/row-edit.mock.ts`.

**Promotion ladder.** A fixture starts inside its own story folder. It moves to
`<feature>/fixtures/` on a second importer **within that feature**, and to `styles/` (or a
sibling root folder) only on a **cross-feature** importer — that second bar is why the root
holds two stylesheets and nothing else. Promote on evidence (`file-organization.md`), never in
anticipation.

Stories stay flat inside `row-edit/` rather than mirroring the title's `Gated / Single /
Optimistic` nesting — 9 entries doesn't warrant three levels. Promote if it outgrows ~15.

| Shared file | Contents |
|---|---|
| `row-edit/fixtures/types.ts` | The shared row shape (`EditRow`) |
| `row-edit/fixtures/mock.ts` | Fixture rows, option lists (`EDIT_ROWS_MOCK`, `DEPT_OPTIONS`) |
| `row-edit/fixtures/schema.ts` | `editTableConfig` (`TableConfig<EditRow>`, `trackBy: 'id'` + `columns`) shared by all nine hosts, and the shared Signal Forms `editRowsSchema`. Each host composes its own features inline: `createTable(this.data, editTableConfig, ...features)` |
| `row-edit/fixtures/utils.ts` | Pure helpers (`saveRowPessimistic`) |
| `row-edit/fixtures/http.ts` | `injectRowEditApi()` — `HttpClient` wrapper for the save/delete round trips, shared by the five fixed-mode save/delete story hosts |
| `row-edit/fixtures/handlers.ts` | MSW request handlers |
| `row-edit/ui/*` | Demo-only instrumentation (`CommitCounterComponent`, `focusNewRow`, `localUndoSlot`) — never table API |
| `composition/fixtures/types.ts` | The shared row shape (`CompositionRow`) and the criterion model (`CompositionFilterState`) |
| `composition/fixtures/mock.ts` | Fixture rows and the dept option list (`COMPOSITION_ROWS_MOCK`, `COMPOSITION_DEPT_OPTIONS`) |
| `composition/fixtures/schema.ts` | `compositionColumns` and `derivedStateConfig` (`TableConfig<CompositionRow>`, `trackBy: 'id'` + `columns`) |
| `filtering/fixtures/types.ts` | `InvoiceRow` (one field per shipped rule kind, `note` nullable for the blank-cell case), `InvoiceStatus`, the criterion shapes, and the three per-story `…FilterState` models |
| `filtering/fixtures/mock.ts` | `INVOICE_ROWS_MOCK` plus the hand-supplied `STATUS_OPTIONS`/`TAG_OPTIONS` — `createFilters()` takes no `data` argument, so option lists are never derived from rows |
| `filtering/fixtures/schema.ts` | `clientInvoiceConfig`, `serverInvoiceConfig`, `selectionInvoiceConfig` (one per story over one column list), and `serverFilterFormSchema` — the `debounce(path.search, 300)` that only the server story needs |
| `filtering/fixtures/utils.ts` | Type guards and pure helpers (`isInvoiceStatus`, `isRangeCriterion`, `toggleOption`, `formatCriterion`) |
| `filtering/fixtures/http.ts` | `injectInvoiceApi()` — `GET /api/invoices`; the host builds `params`, because the query mapping is the shipped DX |
| `filtering/fixtures/handlers.ts` | MSW handlers for the server story |
| `filtering/filtering-story.css` | Filtering-specific styling — filter row, active markers, chip summary, notices |
| `grouping/fixtures/types.ts` | `DealRow` (`region` nullable **and** optional so `null`/`undefined`/`''` all exist), `DealOwner` (the object-valued level), `DealPage` |
| `grouping/fixtures/mock.ts` | `GROUPING_ROWS_MOCK` — three nesting levels, a single-row group, a row carrying `children`, the three blank keys, a `Date` and an object column |
| `grouping/fixtures/schema.ts` | Three table configs over one column list, the level constants, `sumAmount` (the `aggregateFn` that **throws** on a negative — #79's demo), `EXTERNAL_GROUP_ORDER`, `MISSING_GROUPING_LEVEL`, and `createDealFilters()` |
| `grouping/fixtures/utils.ts` | `formatValue`/`formatAmount`/`isBlankGroupValue` — one formatter behind every rendered value, group labels included, so S8's `[object Object]` shows rather than being papered over |
| `grouping/fixtures/http.ts` | `injectGroupedRowsApi()` — `fetchRows` plus `fetchGroupingPreference`, the async grouping rule's source |
| `grouping/fixtures/handlers.ts` | MSW handlers for the refetch and async-rule round trips |
| `grouping/grouping-story.css` | Grouping-specific styling — group rows by `data-row-kind`/`data-depth`, level pills, chevrons, opt-in sticky headers |
| `selection/fixtures/types.ts` | `SelectionRow` — `locked` drives `enableRowSelection`; wider than `EditRow` so select-all and a count are meaningful |
| `selection/fixtures/mock.ts` | `SELECTION_ROWS_MOCK`, `SAVED_SELECTION_IDS` (carries an id no row has), `SAVED_CONFLICTING_SELECTION_IDS` (two ids that both exist) |
| `selection/fixtures/schema.ts` | `multiSelectionConfig` and `singleSelectionConfig` — identical shape, because `enableMultiRowSelection: false` is a `withSelection()` argument, not a config field |
| `selection/selection-story.css` | Selection-specific styling — count banner, control column, `aria-disabled` and locked-row treatment |
| `styles/story-host.css` | Shared story styling; every feature's own stylesheet layers after it |
| `styles/code-tabs.css` | The mdx HTML/TS toggle, shared by every story's mdx |

**No `ui/` folder outside `row-edit/`.** Demo-only instrumentation that belongs to exactly one
story stays in that story's folder — `selection/multi-selection/selection-event-log.ts` is the
only instance, and it is there rather than in `selection/fixtures/` because one story imports it.
Story-local **arg types** follow the same rule: `grouping-static/grouping-static.types.ts` and
`grouping-selection/grouping-selection.types.ts` name that host's own Storybook controls and
nothing else.

No barrel. Stories are not public API and `.storybook/main.ts` globs `../src/stories/**`, so
depth is free.

Don't inline mock data, column definitions, or the table config inside a story-host component —
the host composes features on `createTable(...)`, the fixtures file owns the config and the
Signal Forms schema — same rule as any other component in this repo (`file-organization.md`).

**`createFilters()` is the exception, and belongs in the host** (2026-09-14). A filters schema is
a declaration a consumer writes, not data a story is handed — the same category as the
`createTable()` call it sits next to, and unreadable one file away. Fixtures keep the rows, the
option lists, the table config and the form schema; the `createFilters<TRow, TState>(…)` call
goes in the host's field initializer. Pass `TState` there too: without it every node reads back
`unknown` and the host grows a narrowing layer over state the library already types.

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
Storybook controls thread into request headers `row-edit/fixtures/handlers.ts` reads, so the
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
- **Why `ForcedFailure` earns its own story instead of staying a control you flip on `Default`:**
  the rollback/error-recovery UI — a reverted value, a locked/error row, a Retry affordance — never
  renders on the happy path. `Default`'s DOM literally never reaches that state. A control alone
  buries it behind "remember to open Controls and flip the boolean"; a pinned story makes the one
  UI state the whole feature exists for (recovering from a failed optimistic/close-then-confirm
  save) permanently visible in the sidebar. This only applies where a save/close strategy actually
  has a rollback or reopen-for-retry step to reveal — a story with nothing to roll back (see
  `gated-multiple-pessimistic`'s non-existence, above) has no `ForcedFailure` to add.
- **Every story that exports a `ForcedFailure` variant gets its own `## Forced failure` section
  in the `.mdx`, with a `<Canvas of={Stories.ForcedFailure} />` and a one-paragraph summary of
  what's different from `Default`.** Angular's Storybook docgen does not surface a CSF export's
  own JSDoc comment into the UI — only the `.mdx` is an actual visible description surface — so
  the doc-comment above `export const ForcedFailure` in `.stories.ts` is source-only context for
  a code reader; without a matching `.mdx` section, `Default` and `ForcedFailure` render with the
  same (or no) description in Storybook, indistinguishable to a viewer. Keep the two in sync when
  either changes.
- **The host's own on-canvas hint paragraph (`story-host__hint`) must itself branch on
  `forceFailure()`.** The `.mdx` "Forced failure" section (above) only shows up on that story's
  separate Docs page — a person just clicking through `Default`/`ForcedFailure` in the sidebar and
  looking at the rendered canvas never sees it, and would otherwise see the exact same static hint
  text on both, with nothing on screen saying what's different. Every story with a `ForcedFailure`
  export wraps its hint in `@if (forceFailure()) { ... } @else { ... }` so the one piece of text
  actually visible while interacting with the story describes the state that story is in.
- **The code-tabs block covers only what a consumer needs to copy to reproduce the feature** —
  not every file the host happens to import. Matches the pattern Angular Material's own example
  viewer uses (e.g. "Dialog Animations": `HTML | TS | CSS | dialog-animations-example-dialog.html`).
  Tabs are two clusters, in this fixed order:
  1. **The host's own files, generically labeled: `HTML`, then `TS`, then `CSS` if it has a
     stylesheet** — always first, always in that order, always together. `CSS` means whatever
     the host's `styleUrl`/`styleUrls` actually is, local or shared — `styles/story-host.css` fills
     this slot generically labeled `CSS` for a story with no local override (`live-optimistic/`,
     the `gated-*` stories). Only when a host has **two** stylesheets (its own local one plus the
     shared one, e.g. `sorting-editing/`) does the local file take the `CSS` slot and the shared
     one drop to cluster 2, filename-labeled — one generic `CSS` tab per story, never two.
     **This rule wins over a task plan's enumerated tab list** (settled 2026-09-14): the filtering
     and grouping hosts shipped with `story-host.css` dropped entirely because their step files
     counted the tabs, while the selection hosts shipped the shared file as its own tab per this
     rule. The selection hosts are correct — a step file enumerating tabs is a convenience, not a
     second source of truth.
  2. **Extra files**, one tab each, labeled with the file's **literal filename** (not a made-up
     name like "Schema") — e.g. `row-edit/fixtures/schema.ts`, `styles/story-host.css`. A file shared out of
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
  `styles/story-host.css`), the local one keeps the cluster-1 `CSS` slot and the shared one gets
  its own filename-labeled tab in cluster 2. `code-tabs.css`'s positional `:nth-child` pairing
  between tab and panel currently supports up to 10 tabs; extend it (add another
  `:nth-child(11)` pair to both selector lists) before adding an 11th tab to any story —
  unlikely to matter at this scope, since every story in this cluster tops out at 5.

## Reference implementations

- `gated-single-optimistic/`, `gated-single-pessimistic/`, `gated-multiple-optimistic/` — the
  fullest examples: multiple mutation verbs, per-row transient UI state (`needsUniqueName`) kept
  separate from table state, and (for the two `-optimistic/` stories) `withRowEdit()`'s config
  wired to a fixed `multiple` value. Three separate hosts, not one host with toggles — see
  "`.stories.ts` and `.mdx`" above for why. **`saveAll()`/`clearAll()` live only in
  `gated-multiple-optimistic/`** (removed 2026-09-05 from the two single-row stories) — single
  mode caps at one open row, so neither button could ever do more than the existing Save/Cancel
  already do there; keeping them would have been dead surface, not an extra demonstrated
  behavior. Every other verb (add, duplicate, discard, Force Invalid, keyboard nav, Save & Add
  Next) stays copy-pasted across all three deliberately — each host is a self-sufficient
  copy-paste reference for its own mode combination, not a diff against its siblings.
- `gated-bulk-optimistic/` — D32's batched-write answer: `createRow`'s array overload opens N rows
  in one call (no loop), `POST /api/rows/bulk` saves them in one request, one rollback unit.
  Scoped to only the bulk-create path (no update/delete) — that's the point of a standalone story
  here, not an oversight.
- `live-table/` + `live-optimistic/` — grouped under one `Live` nav entry (both focus-triggered,
  no session, per D29). `live-table/` is the no-rollback baseline (sorting + editing + deletion,
  persistent per-row errors with Retry, one manual undo slot); `live-optimistic/` isolates just
  the `withOptimistic()` rollback verbs (capture on focus, revert-after-failure on blur), plus a
  timed Undo affordance for delete.
- **`filtering/` — three hosts, and the composition differs between them on purpose.**
  `client-filtering/` composes `withFiltering({ filters })` and is the baseline: five rule kinds
  plus a declared `anyOf` quick filter, a chip summary, `Reset to defaults` vs. `Clear all` as two
  visibly different buttons, and a broken-predicate toggle that widens the result set.
  `server-filtering/` composes **no filtering feature at all** — `createFilters()` feeds the
  request and the rows arrive narrowed, so a client `filter` stage would have nothing to do; it
  also carries the only `debounce` in the set and overrides core `totalRowCount` with the server's
  own via `createTableFeature()` (ADR-0005). `selection-filtering/` adds `withSelection()` +
  `withSorting()` and is where selection-under-filter is measured — see `0-product/filtering.md`
  §5 F-S1. All three put their `createFilters()` call in the host, not `fixtures/`.
- **`grouping/` — three hosts, split by what the table *is*, not by feature flags.**
  `grouping-static/` is the grouped table as its own product: `withGrouping()` + `withFiltering()`
  and deliberately **no** `withExpansion()`, because a chevron with nothing to expand is a control
  that does nothing. It carries the widest arg surface in the repo (`groupOrder` across five modes
  including a throwing one, `groupedColumnMode` across all three peer dispositions, `showCount`,
  `stickyHeaders`, and an async grouping rule with its own pending/resolved/failed states).
  `grouping-collapsible/` is the navigable outline — `withExpansion()` + `withSorting()`, a real
  `<button>` chevron carrying `aria-expanded`, and three separate attacks on the collapse state.
  `grouping-selection/` renders all three peer cascade defaults off one `rowsOf()` call.
  **Three of its controls are honest regressions, annotated as live gaps rather than dressed up**
  — a broken summary takes the whole table down (#79), a dropped grouping level is unannounced,
  and blank/object group keys have no label. A story that ships a known-wrong behavior says so on
  canvas and links the issue; it does not quietly avoid the case.
- **`selection/` — two hosts, because the mode is a construction-time argument.**
  `multi-selection/` puts the whole read/write surface of `withSelection()` on one screen,
  including a `selectionChanged` event log that is the only place D9's single-delta clear and
  D11's silent reconciliation prune are distinguishable. `single-selection/` is a sibling rather
  than a toggle, per the fixed-mode rule above: `enableMultiRowSelection: false` is passed at
  construction, so a toggle would leave a dead branch in the host. Its control is a **radio
  group**, which makes the replace rule the control's own semantics and supplies arrow-key roving
  focus for free.
- `external-write/` — demonstrates an effect from *outside* the story's own button clicks
  (`simulateServerPush`), scoped to exactly §1.5's two acceptance criteria (conflict banner on
  an open row, quiet patch on a closed one) — a worked example of the scope discipline above:
  it originally also carried a deletion-notice flow that belonged to a different user story
  (§1.2) and was cut for that reason.
