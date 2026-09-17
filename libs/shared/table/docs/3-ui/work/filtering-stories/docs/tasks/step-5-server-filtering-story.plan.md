---
title: "Step 5 — server-filtering/: filters that produce the data"
type: task-step
plan: ../../1-gap-analysis.md
node: C
---

# Step 5 — `server-filtering/`: filters that produce the data

> **Reworked 2026-09-14.** The separate `searchModel` signal and the effect copying it into
> the filters are deleted — `form(filters().value, serverFilterFormSchema)` binds the
> criterion model directly, which is what R18 specified. Everything else (no filtering
> feature, server `totalRowCount` override, late-default race) is unchanged.

**PR scope:** One story folder, complete — host, template, `.stories.ts`, `.mdx`.

**Task type:** code

**Skills used:** angular-developer, css-styling, typescript-conventions

**Depends on:** Step 1, Step 2, Step 3
**Parallel-safe with:** Step 4, Step 6

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/stories/filtering/server-filtering/server-filtering-story-host.component.ts` (create)
- `libs/shared/table/src/stories/filtering/server-filtering/server-filtering-story-host.component.html` (create)
- `libs/shared/table/src/stories/filtering/server-filtering/server-filtering.stories.ts` (create)
- `libs/shared/table/src/stories/filtering/server-filtering/server-filtering.mdx` (create)

## Why This Step Exists

Node C. The server path is a different **code path**, not an argument — no client `filter` stage
runs and the rows arrive already narrowed. `stories.md` rules that a toggle between two
incompatible paths earns its own folder, or the host permanently carries a dead branch. It is also
the only place three product criteria can exist at all: 2.4's late-default race, 2.3's
server-supplied total, and R25's debounce.

**Composition, settled:** the host composes **no filtering feature**. `createFilters()` alone feeds
the request (R10/R11, forced by server mode); `withFiltering({ manual: true })` is an identity
pass-through that still claims the `filter` stage, so composing it would demo an empty stage claim
(R23, `cov §1`). `with-filtering.spec.ts`'s manual-mode block stays valid as symmetry coverage — it
is not the recommended server shape. Say this in the doc-comment.

## What To Do

1. `createTable(data, serverInvoiceConfig)` — features only as needed for the rest of the surface;
   **no filtering feature**. `data` is fed from `injectInvoiceApi()` responses.
2. Serialize `filters().active()` into `GET /api/invoices`. The query mapping is **hand-written in
   the host** (R16) — that is the shipped DX, so the story shows it rather than hiding it.
3. **Debounced search box** — bound through Signal Forms with `filterFormSchema`'s
   `debounce(path, 300)` (Step 2). With `latencyMs` on, the request count per keystroke is the
   visible difference. This is the one place debounce has a consequence and the one shape a peer
   ships (MUI X `debounceMs`).
4. **Server-supplied total** — a tiny inline `createTableFeature` overriding `totalRowCount` with
   the response's `total` (ADR-0005 / `OverridableCoreKey`), rendered next to `renderRows().length`
   so "the server's number, not an approximation from one page" is visible rather than asserted.
5. **Late default must not stomp a typed value** — the amount filter declares
   `source: () => serverDefaultRange()`; a `latencyMs` arg plus a **Deliver server default now**
   button lets a person type into the box *before* the default lands and watch `dirty()` block the
   overwrite (R19). Invisible unless raced on purpose, which is why it needs a story.
6. **Three states, visibly distinct** — loading, no-matches (`active()` non-empty + `total === 0`),
   and request-failed are three different blocks, never one empty table. `ux §7`: all four peers
   support server filtering and **none** documents a loading affordance, so this is a decision this
   story makes; name it as such in the doc-comment.
7. **Failure path** — `forceFailure` → the request fails and the previously-loaded rows **stay on
   screen** behind an error marker rather than the table blanking (R29's "wider, never blank"
   instinct at the transport layer). Add a **Retry** button.

**`.stories.ts` + `.mdx`.** Title `Table / Filtering / Server`. Exports `Default` and
`ForcedFailure`; `parameters.msw.handlers` registers Step 3's handlers; args `forceFailure`,
`latencyMs`. The `.mdx` carries its own `## Forced failure` section with a `<Canvas>` and a
one-paragraph summary, and the host's hint paragraph branches on `forceFailure()` — both required by
`stories.md`, because Angular's docgen never surfaces a CSF export's JSDoc.

Code tabs: `HTML`, `TS`, `CSS`, `filtering/fixtures/filters.ts`, `filtering/fixtures/schema.ts`,
`filtering/fixtures/http.ts`.

## Implementation Notes

- Read `docs/3-ui/stories.md` first.
- Observable-based `.subscribe()`, not `firstValueFrom` — the repo's transport precedent.
- Keep the request-count indicator on canvas; without it the debounce has nothing to show.

## Risks / Watchouts

- Do not compose `withFiltering({ manual: true })` "for symmetry" — the whole point of this story's
  composition decision is that it is redundant under R10.
- The error state must not clear `data` — blanking is the failure being argued against.

## Non-Goals

- No client `filter` stage, no selection, no unit tests on the host.

## Acceptance Checks

- [ ] No filtering feature is composed; filters feed the request only.
- [ ] Typing issues one request per debounce window, not per keystroke, visible via a request count.
- [ ] `totalRowCount()` reads the server's `total`, rendered beside `renderRows().length`.
- [ ] Typing before the server default arrives survives its arrival (`dirty()` blocks the write).
- [ ] Loading, no-matches and failed render as three distinct blocks; `ForcedFailure` keeps the
      previous rows on screen with a Retry.
- [ ] `npx tsc -p libs/shared/table/tsconfig.lib.json --noEmit` clean.

---
← [Step 4: client-filtering/](step-4-client-filtering-story.plan.md) | [Step 6: selection-filtering/](step-6-selection-filtering-story.plan.md) →
